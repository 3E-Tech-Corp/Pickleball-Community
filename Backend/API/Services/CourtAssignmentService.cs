using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

public interface ICourtAssignmentService
{
    /// <summary>
    /// Auto-assign courts to encounters for a division
    /// </summary>
    Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options);

    /// <summary>
    /// Auto-assign courts to encounters for a phase
    /// </summary>
    Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId);

    /// <summary>
    /// Calculate estimated start times for encounters in a phase
    /// </summary>
    Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId);

    /// <summary>
    /// Clear all court and time assignments for a division
    /// </summary>
    Task<int> ClearDivisionAssignmentsAsync(int divisionId);

    /// <summary>
    /// Get available courts for a division based on court group assignments
    /// </summary>
    Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null);

    /// <summary>
    /// Calculate the estimated total duration of an encounter in minutes,
    /// accounting for multiple matches per encounter and phase-specific BestOf settings.
    /// </summary>
    Task<int> CalculateEncounterDurationMinutesAsync(EventEncounter encounter, EventDivision division, DivisionPhase? phase);
}

public class CourtAssignmentOptions
{
    public DateTime? StartTime { get; set; }
    /// <summary>
    /// Base duration per individual game in minutes.
    /// The total encounter duration is computed from this × BestOf × MatchesPerEncounter.
    /// If null, falls back to phase/division EstimatedMatchDurationMinutes.
    /// </summary>
    public int? GameDurationMinutes { get; set; }
    /// <summary>
    /// Deprecated alias for GameDurationMinutes (for backward compatibility)
    /// </summary>
    public int? MatchDurationMinutes { get => GameDurationMinutes; set => GameDurationMinutes = value; }
    public bool ClearExisting { get; set; } = true;
}

public class CourtAssignmentResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int AssignedCount { get; set; }
    public int CourtsUsed { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class TimeCalculationResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int UpdatedCount { get; set; }
    public DateTime? EstimatedEndTime { get; set; }
}

public class CourtAssignmentService : ICourtAssignmentService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtAssignmentService> _logger;

    public CourtAssignmentService(ApplicationDbContext context, ILogger<CourtAssignmentService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Calculate the estimated total duration of an encounter in minutes.
    /// Takes into account:
    /// 1. Multiple matches per encounter (from EncounterMatchFormat records or division.MatchesPerEncounter)
    /// 2. Per-phase BestOf overrides (from PhaseMatchSettings, then DivisionPhase.BestOf)
    /// 3. Per-match-format BestOf (from EncounterMatchFormat.BestOf)
    /// 4. Division default (GamesPerMatch)
    /// 
    /// Formula: encounter_duration = SUM over each match of (effectiveBestOf * gameDuration)
    /// For scheduling safety, we use worst-case (all games in BestOf series played).
    /// </summary>
    public async Task<int> CalculateEncounterDurationMinutesAsync(
        EventEncounter encounter, EventDivision division, DivisionPhase? phase)
    {
        // Base per-game duration: phase override > division override > 20 min default
        var gameDuration = phase?.EstimatedMatchDurationMinutes
            ?? division.EstimatedMatchDurationMinutes
            ?? 20;

        // Get match formats for this division (defines how many matches per encounter)
        var matchFormats = await _context.EncounterMatchFormats
            .Where(f => f.DivisionId == division.Id && f.IsActive)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        // Get phase-specific match settings (BestOf overrides per phase)
        List<PhaseMatchSettings>? phaseSettings = null;
        if (phase != null)
        {
            phaseSettings = await _context.PhaseMatchSettings
                .Where(s => s.PhaseId == phase.Id)
                .ToListAsync();
        }

        int totalDuration;

        if (matchFormats.Count > 0)
        {
            // Multi-match encounter: sum duration of each match format
            totalDuration = 0;
            foreach (var format in matchFormats)
            {
                // Resolve BestOf for this match in this phase:
                // 1. PhaseMatchSettings for this specific format (most specific)
                // 2. PhaseMatchSettings with null format (phase default)
                // 3. Phase.BestOf (phase-level default)
                // 4. EncounterMatchFormat.BestOf (format-level default)
                // 5. Division.GamesPerMatch (division default)
                // 6. 1
                var bestOf = ResolveEffectiveBestOf(format, phase, phaseSettings, division);

                totalDuration += bestOf * gameDuration;
            }
        }
        else if (division.MatchesPerEncounter > 1)
        {
            // Division says multiple matches but no explicit formats defined
            // Use phase/division BestOf for each match
            var bestOf = phase?.BestOf ?? division.GamesPerMatch;
            if (bestOf < 1) bestOf = 1;
            totalDuration = division.MatchesPerEncounter * bestOf * gameDuration;
        }
        else
        {
            // Simple single-match encounter
            var bestOf = phase?.BestOf ?? division.GamesPerMatch;
            if (bestOf < 1) bestOf = 1;
            totalDuration = bestOf * gameDuration;
        }

        return totalDuration;
    }

    /// <summary>
    /// Resolve the effective BestOf for a specific match format within a phase.
    /// Priority: PhaseMatchSettings(format) > PhaseMatchSettings(null) > Phase.BestOf > Format.BestOf > Division.GamesPerMatch > 1
    /// </summary>
    private static int ResolveEffectiveBestOf(
        EncounterMatchFormat format,
        DivisionPhase? phase,
        List<PhaseMatchSettings>? phaseSettings,
        EventDivision division)
    {
        if (phaseSettings != null && phaseSettings.Count > 0)
        {
            // Check for format-specific phase setting first
            var formatSetting = phaseSettings.FirstOrDefault(s => s.MatchFormatId == format.Id);
            if (formatSetting != null && formatSetting.BestOf > 0)
                return formatSetting.BestOf;

            // Check for phase-level default (null format)
            var phaseSetting = phaseSettings.FirstOrDefault(s => s.MatchFormatId == null);
            if (phaseSetting != null && phaseSetting.BestOf > 0)
                return phaseSetting.BestOf;
        }

        // Phase-level BestOf
        if (phase?.BestOf.HasValue == true && phase.BestOf.Value > 0)
            return phase.BestOf.Value;

        // Match format default
        if (format.BestOf > 0)
            return format.BestOf;

        // Division default
        if (division.GamesPerMatch > 0)
            return division.GamesPerMatch;

        return 1;
    }

    public async Task<CourtAssignmentResult> AutoAssignDivisionAsync(int divisionId, CourtAssignmentOptions options)
    {
        var division = await _context.EventDivisions
            .Include(d => d.Event)
            .FirstOrDefaultAsync(d => d.Id == divisionId);

        if (division == null)
        {
            return new CourtAssignmentResult { Success = false, Message = "Division not found" };
        }

        // Get available courts
        var availableCourts = await GetAvailableCourtsForDivisionAsync(divisionId);
        if (!availableCourts.Any())
        {
            // Fallback to all event courts if no groups assigned
            availableCourts = await _context.TournamentCourts
                .Where(c => c.EventId == division.EventId && c.IsActive)
                .OrderBy(c => c.SortOrder)
                .ToListAsync();
        }

        if (!availableCourts.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No courts available" };
        }

        // Get encounters to assign (include Phase for duration calculation)
        var encounterQuery = _context.EventEncounters
            .Include(e => e.Phase)
            .Where(e => e.DivisionId == divisionId && e.Status != "Bye" && e.Status != "Completed");

        if (!options.ClearExisting)
        {
            encounterQuery = encounterQuery.Where(e => e.TournamentCourtId == null);
        }

        var encounters = await encounterQuery
            .OrderBy(e => e.PhaseId).ThenBy(e => e.RoundNumber)
            .ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No encounters to assign" };
        }

        // Settings
        var startTime = options.StartTime ?? division.Event?.StartDate.Date.AddHours(8) ?? DateTime.Today.AddHours(8);

        // Pre-calculate encounter durations per phase (cache to avoid repeated DB queries)
        var phaseDurationCache = new Dictionary<int?, int>(); // phaseId -> encounter duration
        foreach (var encounter in encounters)
        {
            if (!phaseDurationCache.ContainsKey(encounter.PhaseId))
            {
                if (options.GameDurationMinutes.HasValue)
                {
                    // If caller provided explicit game duration, still factor in matches/BestOf
                    // but use their duration as the per-game base
                    var tempPhase = encounter.Phase;
                    if (tempPhase != null)
                        tempPhase = await _context.DivisionPhases.Include(p => p.Division)
                            .FirstOrDefaultAsync(p => p.Id == tempPhase.Id) ?? tempPhase;
                    // Override the phase/division duration with options value
                    var saved = division.EstimatedMatchDurationMinutes;
                    division.EstimatedMatchDurationMinutes = options.GameDurationMinutes.Value;
                    phaseDurationCache[encounter.PhaseId] = await CalculateEncounterDurationMinutesAsync(
                        encounter, division, encounter.Phase);
                    division.EstimatedMatchDurationMinutes = saved;
                }
                else
                {
                    phaseDurationCache[encounter.PhaseId] = await CalculateEncounterDurationMinutesAsync(
                        encounter, division, encounter.Phase);
                }
            }
        }

        // Track court availability
        var courtNextAvailable = availableCourts.ToDictionary(c => c.Id, c => startTime);

        // Assign courts and times
        int assigned = 0;
        foreach (var encounter in encounters)
        {
            var encounterDuration = phaseDurationCache[encounter.PhaseId];

            // Find the court available soonest
            var bestCourt = availableCourts
                .OrderBy(c => courtNextAvailable[c.Id])
                .ThenBy(c => c.SortOrder)
                .First();

            encounter.TournamentCourtId = bestCourt.Id;
            encounter.EstimatedStartTime = courtNextAvailable[bestCourt.Id];
            encounter.EstimatedDurationMinutes = encounterDuration;
            encounter.EstimatedEndTime = courtNextAvailable[bestCourt.Id].AddMinutes(encounterDuration);
            encounter.UpdatedAt = DateTime.Now;

            // Update court availability
            courtNextAvailable[bestCourt.Id] = courtNextAvailable[bestCourt.Id].AddMinutes(encounterDuration);
            assigned++;
        }

        await _context.SaveChangesAsync();

        var estimatedEndTime = courtNextAvailable.Values.Max();

        _logger.LogInformation(
            "Auto-assigned {Count} encounters for division {DivisionId} (multi-match/phase-aware durations)",
            assigned, divisionId);

        return new CourtAssignmentResult
        {
            Success = true,
            AssignedCount = assigned,
            CourtsUsed = availableCourts.Count,
            StartTime = startTime,
            EstimatedEndTime = estimatedEndTime,
            Message = $"{assigned} encounters assigned to {availableCourts.Count} courts"
        };
    }

    public async Task<CourtAssignmentResult> AutoAssignPhaseAsync(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
        {
            return new CourtAssignmentResult { Success = false, Message = "Phase not found" };
        }

        // Get court assignments for this phase (or division-level)
        var availableCourts = await GetAvailableCourtsForDivisionAsync(phase.DivisionId, phaseId);

        if (!availableCourts.Any())
        {
            return new CourtAssignmentResult { Success = false, Message = "No court groups assigned to this phase" };
        }

        // Get encounters without court assignments
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phaseId && e.TournamentCourtId == null)
            .OrderBy(e => e.PoolId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new CourtAssignmentResult { Success = true, AssignedCount = 0, Message = "No encounters to assign" };
        }

        // Calculate encounter duration for this phase (all encounters in same phase share duration)
        var encounterDuration = await CalculateEncounterDurationMinutesAsync(
            encounters.First(), phase.Division!, phase);

        // Track court availability with phase start time
        var startTime = phase.StartTime ?? DateTime.Today.AddHours(8);
        var courtNextAvailable = availableCourts.ToDictionary(c => c.Id, c => startTime);

        // Assign courts with time-aware scheduling
        int assigned = 0;
        foreach (var encounter in encounters)
        {
            // Find the court available soonest
            var bestCourt = availableCourts
                .OrderBy(c => courtNextAvailable[c.Id])
                .ThenBy(c => c.SortOrder)
                .First();

            encounter.TournamentCourtId = bestCourt.Id;
            encounter.EstimatedStartTime = courtNextAvailable[bestCourt.Id];
            encounter.EstimatedDurationMinutes = encounterDuration;
            encounter.EstimatedEndTime = courtNextAvailable[bestCourt.Id].AddMinutes(encounterDuration);
            encounter.UpdatedAt = DateTime.Now;

            // Update court availability
            courtNextAvailable[bestCourt.Id] = courtNextAvailable[bestCourt.Id].AddMinutes(encounterDuration);
            assigned++;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Auto-assigned {Count} encounters for phase {PhaseId} (duration: {Duration}min/encounter)",
            assigned, phaseId, encounterDuration);

        return new CourtAssignmentResult
        {
            Success = true,
            AssignedCount = assigned,
            CourtsUsed = availableCourts.Count,
            StartTime = startTime,
            EstimatedEndTime = courtNextAvailable.Values.Max(),
            Message = $"{assigned} encounters assigned ({encounterDuration}min each)"
        };
    }

    public async Task<TimeCalculationResult> CalculatePhaseTimesAsync(int phaseId)
    {
        var phase = await _context.DivisionPhases
            .Include(p => p.Division)
            .FirstOrDefaultAsync(p => p.Id == phaseId);

        if (phase == null)
        {
            return new TimeCalculationResult { Success = false, Message = "Phase not found" };
        }

        if (!phase.StartTime.HasValue)
        {
            return new TimeCalculationResult { Success = false, Message = "Phase start time not set" };
        }

        // Get encounters grouped by court
        var encounters = await _context.EventEncounters
            .Where(e => e.PhaseId == phaseId && e.TournamentCourtId != null)
            .OrderBy(e => e.TournamentCourtId).ThenBy(e => e.RoundNumber).ThenBy(e => e.EncounterNumber)
            .ToListAsync();

        if (!encounters.Any())
        {
            return new TimeCalculationResult { Success = false, Message = "No encounters with courts assigned" };
        }

        // Calculate encounter duration for this phase
        // (accounts for matches per encounter, BestOf per phase, match format BestOf)
        var encounterDuration = await CalculateEncounterDurationMinutesAsync(
            encounters.First(), phase.Division!, phase);

        // Calculate times per court
        var courtTimes = new Dictionary<int, DateTime>();
        int updated = 0;

        foreach (var encounter in encounters)
        {
            var courtId = encounter.TournamentCourtId!.Value;

            if (!courtTimes.ContainsKey(courtId))
            {
                courtTimes[courtId] = phase.StartTime.Value;
            }

            encounter.EstimatedStartTime = courtTimes[courtId];
            encounter.EstimatedDurationMinutes = encounterDuration;
            encounter.EstimatedEndTime = courtTimes[courtId].AddMinutes(encounterDuration);
            encounter.UpdatedAt = DateTime.Now;
            courtTimes[courtId] = courtTimes[courtId].AddMinutes(encounterDuration);
            updated++;
        }

        await _context.SaveChangesAsync();

        // Update phase end time
        DateTime? estimatedEndTime = null;
        if (courtTimes.Any())
        {
            estimatedEndTime = courtTimes.Values.Max();
            phase.EstimatedEndTime = estimatedEndTime;
            await _context.SaveChangesAsync();
        }

        _logger.LogInformation(
            "Calculated times for {Count} encounters in phase {PhaseId} ({Duration}min/encounter, {MatchCount} matches/encounter)",
            updated, phaseId, encounterDuration, phase.Division?.MatchesPerEncounter ?? 1);

        return new TimeCalculationResult
        {
            Success = true,
            UpdatedCount = updated,
            EstimatedEndTime = estimatedEndTime,
            Message = $"Calculated times for {updated} encounters ({encounterDuration}min each)"
        };
    }

    public async Task<int> ClearDivisionAssignmentsAsync(int divisionId)
    {
        var encounters = await _context.EventEncounters
            .Where(e => e.DivisionId == divisionId && e.Status != "Completed" && e.Status != "InProgress")
            .ToListAsync();

        int cleared = 0;
        foreach (var encounter in encounters)
        {
            if (encounter.TournamentCourtId.HasValue || encounter.EstimatedStartTime.HasValue || encounter.ScheduledTime.HasValue)
            {
                encounter.TournamentCourtId = null;
                encounter.EstimatedStartTime = null;
                encounter.ScheduledTime = null;
                encounter.UpdatedAt = DateTime.Now;
                cleared++;
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Cleared {Count} court assignments for division {DivisionId}", cleared, divisionId);

        return cleared;
    }

    public async Task<List<TournamentCourt>> GetAvailableCourtsForDivisionAsync(int divisionId, int? phaseId = null)
    {
        var courtAssignments = await _context.DivisionCourtAssignments
            .Where(a => a.DivisionId == divisionId && a.IsActive &&
                       (phaseId == null || a.PhaseId == phaseId || a.PhaseId == null))
            .OrderBy(a => a.Priority)
            .Include(a => a.CourtGroup)
                .ThenInclude(g => g!.CourtGroupCourts)
                    .ThenInclude(cgc => cgc.Court)
            .ToListAsync();

        if (!courtAssignments.Any())
        {
            return new List<TournamentCourt>();
        }

        return courtAssignments
            .SelectMany(a => a.CourtGroup?.CourtGroupCourts?.Select(cgc => cgc.Court!).Where(c => c != null) ?? Enumerable.Empty<TournamentCourt>())
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .Distinct()
            .ToList();
    }
}
