namespace Pickleball.Community.Models.DTOs;

/// <summary>
/// DTO for displaying help topic content
/// </summary>
public class HelpTopicDto
{
    public int Id { get; set; }
    public string TopicCode { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Category { get; set; }
}

/// <summary>
/// DTO for admin list view of help topics
/// </summary>
public class HelpTopicListDto
{
    public int Id { get; set; }
    public string TopicCode { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? Category { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// DTO for creating/updating help topics
/// </summary>
public class CreateHelpTopicDto
{
    public string TopicCode { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Category { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; } = 0;
}

/// <summary>
/// DTO for updating help topics
/// </summary>
public class UpdateHelpTopicDto
{
    public string? TopicCode { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? Category { get; set; }
    public bool? IsActive { get; set; }
    public int? SortOrder { get; set; }
}
