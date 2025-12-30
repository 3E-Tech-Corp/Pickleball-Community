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
public class CourtsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtsController> _logger;

    public CourtsController(ApplicationDbContext context, ILogger<CourtsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    // GET: /courts/search - Search for courts
    [HttpGet("search")]
    public async Task<ActionResult<ApiResponse<PagedResult<CourtDto>>>> SearchCourts([FromQuery] CourtSearchRequest request)
    {
        try
        {
            var query = _context.Courts.AsQueryable();

            // Filter by state if provided
            if (!string.IsNullOrWhiteSpace(request.State))
            {
                query = query.Where(c => c.State == request.State);
            }

            // Filter by city if provided (case-insensitive using EF.Functions.Like)
            if (!string.IsNullOrWhiteSpace(request.City))
            {
                var cityPattern = $"%{request.City}%";
                query = query.Where(c => c.City != null && EF.Functions.Like(c.City, cityPattern));
            }

            // Filter by lights if provided
            if (request.HasLights.HasValue && request.HasLights.Value)
            {
                query = query.Where(c => c.Lights == "Y");
            }

            // Filter by indoor courts if provided
            if (request.IsIndoor.HasValue && request.IsIndoor.Value)
            {
                query = query.Where(c => c.IndoorNum > 0);
            }

            // Text search if provided (case-insensitive using EF.Functions.Like)
            if (!string.IsNullOrWhiteSpace(request.Query))
            {
                var searchPattern = $"%{request.Query}%";
                query = query.Where(c =>
                    (c.Name != null && EF.Functions.Like(c.Name, searchPattern)) ||
                    (c.City != null && EF.Functions.Like(c.City, searchPattern)) ||
                    (c.Addr1 != null && EF.Functions.Like(c.Addr1, searchPattern)));
            }

            var courts = await query.ToListAsync();

            // Calculate distance if coordinates are provided
            List<(Court court, double? distance)> courtsWithDistance;
            if (request.Latitude.HasValue && request.Longitude.HasValue)
            {
                courtsWithDistance = courts
                    .Select(c =>
                    {
                        double? distance = null;
                        if (double.TryParse(c.GpsLat, out var lat) && double.TryParse(c.GpsLng, out var lng))
                        {
                            distance = CalculateDistance(request.Latitude.Value, request.Longitude.Value, lat, lng);
                        }
                        return (court: c, distance);
                    })
                    .Where(x => !request.RadiusMiles.HasValue || x.distance == null || x.distance <= request.RadiusMiles.Value)
                    .OrderBy(x => x.distance ?? double.MaxValue)
                    .ToList();
            }
            else
            {
                courtsWithDistance = courts.Select(c => (court: c, distance: (double?)null)).ToList();
            }

            // Get total count before pagination
            var totalCount = courtsWithDistance.Count;

            // Apply pagination
            var pagedCourts = courtsWithDistance
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();

            // Get aggregated info for courts (handle case where table may not exist yet)
            var courtIds = pagedCourts.Select(x => x.court.CourtId).ToList();
            List<CourtConfirmation> confirmations;
            try
            {
                confirmations = await _context.CourtConfirmations
                    .Where(cc => courtIds.Contains(cc.CourtId))
                    .ToListAsync();
            }
            catch
            {
                // Table may not exist yet
                confirmations = new List<CourtConfirmation>();
            }

            var confirmationsByCourtId = confirmations.GroupBy(c => c.CourtId).ToDictionary(g => g.Key, g => g.ToList());

            var courtDtos = pagedCourts.Select(x =>
            {
                var court = x.court;
                var courtConfirmations = confirmationsByCourtId.GetValueOrDefault(court.CourtId, new List<CourtConfirmation>());

                return new CourtDto
                {
                    CourtId = court.CourtId,
                    Name = court.Name,
                    Address = string.Join(" ", new[] { court.Addr1, court.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                    City = court.City,
                    County = court.County,
                    State = court.State,
                    Zip = court.Zip,
                    Country = court.Country,
                    Phone = court.Phone,
                    Website = court.Website,
                    Email = court.Email,
                    IndoorNum = court.IndoorNum,
                    OutdoorNum = court.OutdoorNum,
                    CoveredNum = court.CoveredNum,
                    HasLights = court.Lights == "Y",
                    Latitude = double.TryParse(court.GpsLat, out var lat) ? lat : null,
                    Longitude = double.TryParse(court.GpsLng, out var lng) ? lng : null,
                    Distance = x.distance,
                    AggregatedInfo = GetAggregatedInfo(courtConfirmations)
                };
            }).ToList();

            return Ok(new ApiResponse<PagedResult<CourtDto>>
            {
                Success = true,
                Data = new PagedResult<CourtDto>
                {
                    Items = courtDtos,
                    TotalCount = totalCount,
                    Page = request.Page,
                    PageSize = request.PageSize
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching courts");
            return StatusCode(500, new ApiResponse<PagedResult<CourtDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courts/{id} - Get court details
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CourtDetailDto>>> GetCourt(int id, [FromQuery] double? userLat, [FromQuery] double? userLng)
    {
        try
        {
            var court = await _context.Courts.FindAsync(id);
            if (court == null)
                return NotFound(new ApiResponse<CourtDetailDto> { Success = false, Message = "Court not found" });

            List<CourtConfirmation> confirmations;
            try
            {
                confirmations = await _context.CourtConfirmations
                    .Include(cc => cc.User)
                    .Where(cc => cc.CourtId == id)
                    .OrderByDescending(cc => cc.UpdatedAt)
                    .ToListAsync();
            }
            catch
            {
                // Table may not exist yet
                confirmations = new List<CourtConfirmation>();
            }

            double? distance = null;
            if (userLat.HasValue && userLng.HasValue &&
                double.TryParse(court.GpsLat, out var lat) && double.TryParse(court.GpsLng, out var lng))
            {
                distance = CalculateDistance(userLat.Value, userLng.Value, lat, lng);
            }

            var userId = GetCurrentUserId();

            var dto = new CourtDetailDto
            {
                CourtId = court.CourtId,
                Name = court.Name,
                Address = string.Join(" ", new[] { court.Addr1, court.Addr2 }.Where(a => !string.IsNullOrEmpty(a))),
                City = court.City,
                County = court.County,
                State = court.State,
                Zip = court.Zip,
                Country = court.Country,
                Phone = court.Phone,
                Website = court.Website,
                Email = court.Email,
                IndoorNum = court.IndoorNum,
                OutdoorNum = court.OutdoorNum,
                CoveredNum = court.CoveredNum,
                HasLights = court.Lights == "Y",
                Latitude = double.TryParse(court.GpsLat, out var courtLat) ? courtLat : null,
                Longitude = double.TryParse(court.GpsLng, out var courtLng) ? courtLng : null,
                Distance = distance,
                AggregatedInfo = GetAggregatedInfo(confirmations),
                RecentConfirmations = confirmations.Take(10).Select(cc => MapToConfirmationDto(cc)).ToList(),
                MyConfirmation = userId.HasValue
                    ? confirmations.Where(cc => cc.UserId == userId.Value).Select(cc => MapToConfirmationDto(cc)).FirstOrDefault()
                    : null
            };

            return Ok(new ApiResponse<CourtDetailDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court {CourtId}", id);
            return StatusCode(500, new ApiResponse<CourtDetailDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courts/{id}/confirmations - Submit or update court confirmation
    [HttpPost("{id}/confirmations")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourtConfirmationDto>>> SubmitConfirmation(int id, [FromBody] SubmitCourtConfirmationDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new ApiResponse<CourtConfirmationDto> { Success = false, Message = "User not authenticated" });

            var court = await _context.Courts.FindAsync(id);
            if (court == null)
                return NotFound(new ApiResponse<CourtConfirmationDto> { Success = false, Message = "Court not found" });

            // Check for existing confirmation
            var existingConfirmation = await _context.CourtConfirmations
                .FirstOrDefaultAsync(cc => cc.CourtId == id && cc.UserId == userId.Value);

            if (existingConfirmation != null)
            {
                // Update existing confirmation
                existingConfirmation.NameConfirmed = dto.NameConfirmed ?? existingConfirmation.NameConfirmed;
                existingConfirmation.SuggestedName = dto.SuggestedName ?? existingConfirmation.SuggestedName;
                existingConfirmation.ConfirmedIndoorCount = dto.ConfirmedIndoorCount ?? existingConfirmation.ConfirmedIndoorCount;
                existingConfirmation.ConfirmedOutdoorCount = dto.ConfirmedOutdoorCount ?? existingConfirmation.ConfirmedOutdoorCount;
                existingConfirmation.ConfirmedCoveredCount = dto.ConfirmedCoveredCount ?? existingConfirmation.ConfirmedCoveredCount;
                existingConfirmation.HasLights = dto.HasLights ?? existingConfirmation.HasLights;
                existingConfirmation.HasFee = dto.HasFee ?? existingConfirmation.HasFee;
                existingConfirmation.FeeAmount = dto.FeeAmount ?? existingConfirmation.FeeAmount;
                existingConfirmation.FeeNotes = dto.FeeNotes ?? existingConfirmation.FeeNotes;
                existingConfirmation.Hours = dto.Hours ?? existingConfirmation.Hours;
                existingConfirmation.Rating = dto.Rating ?? existingConfirmation.Rating;
                existingConfirmation.Notes = dto.Notes ?? existingConfirmation.Notes;
                existingConfirmation.SurfaceType = dto.SurfaceType ?? existingConfirmation.SurfaceType;
                if (dto.Amenities != null)
                    existingConfirmation.Amenities = string.Join(",", dto.Amenities);
                existingConfirmation.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<CourtConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation updated",
                    Data = MapToConfirmationDto(existingConfirmation)
                });
            }
            else
            {
                // Create new confirmation
                var confirmation = new CourtConfirmation
                {
                    CourtId = id,
                    UserId = userId.Value,
                    NameConfirmed = dto.NameConfirmed,
                    SuggestedName = dto.SuggestedName,
                    ConfirmedIndoorCount = dto.ConfirmedIndoorCount,
                    ConfirmedOutdoorCount = dto.ConfirmedOutdoorCount,
                    ConfirmedCoveredCount = dto.ConfirmedCoveredCount,
                    HasLights = dto.HasLights,
                    HasFee = dto.HasFee,
                    FeeAmount = dto.FeeAmount,
                    FeeNotes = dto.FeeNotes,
                    Hours = dto.Hours,
                    Rating = dto.Rating,
                    Notes = dto.Notes,
                    SurfaceType = dto.SurfaceType,
                    Amenities = dto.Amenities != null ? string.Join(",", dto.Amenities) : null
                };

                _context.CourtConfirmations.Add(confirmation);
                await _context.SaveChangesAsync();

                return Ok(new ApiResponse<CourtConfirmationDto>
                {
                    Success = true,
                    Message = "Confirmation submitted",
                    Data = MapToConfirmationDto(confirmation)
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting court confirmation");
            return StatusCode(500, new ApiResponse<CourtConfirmationDto> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courts/{id}/confirmations - Get all confirmations for a court
    [HttpGet("{id}/confirmations")]
    public async Task<ActionResult<ApiResponse<List<CourtConfirmationDto>>>> GetConfirmations(int id)
    {
        try
        {
            var confirmations = await _context.CourtConfirmations
                .Include(cc => cc.User)
                .Where(cc => cc.CourtId == id)
                .OrderByDescending(cc => cc.UpdatedAt)
                .ToListAsync();

            var dtos = confirmations.Select(cc => MapToConfirmationDto(cc)).ToList();
            return Ok(new ApiResponse<List<CourtConfirmationDto>> { Success = true, Data = dtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court confirmations");
            return StatusCode(500, new ApiResponse<List<CourtConfirmationDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courts/states - Get list of states with courts
    [HttpGet("states")]
    public async Task<ActionResult<ApiResponse<List<string>>>> GetStates()
    {
        try
        {
            var states = await _context.Courts
                .Where(c => c.State != null && c.State != "")
                .Select(c => c.State!)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Ok(new ApiResponse<List<string>> { Success = true, Data = states });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching states");
            return StatusCode(500, new ApiResponse<List<string>> { Success = false, Message = "An error occurred" });
        }
    }

    // Helper method to calculate distance between two points using Haversine formula
    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 3959; // Earth's radius in miles

        var lat1Rad = lat1 * Math.PI / 180;
        var lat2Rad = lat2 * Math.PI / 180;
        var deltaLat = (lat2 - lat1) * Math.PI / 180;
        var deltaLon = (lon2 - lon1) * Math.PI / 180;

        var a = Math.Sin(deltaLat / 2) * Math.Sin(deltaLat / 2) +
                Math.Cos(lat1Rad) * Math.Cos(lat2Rad) *
                Math.Sin(deltaLon / 2) * Math.Sin(deltaLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return R * c;
    }

    // Helper method to aggregate confirmation data
    private static CourtAggregatedInfoDto GetAggregatedInfo(List<CourtConfirmation> confirmations)
    {
        if (confirmations.Count == 0)
            return new CourtAggregatedInfoDto { ConfirmationCount = 0 };

        return new CourtAggregatedInfoDto
        {
            ConfirmationCount = confirmations.Count,
            AverageRating = confirmations.Where(c => c.Rating.HasValue).Any()
                ? confirmations.Where(c => c.Rating.HasValue).Average(c => c.Rating!.Value)
                : null,
            MostConfirmedIndoorCount = GetMostCommonValue(confirmations.Where(c => c.ConfirmedIndoorCount.HasValue).Select(c => c.ConfirmedIndoorCount!.Value)),
            MostConfirmedOutdoorCount = GetMostCommonValue(confirmations.Where(c => c.ConfirmedOutdoorCount.HasValue).Select(c => c.ConfirmedOutdoorCount!.Value)),
            MostConfirmedHasLights = GetMostCommonBool(confirmations.Where(c => c.HasLights.HasValue).Select(c => c.HasLights!.Value)),
            MostConfirmedHasFee = GetMostCommonBool(confirmations.Where(c => c.HasFee.HasValue).Select(c => c.HasFee!.Value)),
            CommonFeeAmount = GetMostCommonString(confirmations.Where(c => !string.IsNullOrEmpty(c.FeeAmount)).Select(c => c.FeeAmount!)),
            CommonHours = GetMostCommonString(confirmations.Where(c => !string.IsNullOrEmpty(c.Hours)).Select(c => c.Hours!)),
            CommonSurfaceType = GetMostCommonString(confirmations.Where(c => !string.IsNullOrEmpty(c.SurfaceType)).Select(c => c.SurfaceType!)),
            CommonAmenities = GetMostCommonAmenities(confirmations.Where(c => !string.IsNullOrEmpty(c.Amenities)).Select(c => c.Amenities!))
        };
    }

    private static int? GetMostCommonValue(IEnumerable<int> values)
    {
        var list = values.ToList();
        if (!list.Any()) return null;
        return list.GroupBy(v => v).OrderByDescending(g => g.Count()).First().Key;
    }

    private static bool? GetMostCommonBool(IEnumerable<bool> values)
    {
        var list = values.ToList();
        if (!list.Any()) return null;
        var trueCount = list.Count(v => v);
        return trueCount > list.Count / 2;
    }

    private static string? GetMostCommonString(IEnumerable<string> values)
    {
        var list = values.ToList();
        if (!list.Any()) return null;
        return list.GroupBy(v => v).OrderByDescending(g => g.Count()).First().Key;
    }

    private static List<string>? GetMostCommonAmenities(IEnumerable<string> amenityStrings)
    {
        var allAmenities = amenityStrings
            .SelectMany(s => s.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .Select(a => a.Trim().ToLower())
            .ToList();

        if (!allAmenities.Any()) return null;

        // Return amenities that appear in at least 30% of confirmations
        var totalConfirmations = amenityStrings.Count();
        var threshold = Math.Max(1, totalConfirmations * 0.3);

        return allAmenities
            .GroupBy(a => a)
            .Where(g => g.Count() >= threshold)
            .OrderByDescending(g => g.Count())
            .Select(g => g.Key)
            .ToList();
    }

    private static CourtConfirmationDto MapToConfirmationDto(CourtConfirmation cc)
    {
        return new CourtConfirmationDto
        {
            Id = cc.Id,
            CourtId = cc.CourtId,
            UserId = cc.UserId,
            UserName = cc.User != null ? $"{cc.User.FirstName} {cc.User.LastName}".Trim() : null,
            UserProfileImageUrl = cc.User?.ProfileImageUrl,
            NameConfirmed = cc.NameConfirmed,
            SuggestedName = cc.SuggestedName,
            ConfirmedIndoorCount = cc.ConfirmedIndoorCount,
            ConfirmedOutdoorCount = cc.ConfirmedOutdoorCount,
            ConfirmedCoveredCount = cc.ConfirmedCoveredCount,
            HasLights = cc.HasLights,
            HasFee = cc.HasFee,
            FeeAmount = cc.FeeAmount,
            FeeNotes = cc.FeeNotes,
            Hours = cc.Hours,
            Rating = cc.Rating,
            Notes = cc.Notes,
            SurfaceType = cc.SurfaceType,
            Amenities = cc.Amenities?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
            CreatedAt = cc.CreatedAt,
            UpdatedAt = cc.UpdatedAt
        };
    }
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}
