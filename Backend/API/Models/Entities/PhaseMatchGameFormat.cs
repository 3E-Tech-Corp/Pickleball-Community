using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Per-game score format settings for a phase/match combination.
/// Allows different score formats for each game in a best-of-N match.
/// E.g., Games 1-2 Rally to 11, Game 3 Rally to 15.
/// </summary>
public class PhaseMatchGameFormat
{
    public int Id { get; set; }

    /// <summary>
    /// The parent phase match settings this belongs to
    /// </summary>
    public int PhaseMatchSettingsId { get; set; }

    /// <summary>
    /// Game number within the match (1, 2, 3, 4, or 5)
    /// </summary>
    [Range(1, 5)]
    public int GameNumber { get; set; }

    /// <summary>
    /// Score format for this specific game.
    /// If null, uses the parent PhaseMatchSettings.ScoreFormatId
    /// </summary>
    public int? ScoreFormatId { get; set; }

    /// <summary>
    /// Estimated duration for this game in minutes.
    /// Useful for scheduling/time budgeting.
    /// </summary>
    public int? EstimatedMinutes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("PhaseMatchSettingsId")]
    public PhaseMatchSettings? PhaseMatchSettings { get; set; }

    [ForeignKey("ScoreFormatId")]
    public ScoreFormat? ScoreFormat { get; set; }
}
