using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class FriendsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<FriendsController> _logger;

    public FriendsController(ApplicationDbContext context, ILogger<FriendsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /friends - Get all friends
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<FriendDto>>>> GetFriends()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendDto>> { Success = false, Message = "User not authenticated" });

            var friendships = await _context.Friendships
                .Include(f => f.User1)
                .Include(f => f.User2)
                .Where(f => f.UserId1 == userId.Value || f.UserId2 == userId.Value)
                .ToListAsync();

            var friends = friendships.Select(f =>
            {
                var friendUser = f.UserId1 == userId.Value ? f.User2 : f.User1;
                return new FriendDto
                {
                    Id = f.Id,
                    FriendUserId = friendUser!.Id,
                    Name = $"{friendUser.FirstName} {friendUser.LastName}".Trim(),
                    ProfileImageUrl = friendUser.ProfileImageUrl,
                    ExperienceLevel = friendUser.ExperienceLevel,
                    PlayingStyle = friendUser.PlayingStyle,
                    Location = !string.IsNullOrEmpty(friendUser.City) && !string.IsNullOrEmpty(friendUser.State)
                        ? $"{friendUser.City}, {friendUser.State}"
                        : friendUser.City ?? friendUser.State,
                    PaddleBrand = friendUser.PaddleBrand,
                    FriendsSince = f.FriendsSince
                };
            }).ToList();

            return Ok(new ApiResponse<List<FriendDto>> { Success = true, Data = friends });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching friends");
            return StatusCode(500, new ApiResponse<List<FriendDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /friends/search?query=... - Search for players
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<List<PlayerSearchResultDto>>>> SearchPlayers([FromQuery] string query)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<PlayerSearchResultDto>> { Success = false, Message = "User not authenticated" });

            if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
                return Ok(new ApiResponse<List<PlayerSearchResultDto>> { Success = true, Data = new List<PlayerSearchResultDto>() });

            var queryLower = query.ToLower();

            // Get existing friend user IDs
            var friendUserIds = await _context.Friendships
                .Where(f => f.UserId1 == userId.Value || f.UserId2 == userId.Value)
                .Select(f => f.UserId1 == userId.Value ? f.UserId2 : f.UserId1)
                .ToListAsync();

            // Get users with pending requests
            var pendingRequestUserIds = await _context.FriendRequests
                .Where(fr => (fr.SenderId == userId.Value || fr.RecipientId == userId.Value) && fr.Status == "Pending")
                .Select(fr => fr.SenderId == userId.Value ? fr.RecipientId : fr.SenderId)
                .ToListAsync();

            var users = await _context.Users
                .Where(u => u.Id != userId.Value && u.IsActive &&
                    (u.FirstName!.ToLower().Contains(queryLower) ||
                     u.LastName!.ToLower().Contains(queryLower) ||
                     u.Email.ToLower().Contains(queryLower) ||
                     (u.FirstName + " " + u.LastName).ToLower().Contains(queryLower)))
                .Take(20)
                .Select(u => new PlayerSearchResultDto
                {
                    Id = u.Id,
                    Name = $"{u.FirstName} {u.LastName}".Trim(),
                    ProfileImageUrl = u.ProfileImageUrl,
                    ExperienceLevel = u.ExperienceLevel,
                    Location = !string.IsNullOrEmpty(u.City) && !string.IsNullOrEmpty(u.State)
                        ? $"{u.City}, {u.State}"
                        : u.City ?? u.State,
                    IsFriend = friendUserIds.Contains(u.Id),
                    HasPendingRequest = pendingRequestUserIds.Contains(u.Id)
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<PlayerSearchResultDto>> { Success = true, Data = users });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching players");
            return StatusCode(500, new ApiResponse<List<PlayerSearchResultDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /friends/requests/pending - Get pending friend requests received
    [HttpGet("requests/pending")]
    public async Task<ActionResult<ApiResponse<List<FriendRequestDto>>>> GetPendingRequests()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "User not authenticated" });

            var requests = await _context.FriendRequests
                .Include(fr => fr.Sender)
                .Where(fr => fr.RecipientId == userId.Value && fr.Status == "Pending")
                .OrderByDescending(fr => fr.CreatedAt)
                .Select(fr => new FriendRequestDto
                {
                    Id = fr.Id,
                    Status = fr.Status,
                    Message = fr.Message,
                    CreatedAt = fr.CreatedAt,
                    Sender = new UserSummaryDto
                    {
                        Id = fr.Sender!.Id,
                        Name = $"{fr.Sender.FirstName} {fr.Sender.LastName}".Trim(),
                        ProfileImageUrl = fr.Sender.ProfileImageUrl,
                        ExperienceLevel = fr.Sender.ExperienceLevel,
                        PlayingStyle = fr.Sender.PlayingStyle,
                        Location = !string.IsNullOrEmpty(fr.Sender.City) && !string.IsNullOrEmpty(fr.Sender.State)
                            ? $"{fr.Sender.City}, {fr.Sender.State}"
                            : fr.Sender.City ?? fr.Sender.State
                    }
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = requests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching pending requests");
            return StatusCode(500, new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /friends/requests/sent - Get sent friend requests awaiting response
    [HttpGet("requests/sent")]
    public async Task<ActionResult<ApiResponse<List<FriendRequestDto>>>> GetSentRequests()
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "User not authenticated" });

            var requests = await _context.FriendRequests
                .Include(fr => fr.Recipient)
                .Where(fr => fr.SenderId == userId.Value && fr.Status == "Pending")
                .OrderByDescending(fr => fr.CreatedAt)
                .Select(fr => new FriendRequestDto
                {
                    Id = fr.Id,
                    Status = fr.Status,
                    Message = fr.Message,
                    CreatedAt = fr.CreatedAt,
                    Recipient = new UserSummaryDto
                    {
                        Id = fr.Recipient!.Id,
                        Name = $"{fr.Recipient.FirstName} {fr.Recipient.LastName}".Trim(),
                        ProfileImageUrl = fr.Recipient.ProfileImageUrl,
                        ExperienceLevel = fr.Recipient.ExperienceLevel,
                        PlayingStyle = fr.Recipient.PlayingStyle,
                        Location = !string.IsNullOrEmpty(fr.Recipient.City) && !string.IsNullOrEmpty(fr.Recipient.State)
                            ? $"{fr.Recipient.City}, {fr.Recipient.State}"
                            : fr.Recipient.City ?? fr.Recipient.State
                    }
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<FriendRequestDto>> { Success = true, Data = requests });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching sent requests");
            return StatusCode(500, new ApiResponse<List<FriendRequestDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /friends/requests - Send a friend request
    [HttpPost("requests")]
    public async Task<ActionResult<ApiResponse<FriendRequestDto>>> SendFriendRequest([FromBody] SendFriendRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<FriendRequestDto> { Success = false, Message = "User not authenticated" });

            if (dto.RecipientId == userId.Value)
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Cannot send friend request to yourself" });

            // Check if recipient exists
            var recipient = await _context.Users.FindAsync(dto.RecipientId);
            if (recipient == null)
                return NotFound(new ApiResponse<FriendRequestDto> { Success = false, Message = "User not found" });

            // Check if already friends
            var existingFriendship = await _context.Friendships
                .AnyAsync(f => (f.UserId1 == Math.Min(userId.Value, dto.RecipientId) &&
                               f.UserId2 == Math.Max(userId.Value, dto.RecipientId)));
            if (existingFriendship)
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Already friends with this user" });

            // Check for existing pending request
            var existingRequest = await _context.FriendRequests
                .FirstOrDefaultAsync(fr =>
                    ((fr.SenderId == userId.Value && fr.RecipientId == dto.RecipientId) ||
                     (fr.SenderId == dto.RecipientId && fr.RecipientId == userId.Value)) &&
                    fr.Status == "Pending");

            if (existingRequest != null)
            {
                if (existingRequest.SenderId == dto.RecipientId)
                    return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "This user has already sent you a friend request" });
                return BadRequest(new ApiResponse<FriendRequestDto> { Success = false, Message = "Friend request already sent" });
            }

            var request = new FriendRequest
            {
                SenderId = userId.Value,
                RecipientId = dto.RecipientId,
                Message = dto.Message,
                Status = "Pending"
            };

            _context.FriendRequests.Add(request);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<FriendRequestDto>
            {
                Success = true,
                Message = "Friend request sent",
                Data = new FriendRequestDto { Id = request.Id, Status = request.Status, CreatedAt = request.CreatedAt }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending friend request");
            return StatusCode(500, new ApiResponse<FriendRequestDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /friends/requests/{id}/accept - Accept a friend request
    [HttpPost("requests/{id}/accept")]
    public async Task<ActionResult<ApiResponse<object>>> AcceptRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.RecipientId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Accepted";
            request.RespondedAt = DateTime.UtcNow;

            // Create friendship (ensure UserId1 < UserId2 for uniqueness)
            var friendship = new Friendship
            {
                UserId1 = Math.Min(request.SenderId, request.RecipientId),
                UserId2 = Math.Max(request.SenderId, request.RecipientId),
                OriginatingRequestId = request.Id
            };

            _context.Friendships.Add(friendship);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request accepted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error accepting friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /friends/requests/{id}/reject - Reject a friend request
    [HttpPost("requests/{id}/reject")]
    public async Task<ActionResult<ApiResponse<object>>> RejectRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.RecipientId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Rejected";
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request rejected" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /friends/requests/{id} - Cancel a sent friend request
    [HttpDelete("requests/{id}")]
    public async Task<ActionResult<ApiResponse<object>>> CancelRequest(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var request = await _context.FriendRequests.FindAsync(id);
            if (request == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Request not found" });

            if (request.SenderId != userId.Value)
                return Forbid();

            if (request.Status != "Pending")
                return BadRequest(new ApiResponse<object> { Success = false, Message = "Request is no longer pending" });

            request.Status = "Cancelled";
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend request cancelled" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling friend request");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /friends/{id} - Remove a friend
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> RemoveFriend(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<object> { Success = false, Message = "User not authenticated" });

            var friendship = await _context.Friendships.FindAsync(id);
            if (friendship == null)
                return NotFound(new ApiResponse<object> { Success = false, Message = "Friendship not found" });

            if (friendship.UserId1 != userId.Value && friendship.UserId2 != userId.Value)
                return Forbid();

            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<object> { Success = true, Message = "Friend removed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing friend");
            return StatusCode(500, new ApiResponse<object> { Success = false, Message = "An error occurred" });
        }
    }
}
