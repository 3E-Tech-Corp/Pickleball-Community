using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Pickleball.Community.Models.Entities;

[Table("Court_GeoCodes")]
public class CourtGeoCode
{
    [Key]
    [Column("GEO_ID")]
    public int GeoId { get; set; }

    [Column("Court_ID")]
    public int? CourtId { get; set; }

    [Column("GEOCodeType_ID")]
    public int? GeoCodeTypeId { get; set; }

    [Column("SName")]
    [MaxLength(100)]
    public string? ShortName { get; set; }

    [Column("LName")]
    [MaxLength(200)]
    public string? LongName { get; set; }

    [Column("DT_Code")]
    public DateTime? DateCoded { get; set; }

    [ForeignKey("CourtId")]
    public Court? Court { get; set; }

    [ForeignKey("GeoCodeTypeId")]
    public GeoCodeType? GeoCodeType { get; set; }
}
