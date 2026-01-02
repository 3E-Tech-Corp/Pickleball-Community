using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Defines scoring format for games
/// </summary>
public class ScoreFormat
{
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Scoring type: Classic (side-out) or Rally (rally scoring)
    /// </summary>
    [MaxLength(20)]
    public string ScoringType { get; set; } = "Rally";

    /// <summary>
    /// Points needed to win
    /// </summary>
    public int MaxPoints { get; set; } = 11;

    /// <summary>
    /// Win by margin (typically 1 or 2)
    /// </summary>
    public int WinByMargin { get; set; } = 2;

    /// <summary>
    /// Whether to switch ends at midpoint
    /// </summary>
    public bool SwitchEndsAtMidpoint { get; set; } = false;

    /// <summary>
    /// Score at which to switch ends (null = MaxPoints/2)
    /// </summary>
    public int? MidpointScore { get; set; }

    /// <summary>
    /// Optional time limit in minutes
    /// </summary>
    public int? TimeLimitMinutes { get; set; }

    /// <summary>
    /// Whether this is a tiebreaker format
    /// </summary>
    public bool IsTiebreaker { get; set; } = false;

    public int SortOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public bool IsDefault { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
