using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.API.Controllers;

[ApiController]
[Route("[controller]")]
public class CourtTypesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CourtTypesController> _logger;

    public CourtTypesController(ApplicationDbContext context, ILogger<CourtTypesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: /courttypes - Get all court types (public - for dropdowns)
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<CourtTypeDto>>>> GetCourtTypes([FromQuery] bool includeInactive = false)
    {
        try
        {
            var query = _context.CourtTypes.AsQueryable();

            if (!includeInactive)
            {
                query = query.Where(ct => ct.IsActive);
            }

            var courtTypes = await query
                .OrderBy(ct => ct.SortOrder)
                .ThenBy(ct => ct.Name)
                .Select(ct => new CourtTypeDto
                {
                    Id = ct.Id,
                    Name = ct.Name,
                    Description = ct.Description,
                    Icon = ct.Icon,
                    Color = ct.Color,
                    SortOrder = ct.SortOrder,
                    IsActive = ct.IsActive
                })
                .ToListAsync();

            return Ok(new ApiResponse<List<CourtTypeDto>> { Success = true, Data = courtTypes });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court types");
            return StatusCode(500, new ApiResponse<List<CourtTypeDto>> { Success = false, Message = "An error occurred" });
        }
    }

    // GET: /courttypes/{id} - Get single court type
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<CourtTypeDto>>> GetCourtType(int id)
    {
        try
        {
            var courtType = await _context.CourtTypes.FindAsync(id);
            if (courtType == null)
                return NotFound(new ApiResponse<CourtTypeDto> { Success = false, Message = "Court type not found" });

            var dto = new CourtTypeDto
            {
                Id = courtType.Id,
                Name = courtType.Name,
                Description = courtType.Description,
                Icon = courtType.Icon,
                Color = courtType.Color,
                SortOrder = courtType.SortOrder,
                IsActive = courtType.IsActive
            };

            return Ok(new ApiResponse<CourtTypeDto> { Success = true, Data = dto });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching court type {Id}", id);
            return StatusCode(500, new ApiResponse<CourtTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courttypes - Create new court type (Admin only)
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<CourtTypeDto>>> CreateCourtType([FromBody] CreateCourtTypeDto dto)
    {
        try
        {
            // Check for duplicate name
            var exists = await _context.CourtTypes.AnyAsync(ct => ct.Name.ToLower() == dto.Name.ToLower());
            if (exists)
                return BadRequest(new ApiResponse<CourtTypeDto> { Success = false, Message = "A court type with this name already exists" });

            var courtType = new CourtType
            {
                Name = dto.Name,
                Description = dto.Description,
                Icon = dto.Icon,
                Color = dto.Color,
                SortOrder = dto.SortOrder,
                IsActive = dto.IsActive
            };

            _context.CourtTypes.Add(courtType);
            await _context.SaveChangesAsync();

            var result = new CourtTypeDto
            {
                Id = courtType.Id,
                Name = courtType.Name,
                Description = courtType.Description,
                Icon = courtType.Icon,
                Color = courtType.Color,
                SortOrder = courtType.SortOrder,
                IsActive = courtType.IsActive
            };

            return Ok(new ApiResponse<CourtTypeDto> { Success = true, Data = result, Message = "Court type created" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating court type");
            return StatusCode(500, new ApiResponse<CourtTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /courttypes/{id} - Update court type (Admin only)
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<CourtTypeDto>>> UpdateCourtType(int id, [FromBody] UpdateCourtTypeDto dto)
    {
        try
        {
            var courtType = await _context.CourtTypes.FindAsync(id);
            if (courtType == null)
                return NotFound(new ApiResponse<CourtTypeDto> { Success = false, Message = "Court type not found" });

            // Check for duplicate name if changing
            if (dto.Name != null && dto.Name.ToLower() != courtType.Name.ToLower())
            {
                var exists = await _context.CourtTypes.AnyAsync(ct => ct.Name.ToLower() == dto.Name.ToLower() && ct.Id != id);
                if (exists)
                    return BadRequest(new ApiResponse<CourtTypeDto> { Success = false, Message = "A court type with this name already exists" });
            }

            courtType.Name = dto.Name ?? courtType.Name;
            courtType.Description = dto.Description ?? courtType.Description;
            courtType.Icon = dto.Icon ?? courtType.Icon;
            courtType.Color = dto.Color ?? courtType.Color;
            courtType.SortOrder = dto.SortOrder ?? courtType.SortOrder;
            courtType.IsActive = dto.IsActive ?? courtType.IsActive;
            courtType.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var result = new CourtTypeDto
            {
                Id = courtType.Id,
                Name = courtType.Name,
                Description = courtType.Description,
                Icon = courtType.Icon,
                Color = courtType.Color,
                SortOrder = courtType.SortOrder,
                IsActive = courtType.IsActive
            };

            return Ok(new ApiResponse<CourtTypeDto> { Success = true, Data = result, Message = "Court type updated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating court type {Id}", id);
            return StatusCode(500, new ApiResponse<CourtTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // DELETE: /courttypes/{id} - Delete court type (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteCourtType(int id)
    {
        try
        {
            var courtType = await _context.CourtTypes.FindAsync(id);
            if (courtType == null)
                return NotFound(new ApiResponse<bool> { Success = false, Message = "Court type not found" });

            // Soft delete - just mark as inactive
            courtType.IsActive = false;
            courtType.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Court type deactivated" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting court type {Id}", id);
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }

    // POST: /courttypes/{id}/restore - Restore deleted court type (Admin only)
    [HttpPost("{id}/restore")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<CourtTypeDto>>> RestoreCourtType(int id)
    {
        try
        {
            var courtType = await _context.CourtTypes.FindAsync(id);
            if (courtType == null)
                return NotFound(new ApiResponse<CourtTypeDto> { Success = false, Message = "Court type not found" });

            courtType.IsActive = true;
            courtType.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var result = new CourtTypeDto
            {
                Id = courtType.Id,
                Name = courtType.Name,
                Description = courtType.Description,
                Icon = courtType.Icon,
                Color = courtType.Color,
                SortOrder = courtType.SortOrder,
                IsActive = courtType.IsActive
            };

            return Ok(new ApiResponse<CourtTypeDto> { Success = true, Data = result, Message = "Court type restored" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring court type {Id}", id);
            return StatusCode(500, new ApiResponse<CourtTypeDto> { Success = false, Message = "An error occurred" });
        }
    }

    // PUT: /courttypes/reorder - Reorder court types (Admin only)
    [HttpPut("reorder")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ReorderCourtTypes([FromBody] List<int> orderedIds)
    {
        try
        {
            for (int i = 0; i < orderedIds.Count; i++)
            {
                var courtType = await _context.CourtTypes.FindAsync(orderedIds[i]);
                if (courtType != null)
                {
                    courtType.SortOrder = i;
                    courtType.UpdatedAt = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new ApiResponse<bool> { Success = true, Data = true, Message = "Court types reordered" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering court types");
            return StatusCode(500, new ApiResponse<bool> { Success = false, Message = "An error occurred" });
        }
    }
}
