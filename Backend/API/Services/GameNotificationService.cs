using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Hubs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

/// <summary>
/// Service for sending game-related notifications to players
/// Self-contained module for game scheduling notifications
/// </summary>
public interface IGameNotificationService
{
    /// <summary>
    /// Notify player their game is ready on a specific court
    /// </summary>
    Task<NotificationResult> NotifyGameReadyAsync(int userId, int gameId, string courtName, bool requireAck = true);

    /// <summary>
    /// Notify player they are on deck (next up)
    /// </summary>
    Task<NotificationResult> NotifyOnDeckAsync(int userId, int gameId, string courtName, bool requireAck = false);

    /// <summary>
    /// Notify player of court change
    /// </summary>
    Task<NotificationResult> NotifyCourtChangeAsync(int userId, int gameId, string oldCourt, string newCourt, bool requireAck = true);

    /// <summary>
    /// Notify player game is starting soon (reminder)
    /// </summary>
    Task<NotificationResult> NotifyGameReminderAsync(int userId, int gameId, string courtName, int minutesUntilStart);

    /// <summary>
    /// Notify player game has been cancelled
    /// </summary>
    Task<NotificationResult> NotifyGameCancelledAsync(int userId, int gameId, string? reason = null);

    /// <summary>
    /// Notify multiple players (pass user IDs directly for flexibility)
    /// </summary>
    Task<List<NotificationResult>> NotifyPlayersAsync(IEnumerable<int> userIds, int? gameId, string title, string message, bool requireAck = false);

    /// <summary>
    /// Send custom game notification
    /// </summary>
    Task<NotificationResult> SendCustomAsync(int userId, int? gameId, string title, string message, bool requireAck = false);
}

/// <summary>
/// Result of sending a notification
/// </summary>
public class NotificationResult
{
    public bool Success { get; set; }
    public int UserId { get; set; }
    public int? NotificationId { get; set; }
    public int PushSentCount { get; set; }
    public bool SignalRSent { get; set; }
    public string? Error { get; set; }
}

public class GameNotificationService : IGameNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly IPushNotificationService _pushService;
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<GameNotificationService> _logger;

    public GameNotificationService(
        ApplicationDbContext context,
        IPushNotificationService pushService,
        IHubContext<NotificationHub> hubContext,
        ILogger<GameNotificationService> logger)
    {
        _context = context;
        _pushService = pushService;
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task<NotificationResult> NotifyGameReadyAsync(int userId, int gameId, string courtName, bool requireAck = true)
    {
        var title = $"🏓 Game Ready - {courtName}";
        var message = $"Your game is ready! Please report to {courtName} now.";

        return await SendNotificationAsync(userId, gameId, title, message, "GameReady", requireAck);
    }

    public async Task<NotificationResult> NotifyOnDeckAsync(int userId, int gameId, string courtName, bool requireAck = false)
    {
        var title = "⏳ You're On Deck";
        var message = $"Get ready! You're next up for {courtName}.";

        return await SendNotificationAsync(userId, gameId, title, message, "OnDeck", requireAck);
    }

    public async Task<NotificationResult> NotifyCourtChangeAsync(int userId, int gameId, string oldCourt, string newCourt, bool requireAck = true)
    {
        var title = "📍 Court Changed";
        var message = $"Your game has been moved from {oldCourt} to {newCourt}. Please report to {newCourt}.";

        return await SendNotificationAsync(userId, gameId, title, message, "CourtChange", requireAck);
    }

    public async Task<NotificationResult> NotifyGameReminderAsync(int userId, int gameId, string courtName, int minutesUntilStart)
    {
        var title = $"⏰ Game in {minutesUntilStart} min";
        var message = $"Your game on {courtName} starts in {minutesUntilStart} minutes. Please be ready!";

        return await SendNotificationAsync(userId, gameId, title, message, "GameReminder", requireAck: false);
    }

    public async Task<NotificationResult> NotifyGameCancelledAsync(int userId, int gameId, string? reason = null)
    {
        var title = "❌ Game Cancelled";
        var message = reason != null
            ? $"Your game has been cancelled. Reason: {reason}"
            : "Your game has been cancelled. Check with tournament staff for details.";

        return await SendNotificationAsync(userId, gameId, title, message, "GameCancelled", requireAck: false);
    }

    public async Task<List<NotificationResult>> NotifyPlayersAsync(IEnumerable<int> userIds, int? gameId, string title, string message, bool requireAck = false)
    {
        var results = new List<NotificationResult>();

        foreach (var userId in userIds.Distinct())
        {
            var result = await SendNotificationAsync(userId, gameId, title, message, "GameUpdate", requireAck);
            results.Add(result);
        }

        _logger.LogInformation("Notified {Count} players{GameInfo}: {Title}",
            results.Count, gameId.HasValue ? $" for game {gameId}" : "", title);

        return results;
    }

    public async Task<NotificationResult> SendCustomAsync(int userId, int? gameId, string title, string message, bool requireAck = false)
    {
        return await SendNotificationAsync(userId, gameId, title, message, "GameCustom", requireAck);
    }

    /// <summary>
    /// Core notification sending logic
    /// </summary>
    private async Task<NotificationResult> SendNotificationAsync(
        int userId,
        int? gameId,
        string title,
        string message,
        string notificationType,
        bool requireAck)
    {
        var result = new NotificationResult { UserId = userId };

        try
        {
            int? notificationId = null;
            int pushSent = 0;

            if (requireAck)
            {
                // Send with acknowledgment - creates notification record with token
                var (notifId, sentCount) = await _pushService.SendWithAcknowledgmentAsync(
                    userId,
                    title,
                    message,
                    notificationType,
                    referenceType: gameId.HasValue ? "Game" : null,
                    referenceId: gameId
                );
                notificationId = notifId;
                pushSent = sentCount;
            }
            else
            {
                // Create notification record without acknowledgment
                var notification = new Notification
                {
                    UserId = userId,
                    Type = notificationType,
                    Title = title,
                    Message = message,
                    ReferenceType = gameId.HasValue ? "Game" : null,
                    ReferenceId = gameId,
                    ActionUrl = gameId.HasValue ? $"/event/game/{gameId}" : null,
                    CreatedAt = DateTime.Now
                };
                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync();
                notificationId = notification.Id;

                // Send push notification
                pushSent = await _pushService.SendToUserAsync(userId, title, message);
            }

            // Also send via SignalR for real-time in-app notification
            var signalRSent = false;
            try
            {
                await _hubContext.Clients.Group($"user_{userId}").SendAsync("ReceiveNotification", new
                {
                    Id = notificationId,
                    Type = notificationType,
                    Title = title,
                    Message = message,
                    GameId = gameId,
                    RequiresAck = requireAck,
                    CreatedAt = DateTime.Now
                });
                signalRSent = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send SignalR notification to user {UserId}", userId);
            }

            result.Success = true;
            result.NotificationId = notificationId;
            result.PushSentCount = pushSent;
            result.SignalRSent = signalRSent;

            _logger.LogInformation(
                "Game notification sent to user {UserId}: {Title} (Push: {PushCount}, SignalR: {SignalR}, Ack: {RequiresAck})",
                userId, title, pushSent, signalRSent, requireAck);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send game notification to user {UserId}", userId);
            result.Success = false;
            result.Error = ex.Message;
        }

        return result;
    }
}
