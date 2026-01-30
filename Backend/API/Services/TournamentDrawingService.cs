using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;
using Pickleball.Community.Hubs;

namespace Pickleball.Community.Services;

public interface ITournamentDrawingService
{
    Task<ServiceResult<DrawingStateDto>> GetDrawingStateAsync(int divisionId);
    Task<ServiceResult<DrawingStateDto>> StartDrawingAsync(int divisionId, int userId);
    Task<ServiceResult<DrawnUnitDto>> DrawNextUnitAsync(int divisionId, int userId);
    Task<ServiceResult<DrawingCompletedDto>> CompleteDrawingAsync(int divisionId, int userId);
    Task<ServiceResult<bool>> CancelDrawingAsync(int divisionId, int userId);
    Task<ServiceResult<EventDrawingStateDto>> GetEventDrawingStateAsync(int eventId, bool isOrganizer);
    Task<ServiceResult<bool>> StartDrawingModeAsync(int eventId, int userId);
    Task<ServiceResult<bool>> EndDrawingModeAsync(int eventId, int userId);
}

public class TournamentDrawingService : ITournamentDrawingService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentDrawingService> _logger;
    private readonly IDrawingBroadcaster _drawingBroadcaster;

    public TournamentDrawingService(
        ApplicationDbContext context,
        ILogger<TournamentDrawingService> logger,
        IDrawingBroadcaster drawingBroadcaster)
    {
        _context = context;
        _logger = logger;
        _drawingBroadcaster = drawingBroadcaster;
    }

    public async Task<ServiceResult<DrawingStateDto>> GetDrawingStateAsync(int divisionId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return ServiceResult<DrawingStateDto>.NotFound("Division not found");

        if (!division.DrawingInProgress)
            return ServiceResult<DrawingStateDto>.Ok(null!, "No drawing in progress");

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var drawnUnits = units
            .Where(u => u.UnitNumber.HasValue)
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber!.Value,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var remainingUnitNames = units
            .Where(u => !u.UnitNumber.HasValue)
            .Select(u => u.Name)
            .ToList();

        var startedBy = division.DrawingByUserId.HasValue
            ? await _context.Users.FindAsync(division.DrawingByUserId.Value)
            : null;

        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = division.Event?.Name ?? "",
            TotalUnits = units.Count,
            DrawnCount = drawnUnits.Count,
            DrawnUnits = drawnUnits,
            RemainingUnitNames = remainingUnitNames,
            StartedAt = division.DrawingStartedAt ?? DateTime.Now,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        return ServiceResult<DrawingStateDto>.Ok(state);
    }

    public async Task<ServiceResult<DrawingStateDto>> StartDrawingAsync(int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return ServiceResult<DrawingStateDto>.NotFound("Division not found");

        var evt = division.Event;
        if (evt == null)
            return ServiceResult<DrawingStateDto>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<DrawingStateDto>.Forbidden();

        if (division.DrawingInProgress)
            return ServiceResult<DrawingStateDto>.Fail("Drawing is already in progress");

        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        if (isRegistrationOpen)
            return ServiceResult<DrawingStateDto>.Fail("Cannot start drawing while registration is still open");

        if (division.ScheduleStatus == "Finalized")
            return ServiceResult<DrawingStateDto>.Fail("Schedule is already finalized. Clear the schedule first if you need to redraw.");

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        if (!units.Any())
            return ServiceResult<DrawingStateDto>.Fail("No units to draw");

        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        division.DrawingInProgress = true;
        division.DrawingStartedAt = DateTime.Now;
        division.DrawingByUserId = userId;
        division.DrawingSequence = 0;
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var startedBy = await _context.Users.FindAsync(userId);
        var state = new DrawingStateDto
        {
            DivisionId = division.Id,
            DivisionName = division.Name,
            EventId = division.EventId,
            EventName = evt.Name,
            TotalUnits = units.Count,
            DrawnCount = 0,
            DrawnUnits = new List<DrawnUnitDto>(),
            RemainingUnitNames = units.Select(u => u.Name).ToList(),
            StartedAt = division.DrawingStartedAt.Value,
            StartedByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null
        };

        await _drawingBroadcaster.BroadcastDrawingStarted(divisionId, state);
        await _drawingBroadcaster.BroadcastEventDrawingStarted(division.EventId, divisionId, state);

        return ServiceResult<DrawingStateDto>.Ok(state);
    }

    public async Task<ServiceResult<DrawnUnitDto>> DrawNextUnitAsync(int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return ServiceResult<DrawnUnitDto>.NotFound("Division not found");

        var evt = division.Event;
        if (evt == null)
            return ServiceResult<DrawnUnitDto>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<DrawnUnitDto>.Forbidden();

        var drawnUnitIdParam = new SqlParameter("@DrawnUnitId", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };
        var assignedNumberParam = new SqlParameter("@AssignedNumber", System.Data.SqlDbType.Int)
        {
            Direction = System.Data.ParameterDirection.Output
        };

        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "EXEC sp_DrawNextUnit @DivisionId, @DrawnUnitId OUTPUT, @AssignedNumber OUTPUT",
                new SqlParameter("@DivisionId", divisionId),
                drawnUnitIdParam,
                assignedNumberParam
            );
        }
        catch (SqlException ex)
        {
            if (ex.Message.Contains("Division not found"))
                return ServiceResult<DrawnUnitDto>.NotFound("Division not found");
            if (ex.Message.Contains("No drawing in progress"))
                return ServiceResult<DrawnUnitDto>.Fail("No drawing in progress. Start a drawing first.");
            if (ex.Message.Contains("No units remaining"))
                return ServiceResult<DrawnUnitDto>.Fail("All units have been drawn. Complete the drawing.");
            throw;
        }

        var drawnUnitId = (int)drawnUnitIdParam.Value;
        var assignedNumber = (int)assignedNumberParam.Value;

        var selectedUnit = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(u => u.Id == drawnUnitId);

        if (selectedUnit == null)
            return ServiceResult<DrawnUnitDto>.ServerError("Failed to retrieve drawn unit");

        var drawnUnit = new DrawnUnitDto
        {
            UnitId = selectedUnit.Id,
            UnitNumber = assignedNumber,
            UnitName = selectedUnit.Name,
            MemberNames = selectedUnit.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
            DrawnAt = DateTime.Now
        };

        await _drawingBroadcaster.BroadcastUnitDrawn(divisionId, drawnUnit);
        await _drawingBroadcaster.BroadcastEventUnitDrawn(division.EventId, divisionId, drawnUnit);

        return ServiceResult<DrawnUnitDto>.Ok(drawnUnit);
    }

    public async Task<ServiceResult<DrawingCompletedDto>> CompleteDrawingAsync(int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return ServiceResult<DrawingCompletedDto>.NotFound("Division not found");

        var evt = division.Event;
        if (evt == null)
            return ServiceResult<DrawingCompletedDto>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<DrawingCompletedDto>.Forbidden();

        if (!division.DrawingInProgress)
            return ServiceResult<DrawingCompletedDto>.Fail("No drawing in progress");

        var undrawnUnits = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted" && u.UnitNumber == null)
            .CountAsync();

        if (undrawnUnits > 0)
            return ServiceResult<DrawingCompletedDto>.Fail($"{undrawnUnits} units have not been drawn yet");

        var units = await _context.EventUnits
            .Include(u => u.Members).ThenInclude(m => m.User)
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var matches = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId)
            .ToListAsync();

        foreach (var match in matches)
        {
            match.Unit1Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit1Number)?.Id;
            match.Unit2Id = units.FirstOrDefault(u => u.UnitNumber == match.Unit2Number)?.Id;
            match.UpdatedAt = DateTime.Now;

            if (match.Unit1Id == null && match.Unit2Id != null)
            {
                match.WinnerUnitId = match.Unit2Id;
                match.Status = "Bye";
            }
            else if (match.Unit2Id == null && match.Unit1Id != null)
            {
                match.WinnerUnitId = match.Unit1Id;
                match.Status = "Bye";
            }
        }

        division.DrawingInProgress = false;
        division.ScheduleStatus = "UnitsAssigned";
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        var finalOrder = units
            .OrderBy(u => u.UnitNumber)
            .Select(u => new DrawnUnitDto
            {
                UnitId = u.Id,
                UnitNumber = u.UnitNumber ?? 0,
                UnitName = u.Name,
                MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                DrawnAt = u.UpdatedAt
            }).ToList();

        var result = new DrawingCompletedDto
        {
            DivisionId = divisionId,
            FinalOrder = finalOrder,
            CompletedAt = DateTime.Now
        };

        await _drawingBroadcaster.BroadcastDrawingCompleted(divisionId, result);
        await _drawingBroadcaster.BroadcastEventDrawingCompleted(division.EventId, divisionId, result);

        return ServiceResult<DrawingCompletedDto>.Ok(result);
    }

    public async Task<ServiceResult<bool>> CancelDrawingAsync(int divisionId, int userId)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
            return ServiceResult<bool>.NotFound("Division not found");

        var evt = division.Event;
        if (evt == null)
            return ServiceResult<bool>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<bool>.Forbidden();

        var hasUnitsAssigned = await _context.EventUnits
            .AnyAsync(u => u.DivisionId == divisionId
                && u.Status != "Cancelled" && u.Status != "Waitlisted"
                && u.UnitNumber != null);

        if (!division.DrawingInProgress && !hasUnitsAssigned)
        {
            await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
            await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);
            return ServiceResult<bool>.Ok(true, "Already reset");
        }

        var units = await _context.EventUnits
            .Where(u => u.DivisionId == divisionId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        foreach (var unit in units)
        {
            unit.UnitNumber = null;
            unit.PoolNumber = null;
            unit.PoolName = null;
        }

        var poolEncounters = await _context.EventEncounters
            .Where(m => m.DivisionId == divisionId && m.RoundType == "Pool")
            .ToListAsync();

        foreach (var encounter in poolEncounters)
        {
            encounter.Unit1Id = null;
            encounter.Unit2Id = null;
            encounter.WinnerUnitId = null;
            encounter.Status = "Scheduled";
            encounter.UpdatedAt = DateTime.Now;
        }

        division.DrawingInProgress = false;
        division.DrawingStartedAt = null;
        division.DrawingByUserId = null;
        division.DrawingSequence = 0;
        division.ScheduleStatus = "NotGenerated";
        division.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        await _drawingBroadcaster.BroadcastDrawingCancelled(divisionId);
        await _drawingBroadcaster.BroadcastEventDrawingCancelled(division.EventId, divisionId);

        return ServiceResult<bool>.Ok(true, "Drawing cancelled");
    }

    public async Task<ServiceResult<EventDrawingStateDto>> GetEventDrawingStateAsync(int eventId, bool isOrganizer)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<EventDrawingStateDto>.NotFound("Event not found");

        var divisions = await _context.EventDivisions
            .Include(d => d.TeamUnit)
            .Where(d => d.EventId == eventId)
            .OrderBy(d => d.Name)
            .ToListAsync();

        var divisionStates = new List<DivisionDrawingStateDto>();

        foreach (var division in divisions)
        {
            var units = await _context.EventUnits
                .Include(u => u.Members).ThenInclude(m => m.User)
                .Where(u => u.DivisionId == division.Id && u.Status != "Cancelled" && u.Status != "Waitlisted")
                .ToListAsync();

            var drawnUnits = units
                .Where(u => u.UnitNumber.HasValue)
                .OrderBy(u => u.UnitNumber)
                .Select(u => new DrawnUnitDto
                {
                    UnitId = u.Id,
                    UnitNumber = u.UnitNumber!.Value,
                    UnitName = u.Name,
                    MemberNames = u.Members.Where(m => m.InviteStatus == "Accepted" && m.User != null)
                        .Select(m => Utility.FormatName(m.User!.LastName, m.User.FirstName)).ToList(),
                    DrawnAt = u.UpdatedAt
                }).ToList();

            var remainingUnitNames = units
                .Where(u => !u.UnitNumber.HasValue)
                .Select(u => u.Name)
                .ToList();

            User? startedBy = null;
            if (division.DrawingByUserId.HasValue)
                startedBy = await _context.Users.FindAsync(division.DrawingByUserId.Value);

            var unitsWithMembers = units.Select(u => new DrawingUnitDto
            {
                UnitId = u.Id,
                UnitName = u.Name,
                UnitNumber = u.UnitNumber,
                Members = u.Members
                    .Where(m => m.InviteStatus == "Accepted" && m.User != null)
                    .Select(m => new DrawingMemberDto
                    {
                        UserId = m.UserId,
                        Name = Utility.FormatName(m.User!.LastName, m.User.FirstName) ?? "",
                        AvatarUrl = m.User.ProfileImageUrl
                    }).ToList()
            }).ToList();

            divisionStates.Add(new DivisionDrawingStateDto
            {
                DivisionId = division.Id,
                DivisionName = division.Name,
                TeamSize = division.TeamUnit?.TotalPlayers ?? division.TeamSize,
                ScheduleStatus = division.ScheduleStatus ?? "NotGenerated",
                DrawingInProgress = division.DrawingInProgress,
                DrawingStartedAt = division.DrawingStartedAt,
                DrawingByName = startedBy != null ? Utility.FormatName(startedBy.LastName, startedBy.FirstName) : null,
                TotalUnits = units.Count,
                DrawnCount = drawnUnits.Count,
                DrawnUnits = drawnUnits,
                RemainingUnitNames = remainingUnitNames,
                Units = unitsWithMembers
            });
        }

        var viewers = DrawingHub.GetEventViewers(eventId);

        var state = new EventDrawingStateDto
        {
            EventId = evt.Id,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus ?? "Draft",
            IsOrganizer = isOrganizer,
            Divisions = divisionStates,
            Viewers = viewers,
            ViewerCount = viewers.Count
        };

        return ServiceResult<EventDrawingStateDto>.Ok(state);
    }

    public async Task<ServiceResult<bool>> StartDrawingModeAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<bool>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<bool>.Forbidden();

        evt.TournamentStatus = "Drawing";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true, "Event is now in Drawing mode");
    }

    public async Task<ServiceResult<bool>> EndDrawingModeAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<bool>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<bool>.Forbidden();

        var divisions = await _context.EventDivisions
            .Where(d => d.EventId == eventId)
            .ToListAsync();

        var anyDrawingInProgress = divisions.Any(d => d.DrawingInProgress);
        if (anyDrawingInProgress)
            return ServiceResult<bool>.Fail("Cannot end drawing mode while a division drawing is in progress");

        evt.TournamentStatus = "Running";
        evt.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true, "Drawing mode ended, event is now Running");
    }

    private async Task<bool> IsAdminAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        return user?.Role == "Admin";
    }
}
