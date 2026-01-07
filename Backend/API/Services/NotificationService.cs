using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Hubs;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

/// <summary>
/// Service interface for sending real-time notifications via SignalR
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Create a notification in the database and push it via SignalR
    /// </summary>
    Task<Notification> CreateAndSendAsync(int userId, string type, string title, string? message = null,
        string? actionUrl = null, string? referenceType = null, int? referenceId = null);

    /// <summary>
    /// Send a notification to a specific user via SignalR (without saving to DB)
    /// </summary>
    Task SendToUserAsync(int userId, NotificationPayload notification);

    /// <summary>
    /// Send notifications to multiple users via SignalR
    /// </summary>
    Task SendToUsersAsync(IEnumerable<int> userIds, NotificationPayload notification);

    /// <summary>
    /// Broadcast a notification to all connected users
    /// </summary>
    Task BroadcastAsync(NotificationPayload notification);

    /// <summary>
    /// Send notification to all users watching a specific game
    /// </summary>
    Task SendToGameAsync(int gameId, NotificationPayload notification);

    /// <summary>
    /// Send notification to all users in an event group
    /// </summary>
    Task SendToEventAsync(int eventId, NotificationPayload notification);

    /// <summary>
    /// Send notification to all users in a club group
    /// </summary>
    Task SendToClubAsync(int clubId, NotificationPayload notification);

    /// <summary>
    /// Create and send notifications to multiple users (saves to DB and pushes via SignalR)
    /// </summary>
    Task<List<Notification>> CreateAndSendToUsersAsync(IEnumerable<int> userIds, string type, string title,
        string? message = null, string? actionUrl = null, string? referenceType = null, int? referenceId = null);
}

/// <summary>
/// Payload sent via SignalR for real-time notifications
/// </summary>
public class NotificationPayload
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Message { get; set; }
    public string? ActionUrl { get; set; }
    public string? ReferenceType { get; set; }
    public int? ReferenceId { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Implementation of the notification service
/// </summary>
public class NotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ApplicationDbContext _context;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        IHubContext<NotificationHub> hubContext,
        ApplicationDbContext context,
        ILogger<NotificationService> logger)
    {
        _hubContext = hubContext;
        _context = context;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<Notification> CreateAndSendAsync(int userId, string type, string title, string? message = null,
        string? actionUrl = null, string? referenceType = null, int? referenceId = null)
    {
        // Create notification in database
        var notification = new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        // Push via SignalR if user is connected
        var payload = new NotificationPayload
        {
            Id = notification.Id,
            Type = notification.Type,
            Title = notification.Title,
            Message = notification.Message,
            ActionUrl = notification.ActionUrl,
            ReferenceType = notification.ReferenceType,
            ReferenceId = notification.ReferenceId,
            CreatedAt = notification.CreatedAt
        };

        await SendToUserAsync(userId, payload);

        _logger.LogInformation("Notification {Id} created and sent to user {UserId}: {Title}",
            notification.Id, userId, title);

        return notification;
    }

    /// <inheritdoc />
    public async Task SendToUserAsync(int userId, NotificationPayload notification)
    {
        try
        {
            await _hubContext.Clients.Group($"user_{userId}")
                .SendAsync("ReceiveNotification", notification);

            _logger.LogDebug("Notification sent to user {UserId}: {Title}", userId, notification.Title);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending notification to user {UserId}", userId);
        }
    }

    /// <inheritdoc />
    public async Task SendToUsersAsync(IEnumerable<int> userIds, NotificationPayload notification)
    {
        var tasks = userIds.Select(userId =>
            _hubContext.Clients.Group($"user_{userId}")
                .SendAsync("ReceiveNotification", notification));

        await Task.WhenAll(tasks);

        _logger.LogDebug("Notification sent to {Count} users: {Title}", userIds.Count(), notification.Title);
    }

    /// <inheritdoc />
    public async Task BroadcastAsync(NotificationPayload notification)
    {
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);

        _logger.LogDebug("Notification broadcast to all users: {Title}", notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToGameAsync(int gameId, NotificationPayload notification)
    {
        var groupName = $"game_{gameId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);
        _logger.LogDebug("Notification sent to game {GameId}: {Title}", gameId, notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToEventAsync(int eventId, NotificationPayload notification)
    {
        var groupName = $"event_{eventId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);
        _logger.LogDebug("Notification sent to event {EventId}: {Title}", eventId, notification.Title);
    }

    /// <inheritdoc />
    public async Task SendToClubAsync(int clubId, NotificationPayload notification)
    {
        var groupName = $"club_{clubId}";
        await _hubContext.Clients.Group(groupName).SendAsync("ReceiveNotification", notification);
        _logger.LogDebug("Notification sent to club {ClubId}: {Title}", clubId, notification.Title);
    }

    /// <inheritdoc />
    public async Task<List<Notification>> CreateAndSendToUsersAsync(IEnumerable<int> userIds, string type, string title,
        string? message = null, string? actionUrl = null, string? referenceType = null, int? referenceId = null)
    {
        var now = DateTime.UtcNow;
        var notifications = userIds.Select(userId => new Notification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IsRead = false,
            CreatedAt = now
        }).ToList();

        _context.Notifications.AddRange(notifications);
        await _context.SaveChangesAsync();

        // Push to all users via SignalR
        var payload = new NotificationPayload
        {
            Type = type,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            CreatedAt = now
        };

        await SendToUsersAsync(userIds, payload);

        _logger.LogInformation("Notification sent to {Count} users: {Title}", notifications.Count, title);

        return notifications;
    }
}
