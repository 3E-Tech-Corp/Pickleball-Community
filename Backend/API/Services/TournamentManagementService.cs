using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Services;

public interface ITournamentManagementService
{
    Task<ServiceResult<EventDetailWithDivisionsDto>> GetEventDetailsAsync(int eventId, int? userId);
    Task<ServiceResult<TournamentDashboardDto>> GetTournamentDashboardAsync(int eventId);
    Task<ServiceResult<bool>> UpdateTournamentStatusAsync(int eventId, string status);
    Task<ServiceResult<object>> ResetTournamentAsync(int eventId, int userId);
    Task<ServiceResult<List<ScoreFormatDto>>> GetScoreFormatsAsync();
    Task<ServiceResult<List<ScoreMethodDto>>> GetScoreMethodsAsync();
    Task<ServiceResult<ScoreFormatDto>> CreateScoreFormatAsync(CreateScoreFormatRequest request);
    Task<ServiceResult<CheckInStatusDto>> CheckInAsync(int eventId, int userId, CheckInRequest request);
    Task<ServiceResult<List<CheckInStatusDto>>> GetAllCheckInStatusAsync(int eventId);

    // Court blocks
    Task<ServiceResult<List<DivisionCourtBlockDto>>> GetDivisionCourtBlocksAsync(int divisionId);
    Task<ServiceResult<DivisionCourtBlockDto>> CreateDivisionCourtBlockAsync(int divisionId, int userId, CreateDivisionCourtBlockDto dto);
    Task<ServiceResult<DivisionCourtBlockDto>> UpdateDivisionCourtBlockAsync(int divisionId, int blockId, int userId, UpdateDivisionCourtBlockDto dto);
    Task<ServiceResult<bool>> DeleteDivisionCourtBlockAsync(int divisionId, int blockId, int userId);
    Task<ServiceResult<List<DivisionCourtBlockDto>>> BulkUpdateDivisionCourtBlocksAsync(int divisionId, int userId, BulkUpdateDivisionCourtBlocksDto dto);

    // Tournament courts
    Task<ServiceResult<List<TournamentCourtDto>>> GetTournamentCourtsAsync(int eventId);
    Task<ServiceResult<TournamentCourtDto>> CreateTournamentCourtAsync(int eventId, CreateTournamentCourtRequest request);
    Task<ServiceResult<List<TournamentCourtDto>>> BulkCreateCourtsAsync(int eventId, BulkCreateCourtsRequest request);
}

public class TournamentManagementService : ITournamentManagementService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentManagementService> _logger;

    public TournamentManagementService(
        ApplicationDbContext context,
        ILogger<TournamentManagementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ServiceResult<List<ScoreFormatDto>>> GetScoreFormatsAsync()
    {
        var formats = await _context.ScoreFormats
            .Where(f => f.IsActive)
            .OrderBy(f => f.SortOrder)
            .Select(f => new ScoreFormatDto
            {
                Id = f.Id,
                Name = f.Name,
                Description = f.Description,
                ScoringType = f.ScoringType,
                MaxPoints = f.MaxPoints,
                WinByMargin = f.WinByMargin,
                SwitchEndsAtMidpoint = f.SwitchEndsAtMidpoint,
                MidpointScore = f.MidpointScore,
                TimeLimitMinutes = f.TimeLimitMinutes,
                IsTiebreaker = f.IsTiebreaker,
                IsDefault = f.IsDefault
            })
            .ToListAsync();

        return ServiceResult<List<ScoreFormatDto>>.Ok(formats);
    }

    public async Task<ServiceResult<List<ScoreMethodDto>>> GetScoreMethodsAsync()
    {
        var methods = await _context.ScoreMethods
            .Where(m => m.IsActive)
            .OrderBy(m => m.SortOrder)
            .Select(m => new ScoreMethodDto
            {
                Id = m.Id,
                Name = m.Name,
                Description = m.Description,
                BaseType = m.BaseType,
                SortOrder = m.SortOrder,
                IsActive = m.IsActive,
                IsDefault = m.IsDefault
            })
            .ToListAsync();

        return ServiceResult<List<ScoreMethodDto>>.Ok(methods);
    }

    public async Task<ServiceResult<ScoreFormatDto>> CreateScoreFormatAsync(CreateScoreFormatRequest request)
    {
        var format = new ScoreFormat
        {
            Name = request.Name,
            Description = request.Description,
            ScoreMethodId = request.ScoreMethodId,
            ScoringType = request.ScoringType ?? "Rally",
            MaxPoints = request.MaxPoints ?? 11,
            WinByMargin = request.WinByMargin ?? 2,
            CapAfter = request.CapAfter ?? 0,
            SwitchEndsAtMidpoint = request.SwitchEndsAtMidpoint ?? false,
            MidpointScore = request.MidpointScore,
            TimeLimitMinutes = request.TimeLimitMinutes,
            IsTiebreaker = request.IsTiebreaker ?? false,
            IsDefault = false,
            IsActive = true,
            SortOrder = 100,
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _context.ScoreFormats.Add(format);
        await _context.SaveChangesAsync();

        return ServiceResult<ScoreFormatDto>.Ok(new ScoreFormatDto
        {
            Id = format.Id,
            Name = format.Name,
            Description = format.Description,
            ScoreMethodId = format.ScoreMethodId,
            ScoringType = format.ScoringType,
            MaxPoints = format.MaxPoints,
            WinByMargin = format.WinByMargin,
            CapAfter = format.CapAfter,
            SwitchEndsAtMidpoint = format.SwitchEndsAtMidpoint,
            MidpointScore = format.MidpointScore,
            TimeLimitMinutes = format.TimeLimitMinutes,
            IsTiebreaker = format.IsTiebreaker,
            IsDefault = format.IsDefault
        });
    }

    public async Task<ServiceResult<EventDetailWithDivisionsDto>> GetEventDetailsAsync(int eventId, int? userId)
    {
        var evt = await _context.Events
            .Include(e => e.EventType)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.TeamUnit)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.SkillLevel)
            .Include(e => e.Divisions)
                .ThenInclude(d => d.AgeGroupEntity)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<EventDetailWithDivisionsDto>.NotFound("Event not found");

        var divisionIds = evt.Divisions.Select(d => d.Id).ToList();
        var divisionFees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => divisionIds.Contains(f.DivisionId))
            .ToListAsync();
        var feesByDivision = divisionFees.GroupBy(f => f.DivisionId).ToDictionary(g => g.Key, g => g.ToList());

        var registrationCounts = await _context.EventUnits
            .Where(u => u.EventId == eventId)
            .GroupBy(u => new { u.DivisionId, u.Status })
            .Select(g => new { g.Key.DivisionId, g.Key.Status, Count = g.Count() })
            .ToListAsync();

        var completedUnitCounts = await _context.EventUnits
            .Include(u => u.Members)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.EventId == eventId && u.Status != "Cancelled" && u.Status != "Waitlisted")
            .ToListAsync();

        var completedCountsByDivision = completedUnitCounts
            .GroupBy(u => u.DivisionId)
            .ToDictionary(
                g => g.Key,
                g => g.Count(u => {
                    var teamSize = u.Division?.TeamUnit?.TotalPlayers ?? u.Division?.TeamSize ?? 1;
                    return u.Members.Count(m => m.InviteStatus == "Accepted") >= teamSize;
                })
            );

        var userRegistrations = userId.HasValue
            ? await _context.EventUnitMembers
                .Where(m => m.User!.Id == userId && m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
                .Select(m => m.Unit!.DivisionId)
                .ToListAsync()
            : new List<int>();

        var lookingForPartner = await _context.EventUnits
            .Include(u => u.Members)
                .ThenInclude(m => m.User)
            .Include(u => u.Division)
                .ThenInclude(d => d!.TeamUnit)
            .Where(u => u.EventId == eventId && u.Status == "Registered")
            .ToListAsync();

        var incompleteUnits = lookingForPartner
            .Where(u => u.Division?.TeamUnit != null &&
                        u.Members.Count(m => m.InviteStatus == "Accepted") < u.Division.TeamUnit.TotalPlayers)
            .GroupBy(u => u.DivisionId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var now = DateTime.Now;
        var isRegistrationOpen = evt.TournamentStatus == "RegistrationOpen" ||
            (evt.RegistrationOpenDate <= now && (evt.RegistrationCloseDate == null || evt.RegistrationCloseDate > now));

        var dto = new EventDetailWithDivisionsDto
        {
            Id = evt.Id,
            Name = evt.Name,
            Description = evt.Description,
            EventTypeId = evt.EventTypeId,
            EventTypeName = evt.EventType?.Name,
            EventTypeIcon = evt.EventType?.Icon,
            EventTypeColor = evt.EventType?.Color,
            StartDate = evt.StartDate,
            EndDate = evt.EndDate,
            RegistrationOpenDate = evt.RegistrationOpenDate,
            RegistrationCloseDate = evt.RegistrationCloseDate,
            TournamentStatus = evt.TournamentStatus,
            IsRegistrationOpen = isRegistrationOpen,
            VenueName = evt.VenueName,
            Address = evt.Address,
            City = evt.City,
            State = evt.State,
            RegistrationFee = evt.RegistrationFee,
            PerDivisionFee = evt.PerDivisionFee,
            PosterImageUrl = evt.PosterImageUrl,
            UserRegisteredDivisionIds = userRegistrations,
            Divisions = evt.Divisions.Where(d => d.IsActive).OrderBy(d => d.SortOrder).Select(d =>
            {
                var regCount = registrationCounts
                    .Where(r => r.DivisionId == d.Id && r.Status != "Cancelled" && r.Status != "Waitlisted")
                    .Sum(r => r.Count);
                var waitlistCount = registrationCounts
                    .Where(r => r.DivisionId == d.Id && r.Status == "Waitlisted")
                    .Sum(r => r.Count);

                var completedCount = completedCountsByDivision.GetValueOrDefault(d.Id, 0);
                return new EventDivisionDetailDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Description = d.Description,
                    TeamUnitId = d.TeamUnitId,
                    TeamUnitName = d.TeamUnit?.Name,
                    TeamSize = d.TeamUnit?.TotalPlayers ?? d.TeamSize,
                    SkillLevelName = d.SkillLevel?.Name,
                    AgeGroupName = d.AgeGroupEntity?.Name,
                    DivisionFee = d.DivisionFee,
                    MaxUnits = d.MaxUnits,
                    RegisteredCount = regCount,
                    CompletedCount = completedCount,
                    WaitlistedCount = waitlistCount,
                    IsFull = d.MaxUnits.HasValue && completedCount >= d.MaxUnits.Value,
                    LookingForPartner = incompleteUnits.ContainsKey(d.Id)
                        ? incompleteUnits[d.Id].Select(u => MapToUnitDto(u)).ToList()
                        : new List<EventUnitDto>(),
                    Fees = feesByDivision.GetValueOrDefault(d.Id, new List<DivisionFee>())
                        .Where(f => f.IsActive).OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
                    {
                        Id = f.Id,
                        DivisionId = f.DivisionId,
                        Name = f.FeeType?.Name ?? f.Name,
                        Description = f.FeeType?.Description ?? f.Description,
                        Amount = f.Amount,
                        IsDefault = f.IsDefault,
                        AvailableFrom = f.AvailableFrom,
                        AvailableUntil = f.AvailableUntil,
                        IsActive = f.IsActive,
                        SortOrder = f.SortOrder,
                        IsCurrentlyAvailable = (!f.AvailableFrom.HasValue || f.AvailableFrom <= DateTime.UtcNow) &&
                                               (!f.AvailableUntil.HasValue || f.AvailableUntil > DateTime.UtcNow)
                    }).ToList()
                };
            }).ToList()
        };

        return ServiceResult<EventDetailWithDivisionsDto>.Ok(dto);
    }

    public async Task<ServiceResult<TournamentDashboardDto>> GetTournamentDashboardAsync(int eventId)
    {
        var evt = await _context.Events
            .Include(e => e.Divisions).ThenInclude(d => d.TeamUnit)
            .Include(e => e.Divisions).ThenInclude(d => d.SkillLevel)
            .Include(e => e.Divisions).ThenInclude(d => d.AgeGroupEntity)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (evt == null)
            return ServiceResult<TournamentDashboardDto>.NotFound("Event not found");

        var units = await _context.EventUnits
            .Include(u => u.Members)
            .Where(u => u.EventId == eventId)
            .ToListAsync();

        var matches = await _context.EventEncounters
            .Where(m => m.EventId == eventId)
            .ToListAsync();

        var games = await _context.EventGames
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit1).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Unit2).ThenInclude(u => u!.Members).ThenInclude(m => m.User)
            .Include(g => g.EncounterMatch).ThenInclude(m => m!.Encounter).ThenInclude(e => e!.Division)
            .Include(g => g.TournamentCourt)
            .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
            .ToListAsync();

        var courts = await _context.TournamentCourts
            .Where(c => c.EventId == eventId && c.IsActive)
            .ToListAsync();

        string GetPlayerNames(EventUnit? unit)
        {
            if (unit?.Members == null || !unit.Members.Any()) return unit?.Name ?? "TBD";
            return string.Join(" / ", unit.Members.Where(m => m.User != null).Select(m => m.User!.FirstName));
        }

        CourtGameInfoDto? BuildGameInfo(EventGame? game)
        {
            if (game == null) return null;
            var encounter = game.EncounterMatch?.Encounter;
            return new CourtGameInfoDto
            {
                GameId = game.Id,
                EncounterId = encounter?.Id,
                Unit1Name = encounter?.Unit1?.Name,
                Unit2Name = encounter?.Unit2?.Name,
                Unit1Players = GetPlayerNames(encounter?.Unit1),
                Unit2Players = GetPlayerNames(encounter?.Unit2),
                Unit1Score = game.Unit1Score,
                Unit2Score = game.Unit2Score,
                Status = game.Status,
                StartedAt = game.StartedAt,
                QueuedAt = game.QueuedAt,
                DivisionName = encounter?.Division?.Name,
                RoundName = encounter?.RoundName,
                GameNumber = game.GameNumber
            };
        }

        var activeUnits = units.Where(u => u.Status != "Cancelled").ToList();
        var paymentsSubmitted = activeUnits.Count(u => !string.IsNullOrEmpty(u.PaymentProofUrl) || !string.IsNullOrEmpty(u.PaymentReference));
        var paymentsPaid = activeUnits.Count(u => u.PaymentStatus == "Paid");
        var paymentsPending = activeUnits.Count(u => u.PaymentStatus == "Pending" || u.PaymentStatus == "PendingVerification" || u.PaymentStatus == "Partial");

        var dashboard = new TournamentDashboardDto
        {
            EventId = eventId,
            EventName = evt.Name,
            TournamentStatus = evt.TournamentStatus,
            Stats = new TournamentStatsDto
            {
                TotalRegistrations = activeUnits.Count,
                CheckedInPlayers = units.SelectMany(u => u.Members).Count(m => m.IsCheckedIn),
                TotalMatches = matches.Count,
                CompletedMatches = matches.Count(m => m.Status == "Completed"),
                InProgressGames = games.Count(g => g.Status == "Playing" || g.Status == "Started"),
                AvailableCourts = courts.Count(c => c.Status == "Available"),
                InUseCourts = courts.Count(c => c.Status == "InUse"),
                PaymentsSubmitted = paymentsSubmitted,
                PaymentsPaid = paymentsPaid,
                PaymentsPending = paymentsPending,
                TotalAmountDue = activeUnits.Sum(u => evt.RegistrationFee + (evt.Divisions.FirstOrDefault(d => d.Id == u.DivisionId)?.DivisionFee ?? 0m)),
                TotalAmountPaid = activeUnits.Sum(u => u.AmountPaid)
            },
            Divisions = evt.Divisions.OrderBy(d => d.SortOrder).Select(d => new DivisionStatusDto
            {
                Id = d.Id,
                Name = d.Name,
                Description = d.Description,
                TeamUnitId = d.TeamUnitId,
                TeamUnitName = d.TeamUnit?.Name,
                SkillLevelId = d.SkillLevelId,
                SkillLevelName = d.SkillLevel?.Name,
                AgeGroupId = d.AgeGroupId,
                AgeGroupName = d.AgeGroupEntity?.Name,
                MaxUnits = d.MaxUnits ?? 0,
                MaxPlayers = d.MaxPlayers,
                DivisionFee = d.DivisionFee,
                IsActive = d.IsActive,
                RegisteredUnits = units.Count(u => u.DivisionId == d.Id && u.Status != "Cancelled"),
                WaitlistedUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "Waitlisted"),
                CheckedInUnits = units.Count(u => u.DivisionId == d.Id && u.Status == "CheckedIn"),
                TotalMatches = matches.Count(m => m.DivisionId == d.Id),
                CompletedMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "Completed"),
                InProgressMatches = matches.Count(m => m.DivisionId == d.Id && m.Status == "InProgress"),
                ScheduleReady = matches.Any(m => m.DivisionId == d.Id),
                UnitsAssigned = units.Where(u => u.DivisionId == d.Id).All(u => u.UnitNumber.HasValue)
            }).ToList(),
            Courts = courts.Select(c =>
            {
                var currentGame = games.FirstOrDefault(g =>
                    g.TournamentCourtId == c.Id &&
                    (g.Status == "Playing" || g.Status == "Started" || g.Status == "InProgress"));

                var nextGame = games
                    .Where(g => g.TournamentCourtId == c.Id && g.Status == "Queued")
                    .OrderBy(g => g.QueuedAt ?? DateTime.MaxValue)
                    .FirstOrDefault();

                return new TournamentCourtDto
                {
                    Id = c.Id,
                    EventId = c.EventId,
                    CourtLabel = c.CourtLabel,
                    Status = c.Status,
                    CurrentGameId = c.CurrentGameId,
                    CurrentGame = BuildGameInfo(currentGame),
                    NextGame = BuildGameInfo(nextGame),
                    SortOrder = c.SortOrder
                };
            }).ToList()
        };

        return ServiceResult<TournamentDashboardDto>.Ok(dashboard);
    }

    public async Task<ServiceResult<bool>> UpdateTournamentStatusAsync(int eventId, string status)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<bool>.NotFound("Event not found");

        var validStatuses = new[] { "Draft", "RegistrationOpen", "RegistrationClosed", "ScheduleReady", "Drawing", "Running", "Completed", "Cancelled" };
        if (!validStatuses.Contains(status))
            return ServiceResult<bool>.Fail("Invalid status");

        evt.TournamentStatus = status;
        evt.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<object>> ResetTournamentAsync(int eventId, int userId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<object>.NotFound("Event not found");

        if (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId))
            return ServiceResult<object>.Forbidden();

        try
        {
            var units = await _context.EventUnits.Where(u => u.EventId == eventId).ToListAsync();
            foreach (var unit in units)
            {
                unit.UnitNumber = null;
                unit.PoolNumber = null;
                unit.PoolName = null;
                unit.Seed = null;
                unit.MatchesPlayed = 0;
                unit.MatchesWon = 0;
                unit.MatchesLost = 0;
                unit.GamesWon = 0;
                unit.GamesLost = 0;
                unit.PointsScored = 0;
                unit.PointsAgainst = 0;
                unit.PoolRank = null;
                unit.OverallRank = null;
                unit.AdvancedToPlayoff = false;
                unit.ManuallyAdvanced = false;
                unit.FinalPlacement = null;
                unit.UpdatedAt = DateTime.Now;
            }

            var encounters = await _context.EventEncounters
                .Where(e => e.EventId == eventId)
                .ToListAsync();
            foreach (var encounter in encounters)
            {
                encounter.WinnerUnitId = null;
                encounter.Status = "Scheduled";
                encounter.StartedAt = null;
                encounter.CompletedAt = null;
                encounter.TournamentCourtId = null;
                encounter.ScheduledTime = null;
                encounter.EstimatedStartTime = null;
                encounter.UpdatedAt = DateTime.Now;

                if (encounter.RoundType != "Pool")
                {
                    encounter.Unit1Id = null;
                    encounter.Unit2Id = null;
                }
            }

            var encounterMatches = await _context.EncounterMatches
                .Where(m => m.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var match in encounterMatches)
            {
                match.Unit1Score = 0;
                match.Unit2Score = 0;
                match.WinnerUnitId = null;
            }

            var games = await _context.EventGames
                .Where(g => g.EncounterMatch!.Encounter!.EventId == eventId)
                .ToListAsync();
            foreach (var game in games)
            {
                game.Unit1Score = 0;
                game.Unit2Score = 0;
                game.WinnerUnitId = null;
                game.Status = "Scheduled";
                game.TournamentCourtId = null;
                game.QueuedAt = null;
                game.StartedAt = null;
                game.FinishedAt = null;
                game.ScoreSubmittedByUnitId = null;
                game.ScoreSubmittedAt = null;
                game.ScoreConfirmedByUnitId = null;
                game.ScoreConfirmedAt = null;
                game.UpdatedAt = DateTime.Now;
            }

            var courts = await _context.TournamentCourts.Where(c => c.EventId == eventId).ToListAsync();
            foreach (var court in courts)
            {
                court.CurrentGameId = null;
                court.Status = "Available";
            }

            try
            {
                await _context.Database.ExecuteSqlRawAsync(@"
                    DELETE h FROM EventGameScoreHistories h
                    INNER JOIN EventGames g ON h.GameId = g.Id
                    INNER JOIN EncounterMatches m ON g.EncounterMatchId = m.Id
                    INNER JOIN EventEncounters e ON m.EncounterId = e.Id
                    WHERE e.EventId = {0}", eventId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete score histories for event {EventId} - table may not exist", eventId);
            }

            await _context.Database.ExecuteSqlRawAsync(@"
                DELETE FROM Notifications
                WHERE (ReferenceType = 'Event' AND ReferenceId = {0})
                OR (ReferenceType = 'Game' AND ReferenceId IN (
                    SELECT g.Id FROM EventGames g
                    INNER JOIN EncounterMatches m ON g.EncounterMatchId = m.Id
                    INNER JOIN EventEncounters e ON m.EncounterId = e.Id
                    WHERE e.EventId = {0}
                ))", eventId);

            var divisions = await _context.EventDivisions.Where(d => d.EventId == eventId).ToListAsync();
            foreach (var division in divisions)
            {
                division.DrawingInProgress = false;
                division.DrawingSequence = 0;
                division.DrawingStartedAt = null;
                division.DrawingByUserId = null;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Tournament {EventId} reset by user {UserId}", eventId, userId);

            return ServiceResult<object>.Ok(
                null!,
                "Tournament data has been reset. Drawing results, game scores, and court assignments have been cleared. Schedule structure is preserved."
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resetting tournament {EventId}", eventId);
            return ServiceResult<object>.ServerError("Failed to reset tournament: " + ex.Message);
        }
    }

    public async Task<ServiceResult<CheckInStatusDto>> CheckInAsync(int eventId, int userId, CheckInRequest request)
    {
        var members = await _context.EventUnitMembers
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.UserId == userId &&
                        m.Unit!.EventId == eventId &&
                        m.InviteStatus == "Accepted" &&
                        (request.DivisionId == null || m.Unit.DivisionId == request.DivisionId))
            .ToListAsync();

        foreach (var member in members)
        {
            member.IsCheckedIn = true;
            member.CheckedInAt = DateTime.Now;

            var allCheckedIn = await _context.EventUnitMembers
                .Where(m => m.UnitId == member.UnitId && m.InviteStatus == "Accepted")
                .AllAsync(m => m.IsCheckedIn);

            if (allCheckedIn && member.Unit != null)
            {
                member.Unit.Status = "CheckedIn";
                member.Unit.UpdatedAt = DateTime.Now;
            }
        }

        await _context.SaveChangesAsync();

        // Build check-in status for this user
        var userMembers = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.UserId == userId && m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .ToListAsync();

        var status = new CheckInStatusDto
        {
            EventId = eventId,
            UserId = userId,
            UserName = userMembers.FirstOrDefault()?.User != null
                ? Utility.FormatName(userMembers.First().User!.LastName, userMembers.First().User!.FirstName) : null,
            ProfileImageUrl = userMembers.FirstOrDefault()?.User?.ProfileImageUrl,
            IsCheckedIn = userMembers.All(m => m.IsCheckedIn),
            CheckedInAt = userMembers.Where(m => m.IsCheckedIn).Min(m => m.CheckedInAt),
            Divisions = userMembers.Select(m => new DivisionCheckInDto
            {
                DivisionId = m.Unit!.DivisionId,
                DivisionName = m.Unit.Division?.Name ?? "",
                UnitId = m.UnitId,
                UnitName = m.Unit.Name,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList()
        };

        return ServiceResult<CheckInStatusDto>.Ok(status);
    }

    public async Task<ServiceResult<List<CheckInStatusDto>>> GetAllCheckInStatusAsync(int eventId)
    {
        var members = await _context.EventUnitMembers
            .Include(m => m.User)
            .Include(m => m.Unit)
                .ThenInclude(u => u!.Division)
            .Where(m => m.Unit!.EventId == eventId && m.InviteStatus == "Accepted")
            .ToListAsync();

        var grouped = members.GroupBy(m => m.UserId);

        var result = grouped.Select(g => new CheckInStatusDto
        {
            EventId = eventId,
            UserId = g.Key,
            UserName = Utility.FormatName(g.First().User?.LastName, g.First().User?.FirstName),
            ProfileImageUrl = g.First().User?.ProfileImageUrl,
            IsCheckedIn = g.All(m => m.IsCheckedIn),
            CheckedInAt = g.Where(m => m.IsCheckedIn).Min(m => m.CheckedInAt),
            Divisions = g.Select(m => new DivisionCheckInDto
            {
                DivisionId = m.Unit!.DivisionId,
                DivisionName = m.Unit.Division?.Name ?? "",
                UnitId = m.UnitId,
                UnitName = m.Unit.Name,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt
            }).ToList()
        }).ToList();

        return ServiceResult<List<CheckInStatusDto>>.Ok(result);
    }

    // ===== Tournament Courts =====

    public async Task<ServiceResult<List<TournamentCourtDto>>> GetTournamentCourtsAsync(int eventId)
    {
        var courts = await _context.TournamentCourts
            .Include(c => c.Venue)
            .Include(c => c.CurrentGame)
                .ThenInclude(g => g!.EncounterMatch)
                    .ThenInclude(m => m!.Encounter)
            .Where(c => c.EventId == eventId && c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Select(c => new TournamentCourtDto
            {
                Id = c.Id,
                EventId = c.EventId,
                VenueId = c.VenueId,
                VenueName = c.Venue != null ? c.Venue.Name : null,
                CourtLabel = c.CourtLabel,
                Status = c.Status,
                CurrentGameId = c.CurrentGameId,
                LocationDescription = c.LocationDescription,
                SortOrder = c.SortOrder
            })
            .ToListAsync();

        return ServiceResult<List<TournamentCourtDto>>.Ok(courts);
    }

    public async Task<ServiceResult<TournamentCourtDto>> CreateTournamentCourtAsync(int eventId, CreateTournamentCourtRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<TournamentCourtDto>.NotFound("Event not found");

        var court = new TournamentCourt
        {
            EventId = eventId,
            VenueId = request.VenueId,
            CourtLabel = request.CourtLabel,
            LocationDescription = request.LocationDescription,
            SortOrder = request.SortOrder,
            Status = "Available",
            IsActive = true
        };

        _context.TournamentCourts.Add(court);
        await _context.SaveChangesAsync();

        return ServiceResult<TournamentCourtDto>.Ok(new TournamentCourtDto
        {
            Id = court.Id,
            EventId = court.EventId,
            VenueId = court.VenueId,
            CourtLabel = court.CourtLabel,
            Status = court.Status,
            LocationDescription = court.LocationDescription,
            SortOrder = court.SortOrder
        });
    }

    public async Task<ServiceResult<List<TournamentCourtDto>>> BulkCreateCourtsAsync(int eventId, BulkCreateCourtsRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<List<TournamentCourtDto>>.NotFound("Event not found");

        if (request.NumberOfCourts <= 0 || request.NumberOfCourts > 100)
            return ServiceResult<List<TournamentCourtDto>>.Fail("Number of courts must be between 1 and 100");

        var maxSortOrder = await _context.TournamentCourts
            .Where(c => c.EventId == eventId)
            .MaxAsync(c => (int?)c.SortOrder) ?? 0;

        var prefix = string.IsNullOrWhiteSpace(request.LabelPrefix) ? "Court" : request.LabelPrefix.Trim();
        var courts = new List<TournamentCourt>();

        for (int i = 0; i < request.NumberOfCourts; i++)
        {
            var courtNumber = request.StartingNumber + i;
            var court = new TournamentCourt
            {
                EventId = eventId,
                CourtLabel = $"{prefix} {courtNumber}",
                SortOrder = maxSortOrder + i + 1,
                Status = "Available",
                IsActive = true
            };
            courts.Add(court);
            _context.TournamentCourts.Add(court);
        }

        await _context.SaveChangesAsync();

        var result = courts.Select(c => new TournamentCourtDto
        {
            Id = c.Id,
            EventId = c.EventId,
            CourtLabel = c.CourtLabel,
            Status = c.Status,
            SortOrder = c.SortOrder
        }).ToList();

        return ServiceResult<List<TournamentCourtDto>>.Ok(result, $"Created {courts.Count} court{(courts.Count > 1 ? "s" : "")}");
    }

    // ===== Court Blocks =====

    public async Task<ServiceResult<List<DivisionCourtBlockDto>>> GetDivisionCourtBlocksAsync(int divisionId)
    {
        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId && b.IsActive)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return ServiceResult<List<DivisionCourtBlockDto>>.Ok(blocks);
    }

    public async Task<ServiceResult<DivisionCourtBlockDto>> CreateDivisionCourtBlockAsync(int divisionId, int userId, CreateDivisionCourtBlockDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return ServiceResult<DivisionCourtBlockDto>.NotFound("Division not found");

        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId)))
            return ServiceResult<DivisionCourtBlockDto>.Forbidden();

        var court = await _context.TournamentCourts.FindAsync(dto.TournamentCourtId);
        if (court == null || court.EventId != division.EventId)
            return ServiceResult<DivisionCourtBlockDto>.Fail("Invalid court");

        var existing = await _context.DivisionCourtBlocks
            .FirstOrDefaultAsync(b => b.DivisionId == divisionId && b.TournamentCourtId == dto.TournamentCourtId);
        if (existing != null)
            return ServiceResult<DivisionCourtBlockDto>.Fail("Court is already assigned to this division");

        var block = new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = dto.TournamentCourtId,
            Priority = dto.Priority,
            IntendedStartTime = dto.IntendedStartTime,
            IntendedEndTime = dto.IntendedEndTime,
            Notes = dto.Notes
        };

        _context.DivisionCourtBlocks.Add(block);
        await _context.SaveChangesAsync();

        await _context.Entry(block).Reference(b => b.TournamentCourt).LoadAsync();
        await _context.Entry(block).Reference(b => b.Division).LoadAsync();

        return ServiceResult<DivisionCourtBlockDto>.Ok(new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        });
    }

    public async Task<ServiceResult<DivisionCourtBlockDto>> UpdateDivisionCourtBlockAsync(int divisionId, int blockId, int userId, UpdateDivisionCourtBlockDto dto)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .Include(b => b.TournamentCourt)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return ServiceResult<DivisionCourtBlockDto>.NotFound("Court block not found");

        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId)))
            return ServiceResult<DivisionCourtBlockDto>.Forbidden();

        if (dto.Priority.HasValue) block.Priority = dto.Priority.Value;
        if (dto.IntendedStartTime.HasValue) block.IntendedStartTime = dto.IntendedStartTime;
        if (dto.IntendedEndTime.HasValue) block.IntendedEndTime = dto.IntendedEndTime;
        if (dto.Notes != null) block.Notes = dto.Notes;
        if (dto.IsActive.HasValue) block.IsActive = dto.IsActive.Value;

        block.UpdatedAt = DateTime.Now;
        await _context.SaveChangesAsync();

        return ServiceResult<DivisionCourtBlockDto>.Ok(new DivisionCourtBlockDto
        {
            Id = block.Id,
            DivisionId = block.DivisionId,
            DivisionName = block.Division?.Name,
            TournamentCourtId = block.TournamentCourtId,
            CourtLabel = block.TournamentCourt?.CourtLabel,
            Priority = block.Priority,
            IntendedStartTime = block.IntendedStartTime,
            IntendedEndTime = block.IntendedEndTime,
            Notes = block.Notes,
            IsActive = block.IsActive,
            CreatedAt = block.CreatedAt
        });
    }

    public async Task<ServiceResult<bool>> DeleteDivisionCourtBlockAsync(int divisionId, int blockId, int userId)
    {
        var block = await _context.DivisionCourtBlocks
            .Include(b => b.Division)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.DivisionId == divisionId);

        if (block == null)
            return ServiceResult<bool>.NotFound("Court block not found");

        var evt = await _context.Events.FindAsync(block.Division!.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId)))
            return ServiceResult<bool>.Forbidden();

        _context.DivisionCourtBlocks.Remove(block);
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<List<DivisionCourtBlockDto>>> BulkUpdateDivisionCourtBlocksAsync(int divisionId, int userId, BulkUpdateDivisionCourtBlocksDto dto)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return ServiceResult<List<DivisionCourtBlockDto>>.NotFound("Division not found");

        var evt = await _context.Events.FindAsync(division.EventId);
        if (evt == null || (evt.OrganizedByUserId != userId && !await IsAdminAsync(userId)))
            return ServiceResult<List<DivisionCourtBlockDto>>.Forbidden();

        var courtIds = dto.CourtBlocks.Select(b => b.TournamentCourtId).ToList();
        var validCourts = await _context.TournamentCourts
            .Where(c => courtIds.Contains(c.Id) && c.EventId == division.EventId)
            .Select(c => c.Id)
            .ToListAsync();

        var invalidCourts = courtIds.Except(validCourts).ToList();
        if (invalidCourts.Any())
            return ServiceResult<List<DivisionCourtBlockDto>>.Fail($"Invalid court IDs: {string.Join(", ", invalidCourts)}");

        var existingBlocks = await _context.DivisionCourtBlocks
            .Where(b => b.DivisionId == divisionId)
            .ToListAsync();
        _context.DivisionCourtBlocks.RemoveRange(existingBlocks);

        var newBlocks = dto.CourtBlocks.Select(b => new DivisionCourtBlock
        {
            DivisionId = divisionId,
            TournamentCourtId = b.TournamentCourtId,
            Priority = b.Priority,
            IntendedStartTime = b.IntendedStartTime,
            IntendedEndTime = b.IntendedEndTime,
            Notes = b.Notes
        }).ToList();

        _context.DivisionCourtBlocks.AddRange(newBlocks);
        await _context.SaveChangesAsync();

        var blocks = await _context.DivisionCourtBlocks
            .Include(b => b.TournamentCourt)
            .Include(b => b.Division)
            .Where(b => b.DivisionId == divisionId)
            .OrderBy(b => b.Priority)
            .Select(b => new DivisionCourtBlockDto
            {
                Id = b.Id,
                DivisionId = b.DivisionId,
                DivisionName = b.Division != null ? b.Division.Name : null,
                TournamentCourtId = b.TournamentCourtId,
                CourtLabel = b.TournamentCourt != null ? b.TournamentCourt.CourtLabel : null,
                Priority = b.Priority,
                IntendedStartTime = b.IntendedStartTime,
                IntendedEndTime = b.IntendedEndTime,
                Notes = b.Notes,
                IsActive = b.IsActive,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return ServiceResult<List<DivisionCourtBlockDto>>.Ok(blocks);
    }

    // ===== Helpers =====

    private async Task<bool> IsAdminAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        return user?.Role == "Admin";
    }

    private EventUnitDto MapToUnitDto(EventUnit u)
    {
        var teamUnit = u.Division?.TeamUnit;
        var requiredPlayers = teamUnit?.TotalPlayers ?? u.Division?.TeamSize ?? 1;

        return new EventUnitDto
        {
            Id = u.Id,
            EventId = u.EventId,
            EventName = u.Event?.Name,
            DivisionId = u.DivisionId,
            DivisionName = u.Division?.Name,
            Name = u.Name,
            DisplayName = Utility.GetUnitDisplayName(u, requiredPlayers),
            HasCustomName = u.HasCustomName,
            UnitNumber = u.UnitNumber,
            PoolNumber = u.PoolNumber,
            PoolName = u.PoolName,
            Seed = u.Seed,
            Status = u.Status,
            WaitlistPosition = u.WaitlistPosition,
            CaptainUserId = u.CaptainUserId,
            CaptainName = u.Members?.FirstOrDefault(m => m.UserId == u.CaptainUserId)?.User != null
                ? Utility.FormatName(u.Members!.First(m => m.UserId == u.CaptainUserId).User!.LastName, u.Members!.First(m => m.UserId == u.CaptainUserId).User!.FirstName)
                : null,
            CaptainProfileImageUrl = u.Members?.FirstOrDefault(m => m.UserId == u.CaptainUserId)?.User?.ProfileImageUrl,
            MatchesPlayed = u.MatchesPlayed,
            MatchesWon = u.MatchesWon,
            MatchesLost = u.MatchesLost,
            GamesWon = u.GamesWon,
            GamesLost = u.GamesLost,
            PointsScored = u.PointsScored,
            PointsAgainst = u.PointsAgainst,
            RequiredPlayers = requiredPlayers,
            IsComplete = u.Members?.Count(m => m.InviteStatus == "Accepted") >= requiredPlayers,
            AllCheckedIn = u.Members?.All(m => m.IsCheckedIn) ?? false,
            CreatedAt = u.CreatedAt,
            Members = u.Members?.Select(m => new EventUnitMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                FirstName = m.User?.FirstName,
                LastName = m.User?.LastName,
                ProfileImageUrl = m.User?.ProfileImageUrl,
                Role = m.Role,
                InviteStatus = m.InviteStatus,
                IsCheckedIn = m.IsCheckedIn,
                CheckedInAt = m.CheckedInAt,
                WaiverSigned = m.WaiverSignedAt.HasValue,
                WaiverSignedAt = m.WaiverSignedAt,
                HasPaid = m.HasPaid,
                PaidAt = m.PaidAt,
                AmountPaid = m.AmountPaid,
                PaymentProofUrl = m.PaymentProofUrl,
                PaymentReference = m.PaymentReference,
                ReferenceId = m.ReferenceId,
                PaymentMethod = m.PaymentMethod
            }).ToList() ?? new List<EventUnitMemberDto>()
        };
    }
}
