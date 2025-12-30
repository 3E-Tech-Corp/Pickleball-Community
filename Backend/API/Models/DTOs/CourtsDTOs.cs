namespace Pickleball.Community.Models.DTOs;

public class CourtDto
{
    public int CourtId { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? County { get; set; }
    public string? State { get; set; }
    public string? Zip { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public int? IndoorNum { get; set; }
    public int? OutdoorNum { get; set; }
    public int? CoveredNum { get; set; }
    public bool HasLights { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? Distance { get; set; } // Calculated distance from user
    public CourtAggregatedInfoDto? AggregatedInfo { get; set; }
}

public class CourtAggregatedInfoDto
{
    public int ConfirmationCount { get; set; }
    public double? AverageRating { get; set; }
    public int? MostConfirmedIndoorCount { get; set; }
    public int? MostConfirmedOutdoorCount { get; set; }
    public bool? MostConfirmedHasLights { get; set; }
    public bool? MostConfirmedHasFee { get; set; }
    public string? CommonFeeAmount { get; set; }
    public string? CommonHours { get; set; }
    public string? CommonSurfaceType { get; set; }
    public List<string>? CommonAmenities { get; set; }
}

public class CourtDetailDto : CourtDto
{
    public List<CourtConfirmationDto>? RecentConfirmations { get; set; }
    public CourtConfirmationDto? MyConfirmation { get; set; }
}

public class CourtConfirmationDto
{
    public int Id { get; set; }
    public int CourtId { get; set; }
    public int UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserProfileImageUrl { get; set; }
    public bool? NameConfirmed { get; set; }
    public string? SuggestedName { get; set; }
    public int? ConfirmedIndoorCount { get; set; }
    public int? ConfirmedOutdoorCount { get; set; }
    public int? ConfirmedCoveredCount { get; set; }
    public bool? HasLights { get; set; }
    public bool? HasFee { get; set; }
    public string? FeeAmount { get; set; }
    public string? FeeNotes { get; set; }
    public string? Hours { get; set; }
    public int? Rating { get; set; }
    public string? Notes { get; set; }
    public List<string>? Amenities { get; set; }
    public string? SurfaceType { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class SubmitCourtConfirmationDto
{
    public bool? NameConfirmed { get; set; }
    public string? SuggestedName { get; set; }
    public int? ConfirmedIndoorCount { get; set; }
    public int? ConfirmedOutdoorCount { get; set; }
    public int? ConfirmedCoveredCount { get; set; }
    public bool? HasLights { get; set; }
    public bool? HasFee { get; set; }
    public string? FeeAmount { get; set; }
    public string? FeeNotes { get; set; }
    public string? Hours { get; set; }
    public int? Rating { get; set; }
    public string? Notes { get; set; }
    public List<string>? Amenities { get; set; }
    public string? SurfaceType { get; set; }
}

public class CourtSearchRequest
{
    public string? Query { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double? RadiusMiles { get; set; } = 100;
    public string? State { get; set; }
    public string? City { get; set; }
    public bool? HasLights { get; set; }
    public bool? IsIndoor { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
