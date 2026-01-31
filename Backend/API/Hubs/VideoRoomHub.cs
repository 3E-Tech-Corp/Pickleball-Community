using Microsoft.AspNetCore.SignalR;
using Pickleball.Community.Models.DTOs;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace Pickleball.Community.Hubs;

/// <summary>
/// SignalR Hub for WebRTC video room signaling.
/// Handles room join/leave, WebRTC offer/answer/ICE exchange, and room controls.
/// No [Authorize] — guests can join too. Auth is validated via passcode.
/// </summary>
public class VideoRoomHub : Hub
{
    private readonly ILogger<VideoRoomHub> _logger;

    // Thread-safe tracking of rooms and participants
    // RoomCode -> { ConnectionId -> Participant }
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, VideoRoomParticipant>> _rooms = new();

    // ConnectionId -> RoomCode (for cleanup on disconnect)
    private static readonly ConcurrentDictionary<string, string> _connectionRooms = new();

    public VideoRoomHub(ILogger<VideoRoomHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Join a video room. Called after passcode validation on the REST API.
    /// </summary>
    public async Task JoinRoom(string roomCode, string displayName, int? userId, bool isCreator)
    {
        var connectionId = Context.ConnectionId;

        // Try to get userId from JWT if authenticated
        if (userId == null)
        {
            var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out var parsedId))
            {
                userId = parsedId;
            }
        }

        var participant = new VideoRoomParticipant
        {
            ConnectionId = connectionId,
            DisplayName = displayName,
            UserId = userId,
            IsCreator = isCreator,
            IsMuted = false,
            IsCameraOff = false,
            IsScreenSharing = false
        };

        // Add to room tracking
        var roomParticipants = _rooms.GetOrAdd(roomCode, _ => new ConcurrentDictionary<string, VideoRoomParticipant>());
        roomParticipants[connectionId] = participant;
        _connectionRooms[connectionId] = roomCode;

        // Add to SignalR group
        await Groups.AddToGroupAsync(connectionId, roomCode);

        // Get existing participants (for the new joiner to create peer connections)
        var existingParticipants = roomParticipants.Values
            .Where(p => p.ConnectionId != connectionId)
            .ToList();

        // Tell the new participant about existing participants
        await Clients.Caller.SendAsync("ExistingParticipants", existingParticipants);

        // Tell existing participants about the new joiner
        await Clients.OthersInGroup(roomCode).SendAsync("ParticipantJoined", participant);

        _logger.LogInformation("User {DisplayName} joined room {RoomCode} (connection: {ConnectionId})",
            displayName, roomCode, connectionId);
    }

    /// <summary>
    /// Leave a video room explicitly
    /// </summary>
    public async Task LeaveRoom()
    {
        await HandleDisconnect();
    }

    /// <summary>
    /// Send WebRTC offer to a specific peer
    /// </summary>
    public async Task SendOffer(string targetConnectionId, string sdp)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", Context.ConnectionId, sdp);
    }

    /// <summary>
    /// Send WebRTC answer to a specific peer
    /// </summary>
    public async Task SendAnswer(string targetConnectionId, string sdp)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", Context.ConnectionId, sdp);
    }

    /// <summary>
    /// Send ICE candidate to a specific peer
    /// </summary>
    public async Task SendIceCandidate(string targetConnectionId, string candidate, string? sdpMid, int? sdpMLineIndex)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate",
            Context.ConnectionId, candidate, sdpMid, sdpMLineIndex);
    }

    /// <summary>
    /// Toggle mute status and notify room
    /// </summary>
    public async Task ToggleMute(bool isMuted)
    {
        if (_connectionRooms.TryGetValue(Context.ConnectionId, out var roomCode) &&
            _rooms.TryGetValue(roomCode, out var participants) &&
            participants.TryGetValue(Context.ConnectionId, out var participant))
        {
            participant.IsMuted = isMuted;
            await Clients.OthersInGroup(roomCode).SendAsync("ParticipantMuteChanged",
                Context.ConnectionId, isMuted);
        }
    }

    /// <summary>
    /// Toggle camera status and notify room
    /// </summary>
    public async Task ToggleCamera(bool isCameraOff)
    {
        if (_connectionRooms.TryGetValue(Context.ConnectionId, out var roomCode) &&
            _rooms.TryGetValue(roomCode, out var participants) &&
            participants.TryGetValue(Context.ConnectionId, out var participant))
        {
            participant.IsCameraOff = isCameraOff;
            await Clients.OthersInGroup(roomCode).SendAsync("ParticipantCameraChanged",
                Context.ConnectionId, isCameraOff);
        }
    }

    /// <summary>
    /// Toggle screen sharing status
    /// </summary>
    public async Task ToggleScreenShare(bool isScreenSharing)
    {
        if (_connectionRooms.TryGetValue(Context.ConnectionId, out var roomCode) &&
            _rooms.TryGetValue(roomCode, out var participants) &&
            participants.TryGetValue(Context.ConnectionId, out var participant))
        {
            participant.IsScreenSharing = isScreenSharing;
            await Clients.OthersInGroup(roomCode).SendAsync("ParticipantScreenShareChanged",
                Context.ConnectionId, isScreenSharing);
        }
    }

    /// <summary>
    /// Send a chat message to the room
    /// </summary>
    public async Task SendChatMessage(string message)
    {
        if (_connectionRooms.TryGetValue(Context.ConnectionId, out var roomCode) &&
            _rooms.TryGetValue(roomCode, out var participants) &&
            participants.TryGetValue(Context.ConnectionId, out var participant))
        {
            var chatMessage = new VideoRoomChatMessage
            {
                SenderName = participant.DisplayName,
                SenderId = Context.ConnectionId,
                Message = message,
                Timestamp = DateTime.UtcNow
            };

            await Clients.Group(roomCode).SendAsync("ReceiveChatMessage", chatMessage);
        }
    }

    // --- Admin Controls ---

    /// <summary>
    /// Mute all participants (admin only)
    /// </summary>
    public async Task MuteAll()
    {
        if (!IsCallerCreator(out var roomCode)) return;

        if (_rooms.TryGetValue(roomCode!, out var participants))
        {
            foreach (var p in participants.Values)
            {
                p.IsMuted = true;
            }
            await Clients.Group(roomCode!).SendAsync("AllMuted");
        }
    }

    /// <summary>
    /// Unmute all participants (admin only)
    /// </summary>
    public async Task UnmuteAll()
    {
        if (!IsCallerCreator(out var roomCode)) return;

        if (_rooms.TryGetValue(roomCode!, out var participants))
        {
            foreach (var p in participants.Values)
            {
                p.IsMuted = false;
            }
            await Clients.Group(roomCode!).SendAsync("AllUnmuted");
        }
    }

    /// <summary>
    /// Remove a participant from the room (admin only)
    /// </summary>
    public async Task RemoveParticipant(string targetConnectionId)
    {
        if (!IsCallerCreator(out var roomCode)) return;

        if (_rooms.TryGetValue(roomCode!, out var participants) &&
            participants.TryRemove(targetConnectionId, out var removed))
        {
            _connectionRooms.TryRemove(targetConnectionId, out _);
            await Groups.RemoveFromGroupAsync(targetConnectionId, roomCode!);

            // Tell the removed participant
            await Clients.Client(targetConnectionId).SendAsync("RemovedFromRoom");

            // Tell everyone else
            await Clients.Group(roomCode!).SendAsync("ParticipantLeft", targetConnectionId, removed.DisplayName);

            _logger.LogInformation("Participant {Name} removed from room {Room} by admin",
                removed.DisplayName, roomCode);
        }
    }

    /// <summary>
    /// End the room for everyone (admin only)
    /// </summary>
    public async Task EndRoom()
    {
        if (!IsCallerCreator(out var roomCode)) return;

        await Clients.Group(roomCode!).SendAsync("RoomEnded");

        // Clean up all participants
        if (_rooms.TryRemove(roomCode!, out var participants))
        {
            foreach (var connId in participants.Keys)
            {
                _connectionRooms.TryRemove(connId, out _);
                await Groups.RemoveFromGroupAsync(connId, roomCode!);
            }
        }

        _logger.LogInformation("Room {Room} ended by admin", roomCode);
    }

    /// <summary>
    /// Get current participant count for a room (public static for API use)
    /// </summary>
    public static int GetParticipantCount(string roomCode)
    {
        if (_rooms.TryGetValue(roomCode, out var participants))
        {
            return participants.Count;
        }
        return 0;
    }

    /// <summary>
    /// Get all participants for a room (public static for API use)
    /// </summary>
    public static List<VideoRoomParticipant> GetParticipants(string roomCode)
    {
        if (_rooms.TryGetValue(roomCode, out var participants))
        {
            return participants.Values.ToList();
        }
        return new List<VideoRoomParticipant>();
    }

    // --- Connection lifecycle ---

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await HandleDisconnect();
        await base.OnDisconnectedAsync(exception);
    }

    private async Task HandleDisconnect()
    {
        var connectionId = Context.ConnectionId;

        if (_connectionRooms.TryRemove(connectionId, out var roomCode))
        {
            if (_rooms.TryGetValue(roomCode, out var participants))
            {
                if (participants.TryRemove(connectionId, out var participant))
                {
                    await Groups.RemoveFromGroupAsync(connectionId, roomCode);
                    await Clients.Group(roomCode).SendAsync("ParticipantLeft",
                        connectionId, participant.DisplayName);

                    _logger.LogInformation("User {Name} left room {Room}", participant.DisplayName, roomCode);

                    // Clean up empty rooms
                    if (participants.IsEmpty)
                    {
                        _rooms.TryRemove(roomCode, out _);
                        _logger.LogInformation("Room {Room} removed (empty)", roomCode);
                    }
                }
            }
        }
    }

    private bool IsCallerCreator(out string? roomCode)
    {
        roomCode = null;
        if (!_connectionRooms.TryGetValue(Context.ConnectionId, out roomCode))
            return false;

        if (!_rooms.TryGetValue(roomCode, out var participants))
            return false;

        if (!participants.TryGetValue(Context.ConnectionId, out var participant))
            return false;

        return participant.IsCreator;
    }
}
