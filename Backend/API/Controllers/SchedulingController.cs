using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Services;
using Pickleball.Community.Controllers.Base;

namespace Pickleball.Community.API.Controllers;

/// <summary>
/// Server-side tournament scheduling with constraint solving.
/// Handles court assignment, time allocation, and conflict detection.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SchedulingController : EventControllerBase
{
    private readonly ISchedulingService _schedulingService;
    private readonly ILogger<SchedulingController> _logger;

    public SchedulingController(
        ApplicationDbContext context,
        ISchedulingService schedulingService,
        ILogger<SchedulingController> logger)
        : base(context)
    {
        _schedulingService = schedulingService;
        _logger = logger;
    }

    /// <summary>
    /// Generate a complete schedule for encounters in an event, division, or phase.
    /// Assigns courts and estimated start times respecting all constraints:
    /// player overlap, rest times, court groups, round dependencies.
    /// </summary>
    [HttpPost("generate")]
    public async Task<ActionResult<ApiResponse<ScheduleResult>>> GenerateSchedule([FromBody] ScheduleRequest request)
    {
        if (!await CanManageEventAsync(request.EventId))
            return Forbid();

        var result = await _schedulingService.GenerateScheduleAsync(request);

        if (!result.Success)
            return BadRequest(new ApiResponse<ScheduleResult> { Success = false, Message = result.Message, Data = result });

        return Ok(new ApiResponse<ScheduleResult>
        {
            Success = true,
            Message = result.Message,
            Data = result
        });
    }

    /// <summary>
    /// Validate a schedule for conflicts (player overlap, court double-booking, insufficient rest, round dependency).
    /// </summary>
    [HttpGet("validate/{eventId}")]
    public async Task<ActionResult<ApiResponse<ScheduleValidationResultNew>>> ValidateSchedule(
        int eventId, [FromQuery] int? divisionId = null)
    {
        if (!await CanManageEventAsync(eventId))
            return Forbid();

        var result = await _schedulingService.ValidateScheduleAsync(eventId, divisionId);

        return Ok(new ApiResponse<ScheduleValidationResultNew>
        {
            Success = true,
            Data = result
        });
    }

    /// <summary>
    /// Clear all schedule assignments (court + time) for a division or phase.
    /// Does not affect completed or in-progress encounters.
    /// </summary>
    [HttpPost("clear/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> ClearSchedule(
        int divisionId, [FromQuery] int? phaseId = null)
    {
        // Look up the division to get eventId for auth check
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var cleared = await _schedulingService.ClearScheduleAsync(divisionId, phaseId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Message = $"Cleared schedule for {cleared} encounters",
            Data = new { ClearedCount = cleared }
        });
    }

    /// <summary>
    /// Auto-assign a single encounter to the best available court and time.
    /// Used during game day for on-the-fly scheduling.
    /// </summary>
    [HttpPost("assign-single/{encounterId}")]
    public async Task<ActionResult<ApiResponse<ScheduleResult>>> AssignSingleEncounter(int encounterId)
    {
        var encounter = await _context.EventEncounters.FindAsync(encounterId);
        if (encounter == null)
            return NotFound(new ApiResponse<ScheduleResult> { Success = false, Message = "Encounter not found" });

        if (!await CanManageEventAsync(encounter.EventId))
            return Forbid();

        var result = await _schedulingService.AssignSingleEncounterAsync(encounterId);

        if (!result.Success)
            return BadRequest(new ApiResponse<ScheduleResult> { Success = false, Message = result.Message, Data = result });

        return Ok(new ApiResponse<ScheduleResult>
        {
            Success = true,
            Message = result.Message,
            Data = result
        });
    }

    /// <summary>
    /// Get available courts for a division/phase based on court group assignments.
    /// </summary>
    [HttpGet("available-courts/{divisionId}")]
    public async Task<ActionResult<ApiResponse<object>>> GetAvailableCourts(
        int divisionId, [FromQuery] int? phaseId = null)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return NotFound(new ApiResponse<object> { Success = false, Message = "Division not found" });

        if (!await CanManageEventAsync(division.EventId))
            return Forbid();

        var courts = await _schedulingService.GetAvailableCourtsAsync(divisionId, phaseId);

        return Ok(new ApiResponse<object>
        {
            Success = true,
            Data = courts.Select(c => new
            {
                c.Id,
                c.CourtLabel,
                c.Status,
                c.SortOrder,
                c.IsActive
            })
        });
    }
}
