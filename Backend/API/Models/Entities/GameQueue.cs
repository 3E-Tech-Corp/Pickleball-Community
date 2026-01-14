using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Court queue management for games waiting to be played
/// </summary>
public class GameQueue
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int TournamentCourtId { get; set; }
    public int GameId { get; set; }

    /// <summary>
    /// Position in the queue for this court (0 = first)
    /// </summary>
    public int QueuePosition { get; set; } = 0;

    /// <summary>
    /// Status: Queued, Current, Completed, Skipped
    /// </summary>
    [MaxLength(20)]
    public string Status { get; set; } = "Queued";

    public DateTime QueuedAt { get; set; } = DateTime.Now;

    /// <summary>
    /// When players were called to the court
    /// </summary>
    public DateTime? CalledAt { get; set; }

    /// <summary>
    /// When game actually started
    /// </summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>
    /// When game completed
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// User who queued this game
    /// </summary>
    public int? QueuedByUserId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("TournamentCourtId")]
    public TournamentCourt? TournamentCourt { get; set; }

    [ForeignKey("GameId")]
    public EventGame? Game { get; set; }

    [ForeignKey("QueuedByUserId")]
    public User? QueuedBy { get; set; }
}

/// <summary>
/// Static helper for queue statuses
/// </summary>
public static class QueueStatus
{
    public const string Queued = "Queued";
    public const string Current = "Current";
    public const string Completed = "Completed";
    public const string Skipped = "Skipped";
}
