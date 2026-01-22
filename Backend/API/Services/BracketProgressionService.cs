using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;

namespace Pickleball.Community.Services;

/// <summary>
/// Service for handling playoff bracket progression logic.
/// Advances winners to the next round and handles third place matches.
/// </summary>
public interface IBracketProgressionService
{
    /// <summary>
    /// Check if a match is complete and advance the winner to the next bracket round if applicable.
    /// </summary>
    /// <param name="encounterId">The encounter/match ID to check</param>
    /// <returns>True if bracket progression occurred</returns>
    Task<BracketProgressionResult> CheckAndAdvanceAsync(int encounterId);
}

public class BracketProgressionResult
{
    public bool MatchCompleted { get; set; }
    public bool WinnerAdvanced { get; set; }
    public int? WinnerUnitId { get; set; }
    public int? NextMatchId { get; set; }
    public string? NextMatchRoundName { get; set; }
}

public class BracketProgressionService : IBracketProgressionService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<BracketProgressionService> _logger;

    public BracketProgressionService(ApplicationDbContext context, ILogger<BracketProgressionService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<BracketProgressionResult> CheckAndAdvanceAsync(int encounterId)
    {
        var result = new BracketProgressionResult();

        var match = await _context.EventMatches
            .Include(m => m.Matches).ThenInclude(match => match.Games)
            .Include(m => m.Unit1)
            .Include(m => m.Unit2)
            .FirstOrDefaultAsync(m => m.Id == encounterId);

        if (match == null)
        {
            _logger.LogWarning("Match {EncounterId} not found for bracket progression", encounterId);
            return result;
        }

        // Check if match is already completed
        if (match.Status == "Completed" && match.WinnerUnitId.HasValue)
        {
            result.MatchCompleted = true;
            result.WinnerUnitId = match.WinnerUnitId;

            // Still try to advance if not already done
            await TryAdvanceWinnerAsync(match, result);
            return result;
        }

        // Calculate wins for each unit
        var allGames = match.Matches?.SelectMany(m => m.Games ?? Enumerable.Empty<EventGame>()).ToList()
            ?? new List<EventGame>();
        var finishedGames = allGames.Where(g => g.Status == "Finished").ToList();
        var unit1Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit1Id);
        var unit2Wins = finishedGames.Count(g => g.WinnerUnitId == match.Unit2Id);
        var winsNeeded = (match.BestOf / 2) + 1;

        // Check if match is complete
        if (unit1Wins >= winsNeeded || unit2Wins >= winsNeeded || finishedGames.Count == allGames.Count)
        {
            result.MatchCompleted = true;

            // Determine winner
            var winnerUnitId = unit1Wins > unit2Wins ? match.Unit1Id : match.Unit2Id;
            if (!match.WinnerUnitId.HasValue)
            {
                match.WinnerUnitId = winnerUnitId;
                match.Status = "Completed";
                match.CompletedAt = DateTime.Now;
                match.UpdatedAt = DateTime.Now;

                // Update unit stats
                await UpdateMatchStatsAsync(match);
            }

            result.WinnerUnitId = match.WinnerUnitId;

            // Advance winner for bracket/playoff matches
            await TryAdvanceWinnerAsync(match, result);

            await _context.SaveChangesAsync();
        }

        return result;
    }

    private async Task TryAdvanceWinnerAsync(EventEncounter match, BracketProgressionResult result)
    {
        // Only advance for bracket matches
        if (match.RoundType != "Bracket" && match.RoundType != "Final" && match.RoundType != "ThirdPlace")
            return;

        if (!match.WinnerUnitId.HasValue)
            return;

        // Load all bracket matches for this division
        var allBracketMatches = await _context.EventMatches
            .Where(m => m.DivisionId == match.DivisionId &&
                       (m.RoundType == "Bracket" || m.RoundType == "Final" || m.RoundType == "ThirdPlace"))
            .ToListAsync();

        // Advance the winner to the next round
        var nextMatch = await AdvanceWinnerToNextRound(match, match.WinnerUnitId.Value, allBracketMatches);

        if (nextMatch != null)
        {
            result.WinnerAdvanced = true;
            result.NextMatchId = nextMatch.Id;
            result.NextMatchRoundName = nextMatch.RoundName;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Bracket progression: Match {MatchId} completed, advanced unit {WinnerUnitId} to match {NextMatchId} ({RoundName})",
                match.Id, match.WinnerUnitId, nextMatch.Id, nextMatch.RoundName);
        }
    }

    private async Task<EventEncounter?> AdvanceWinnerToNextRound(EventEncounter completedMatch, int winnerUnitId, List<EventEncounter> allMatches)
    {
        // Finals and third place don't advance
        if (completedMatch.RoundType == "Final" || completedMatch.RoundType == "ThirdPlace")
            return null;

        var nextRoundNumber = completedMatch.RoundNumber + 1;
        var currentBracketPos = completedMatch.BracketPosition ?? 0;
        var nextBracketPos = (currentBracketPos + 1) / 2; // 1,2->1, 3,4->2, etc.

        // Find the next match
        var nextMatch = allMatches.FirstOrDefault(m =>
            m.RoundNumber == nextRoundNumber &&
            m.BracketPosition == nextBracketPos &&
            m.RoundType != "ThirdPlace");

        // Check if this is a semifinal going to final
        if (nextMatch == null)
        {
            nextMatch = allMatches.FirstOrDefault(m =>
                m.RoundNumber == nextRoundNumber &&
                m.RoundType == "Final");
        }

        if (nextMatch == null)
            return null;

        // Check if the winner is already in the next match
        if (nextMatch.Unit1Id == winnerUnitId || nextMatch.Unit2Id == winnerUnitId)
        {
            _logger.LogDebug("Unit {UnitId} already assigned to next match {NextMatchId}", winnerUnitId, nextMatch.Id);
            return null;
        }

        // Determine which slot (unit1 or unit2) based on bracket position
        // Odd bracket positions go to Unit1, even go to Unit2
        if (currentBracketPos % 2 == 1)
        {
            nextMatch.Unit1Id = winnerUnitId;
        }
        else
        {
            nextMatch.Unit2Id = winnerUnitId;
        }
        nextMatch.UpdatedAt = DateTime.Now;

        return nextMatch;
    }

    private async Task UpdateMatchStatsAsync(EventEncounter match)
    {
        var unit1 = match.Unit1 ?? await _context.EventUnits.FindAsync(match.Unit1Id);
        var unit2 = match.Unit2 ?? await _context.EventUnits.FindAsync(match.Unit2Id);

        if (unit1 == null || unit2 == null)
            return;

        unit1.MatchesPlayed++;
        unit2.MatchesPlayed++;

        if (match.WinnerUnitId == unit1.Id)
        {
            unit1.MatchesWon++;
            unit2.MatchesLost++;
        }
        else
        {
            unit2.MatchesWon++;
            unit1.MatchesLost++;
        }

        unit1.UpdatedAt = DateTime.Now;
        unit2.UpdatedAt = DateTime.Now;
    }
}
