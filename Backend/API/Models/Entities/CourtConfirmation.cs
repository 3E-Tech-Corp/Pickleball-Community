using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

/// <summary>
/// User confirmations and feedback about court information
/// </summary>
public class CourtConfirmation
{
    public int Id { get; set; }

    [Required]
    public int CourtId { get; set; }

    [Required]
    public int UserId { get; set; }

    // Name confirmation
    public bool? NameConfirmed { get; set; }

    [MaxLength(100)]
    public string? SuggestedName { get; set; }

    // Flag to indicate this location is no longer a pickleball court
    public bool? NotACourt { get; set; }

    // Court count confirmations
    public int? ConfirmedIndoorCount { get; set; }
    public int? ConfirmedOutdoorCount { get; set; }
    public int? ConfirmedCoveredCount { get; set; }

    // Lights confirmation
    public bool? HasLights { get; set; }

    // Fee information
    public bool? HasFee { get; set; }

    [MaxLength(50)]
    public string? FeeAmount { get; set; }

    [MaxLength(200)]
    public string? FeeNotes { get; set; }

    // Hours
    [MaxLength(500)]
    public string? Hours { get; set; }

    // Rating (1-5)
    public int? Rating { get; set; }

    // Additional notes
    [MaxLength(1000)]
    public string? Notes { get; set; }

    // Amenities (stored as JSON or comma-separated)
    [MaxLength(500)]
    public string? Amenities { get; set; } // e.g., "restrooms,water,benches,shade"

    // Surface type
    [MaxLength(50)]
    public string? SurfaceType { get; set; } // concrete, asphalt, sport_court, wood

    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    [ForeignKey("CourtId")]
    public Court? Court { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }
}
