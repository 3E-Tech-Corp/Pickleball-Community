using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines the format for a match type within an encounter.
/// For example: Men's Doubles (2M), Women's Doubles (2F), Mixed Doubles (1M+1F)
/// </summary>
public class EncounterMatchFormat
{
    public int Id { get; set; }

    public int DivisionId { get; set; }

    /// <summary>
    /// Name of this match type (e.g., "Men's Doubles", "Women's Doubles", "Mixed Doubles")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Which match number this format is for within an encounter (1, 2, 3, etc.)
    /// </summary>
    public int MatchNumber { get; set; } = 1;

    /// <summary>
    /// Number of male players required for this match type
    /// </summary>
    public int MaleCount { get; set; } = 0;

    /// <summary>
    /// Number of female players required for this match type
    /// </summary>
    public int FemaleCount { get; set; } = 0;

    /// <summary>
    /// Number of players of any gender allowed for this match type
    /// </summary>
    public int UnisexCount { get; set; } = 0;

    /// <summary>
    /// Total players required for this match type (computed)
    /// </summary>
    public int TotalPlayers => MaleCount + FemaleCount + UnisexCount;

    /// <summary>
    /// Best of X games for this match format
    /// </summary>
    public int BestOf { get; set; } = 1;

    /// <summary>
    /// Optional score format to use for games in this match
    /// </summary>
    public int? ScoreFormatId { get; set; }

    public int SortOrder { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }
}

/// <summary>
/// A scheduled encounter between two units (teams) in a league/event.
/// An encounter contains multiple matches (e.g., Men's Doubles, Women's Doubles, Mixed Doubles).
/// </summary>
public class EventEncounter
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int DivisionId { get; set; }

    /// <summary>
    /// Type of round: Pool, Bracket, Final
    /// </summary>
    [MaxLength(20)]
    public string RoundType { get; set; } = "Pool";

    /// <summary>
    /// Round number within the round type
    /// </summary>
    public int RoundNumber { get; set; } = 1;

    /// <summary>
    /// Human-readable round name (e.g., "Pool A", "Quarterfinal", "Final")
    /// </summary>
    [MaxLength(50)]
    public string? RoundName { get; set; }

    /// <summary>
    /// Encounter number within the round
    /// </summary>
    public int EncounterNumber { get; set; } = 1;

    /// <summary>
    /// Unit number placeholder (before units are assigned)
    /// </summary>
    public int? Unit1Number { get; set; }
    public int? Unit2Number { get; set; }

    /// <summary>
    /// Actual unit IDs (after assignment)
    /// </summary>
    public int? Unit1Id { get; set; }
    public int? Unit2Id { get; set; }

    /// <summary>
    /// Number of match wins for Unit 1 in this encounter (e.g., 2 in a 2-1 result)
    /// </summary>
    public int Unit1EncounterScore { get; set; } = 0;

    /// <summary>
    /// Number of match wins for Unit 2 in this encounter (e.g., 1 in a 2-1 result)
    /// </summary>
    public int Unit2EncounterScore { get; set; } = 0;

    /// <summary>
    /// Winner of the encounter (based on match wins)
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: Scheduled, Ready, InProgress, Completed, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Scheduled";

    /// <summary>
    /// Scheduled start time for the encounter
    /// </summary>
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Assigned tournament court (if all matches are on one court)
    /// </summary>
    public int? TournamentCourtId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("DivisionId")]
    public EventDivision? Division { get; set; }

    [ForeignKey("Unit1Id")]
    public EventUnit? Unit1 { get; set; }

    [ForeignKey("Unit2Id")]
    public EventUnit? Unit2 { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    public ICollection<EncounterMatch> Matches { get; set; } = new List<EncounterMatch>();
}

/// <summary>
/// An individual match within an encounter.
/// For example, a Men's Doubles match within a team league encounter.
/// </summary>
public class EncounterMatch
{
    public int Id { get; set; }

    public int EncounterId { get; set; }

    /// <summary>
    /// Link to the match format template that defines player requirements
    /// </summary>
    public int FormatId { get; set; }

    /// <summary>
    /// Score for Unit 1 (game wins if best-of series, or points if single game)
    /// </summary>
    public int Unit1Score { get; set; } = 0;

    /// <summary>
    /// Score for Unit 2 (game wins if best-of series, or points if single game)
    /// </summary>
    public int Unit2Score { get; set; } = 0;

    /// <summary>
    /// Handicap points added to Unit 1's final score
    /// </summary>
    public int Unit1HandicapPoints { get; set; } = 0;

    /// <summary>
    /// Handicap points added to Unit 2's final score
    /// </summary>
    public int Unit2HandicapPoints { get; set; } = 0;

    /// <summary>
    /// Winner of this match
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: New, Ready, InProgress, Completed, Cancelled
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "New";

    /// <summary>
    /// Assigned tournament court for this match
    /// </summary>
    public int? TournamentCourtId { get; set; }

    /// <summary>
    /// Scheduled start time for this match
    /// </summary>
    public DateTime? ScheduledTime { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Unit that submitted the score
    /// </summary>
    public int? ScoreSubmittedByUnitId { get; set; }
    public DateTime? ScoreSubmittedAt { get; set; }

    /// <summary>
    /// Unit that confirmed the score (must be the other unit)
    /// </summary>
    public int? ScoreConfirmedByUnitId { get; set; }
    public DateTime? ScoreConfirmedAt { get; set; }

    /// <summary>
    /// If score was disputed
    /// </summary>
    public DateTime? ScoreDisputedAt { get; set; }

    [MaxLength(500)]
    public string? ScoreDisputeReason { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("EncounterId")]
    public EventEncounter? Encounter { get; set; }

    [ForeignKey("FormatId")]
    public EncounterMatchFormat? Format { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("ScoreSubmittedByUnitId")]
    public EventUnit? ScoreSubmittedBy { get; set; }

    [ForeignKey("ScoreConfirmedByUnitId")]
    public EventUnit? ScoreConfirmedBy { get; set; }

    public ICollection<EncounterMatchPlayer> Players { get; set; } = new List<EncounterMatchPlayer>();
    public ICollection<EncounterMatchGame> Games { get; set; } = new List<EncounterMatchGame>();
}

/// <summary>
/// A player participating in an encounter match.
/// Tracks which players from each unit are playing in this specific match.
/// </summary>
public class EncounterMatchPlayer
{
    public int Id { get; set; }

    public int MatchId { get; set; }
    public int UserId { get; set; }
    public int UnitId { get; set; }

    /// <summary>
    /// Which side of the encounter this player is on (1 or 2)
    /// </summary>
    public int UnitSide { get; set; }

    /// <summary>
    /// Player's gender for validation against format requirements
    /// </summary>
    [MaxLength(10)]
    public string? Gender { get; set; }

    /// <summary>
    /// Position within the team for this match (1, 2, etc.)
    /// </summary>
    public int? Position { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("MatchId")]
    public EncounterMatch? Match { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("UnitId")]
    public EventUnit? Unit { get; set; }
}

/// <summary>
/// An individual game within an encounter match (for best-of-3/5 series).
/// </summary>
public class EncounterMatchGame
{
    public int Id { get; set; }

    public int MatchId { get; set; }

    /// <summary>
    /// Game number within the match (1, 2, 3, etc.)
    /// </summary>
    public int GameNumber { get; set; } = 1;

    /// <summary>
    /// Score for Unit 1 in this game
    /// </summary>
    public int Unit1Score { get; set; } = 0;

    /// <summary>
    /// Score for Unit 2 in this game
    /// </summary>
    public int Unit2Score { get; set; } = 0;

    /// <summary>
    /// Winner of this game
    /// </summary>
    public int? WinnerUnitId { get; set; }

    /// <summary>
    /// Status: New, InProgress, Completed
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "New";

    /// <summary>
    /// Score format for this game
    /// </summary>
    public int? ScoreFormatId { get; set; }

    /// <summary>
    /// Court assignment for this game
    /// </summary>
    public int? TournamentCourtId { get; set; }

    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    [ForeignKey("MatchId")]
    public EncounterMatch? Match { get; set; }

    [ForeignKey("WinnerUnitId")]
    public EventUnit? Winner { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }
}
