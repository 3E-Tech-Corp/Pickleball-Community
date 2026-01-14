using System.ComponentModel.DataAnnotations;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Dynamic help content that can be displayed anywhere in the application
/// </summary>
public class HelpTopic
{
    public int Id { get; set; }

    /// <summary>
    /// Unique code to identify this help topic (e.g., "division.gamesPerMatch", "event.registrationFee")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string TopicCode { get; set; } = string.Empty;

    /// <summary>
    /// Short title for the help topic
    /// </summary>
    [MaxLength(200)]
    public string? Title { get; set; }

    /// <summary>
    /// The help content (supports markdown)
    /// </summary>
    [Required]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Category for grouping help topics (e.g., "Events", "Registration", "Scoring")
    /// </summary>
    [MaxLength(50)]
    public string? Category { get; set; }

    /// <summary>
    /// Whether this help topic is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Sort order within category
    /// </summary>
    public int SortOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
}
