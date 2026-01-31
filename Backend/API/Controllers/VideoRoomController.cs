using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pickleball.Community.Hubs;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using System.Security.Claims;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class VideoRoomController : ControllerBase
{
    private readonly IVideoRoomService _roomService;
    private readonly ILogger<VideoRoomController> _logger;

    public VideoRoomController(IVideoRoomService roomService, ILogger<VideoRoomController> logger)
    {
        _roomService = roomService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new video room. Requires authentication.
    /// </summary>
    [HttpPost]
    [Authorize]
    public async Task<ActionResult<VideoRoomCreatedResponse>> CreateRoom([FromBody] CreateVideoRoomRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("Room name is required");
            }

            var userId = GetCurrentUserId();
            var userName = GetCurrentUserName();

            // Build base URL from request
            var baseUrl = $"{Request.Scheme}://{Request.Host}";

            var result = await _roomService.CreateRoomAsync(request, userId, userName, baseUrl);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating video room");
            return StatusCode(500, "Failed to create room");
        }
    }

    /// <summary>
    /// Get room info by room code (public - no auth required)
    /// </summary>
    [HttpGet("{roomCode}")]
    [AllowAnonymous]
    public async Task<ActionResult<VideoRoomDto>> GetRoom(string roomCode)
    {
        var room = await _roomService.GetRoomByCodeAsync(roomCode);
        if (room == null)
        {
            return NotFound("Room not found or has ended");
        }

        // Add live participant count from hub
        room.ParticipantCount = VideoRoomHub.GetParticipantCount(roomCode);
        return Ok(room);
    }

    /// <summary>
    /// Get all active rooms (requires authentication)
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<List<VideoRoomDto>>> GetActiveRooms()
    {
        var rooms = await _roomService.GetActiveRoomsAsync();

        // Fill in live participant counts
        foreach (var room in rooms)
        {
            room.ParticipantCount = VideoRoomHub.GetParticipantCount(room.RoomCode);
        }

        return Ok(rooms);
    }

    /// <summary>
    /// Validate passcode and join a room (public - guests can join)
    /// </summary>
    [HttpPost("{roomCode}/join")]
    [AllowAnonymous]
    public async Task<ActionResult<JoinVideoRoomResponse>> JoinRoom(string roomCode, [FromBody] JoinVideoRoomRequest request)
    {
        try
        {
            var result = await _roomService.ValidateJoinAsync(roomCode, request);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            // Check max participants
            if (result.Room != null && result.Room.MaxParticipants > 0)
            {
                var currentCount = VideoRoomHub.GetParticipantCount(roomCode);
                if (currentCount >= result.Room.MaxParticipants)
                {
                    return BadRequest(new JoinVideoRoomResponse
                    {
                        Success = false,
                        Error = "Room is full"
                    });
                }
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error joining room {RoomCode}", roomCode);
            return StatusCode(500, "Failed to join room");
        }
    }

    /// <summary>
    /// Get participants currently in a room
    /// </summary>
    [HttpGet("{roomCode}/participants")]
    [AllowAnonymous]
    public ActionResult<List<VideoRoomParticipant>> GetParticipants(string roomCode)
    {
        var participants = VideoRoomHub.GetParticipants(roomCode);
        return Ok(participants);
    }

    /// <summary>
    /// End a room (admin only - room creator)
    /// </summary>
    [HttpPost("{roomCode}/end")]
    [Authorize]
    public async Task<ActionResult> EndRoom(string roomCode)
    {
        var userId = GetCurrentUserId();
        var result = await _roomService.EndRoomAsync(roomCode, userId);

        if (!result)
        {
            return BadRequest("Cannot end room. You may not be the creator.");
        }

        return Ok(new { message = "Room ended" });
    }

    /// <summary>
    /// Lock/unlock a room (admin only - room creator)
    /// </summary>
    [HttpPost("{roomCode}/lock")]
    [Authorize]
    public async Task<ActionResult> LockRoom(string roomCode, [FromQuery] bool locked = true)
    {
        var userId = GetCurrentUserId();
        var result = await _roomService.LockRoomAsync(roomCode, userId, locked);

        if (!result)
        {
            return BadRequest("Cannot lock/unlock room. You may not be the creator.");
        }

        return Ok(new { message = locked ? "Room locked" : "Room unlocked" });
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private string? GetCurrentUserName()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")?.Value;
    }
}
