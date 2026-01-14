using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// Event-level check-in record
/// </summary>
public class EventCheckIn
{
    public int Id { get; set; }

    public int EventId { get; set; }
    public int UserId { get; set; }

    /// <summary>
    /// Check-in method: QRCode, Manual, Self
    /// </summary>
    [MaxLength(20)]
    public string CheckInMethod { get; set; } = "Self";

    /// <summary>
    /// User who performed the check-in (if different from the player)
    /// </summary>
    public int? CheckedInByUserId { get; set; }

    public DateTime CheckedInAt { get; set; } = DateTime.Now;

    [MaxLength(500)]
    public string? Notes { get; set; }

    [MaxLength(50)]
    public string? IpAddress { get; set; }

    // Navigation
    [ForeignKey("EventId")]
    public Event? Event { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    [ForeignKey("CheckedInByUserId")]
    public User? CheckedInBy { get; set; }
}

/// <summary>
/// Static helper for check-in methods
/// </summary>
public static class CheckInMethod
{
    public const string QRCode = "QRCode";
    public const string Manual = "Manual";
    public const string Self = "Self";
}
