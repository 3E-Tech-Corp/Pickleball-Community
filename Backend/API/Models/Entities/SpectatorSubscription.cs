using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Subscription for spectators to receive notifications about games/players/units
/// </summary>
public class SpectatorSubscription
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public int EventId { get; set; }

    /// <summary>
    /// Type of subscription: Game, Player, Unit, Division, Event
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string SubscriptionType { get; set; } = "Event";

    /// <summary>
    /// ID of the entity being subscribed to (GameId, UserId, UnitId, DivisionId)
    /// NULL means subscribing to all of that type in the event
    /// </summary>
    public int? TargetId { get; set; }

    // Notification preferences
    public bool NotifyOnGameQueued { get; set; } = true;
    public bool NotifyOnGameStarted { get; set; } = true;
    public bool NotifyOnScoreUpdate { get; set; } = true;
    public bool NotifyOnGameFinished { get; set; } = true;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.Now;

    // Navigation
    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("EventId")]
    public Event? Event { get; set; }
}

/// <summary>
/// Static helper for subscription types
/// </summary>
public static class SubscriptionTypes
{
    public const string Game = "Game";
    public const string Player = "Player";
    public const string Unit = "Unit";
    public const string Division = "Division";
    public const string Event = "Event";
}
