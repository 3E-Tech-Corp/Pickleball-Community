using Microsoft.EntityFrameworkCore;
using Pickleball.Community.Database;
using Pickleball.Community.Models.Entities;
using Pickleball.Community.Models.DTOs;

namespace Pickleball.Community.Services;

public interface ITournamentFeeService
{
    // Division fees
    Task<ServiceResult<List<DivisionFeeDto>>> GetDivisionFeesAsync(int divisionId);
    Task<ServiceResult<DivisionFeeDto>> CreateDivisionFeeAsync(int divisionId, int userId, DivisionFeeRequest request);
    Task<ServiceResult<DivisionFeeDto>> UpdateDivisionFeeAsync(int divisionId, int feeId, int userId, DivisionFeeRequest request);
    Task<ServiceResult<bool>> DeleteDivisionFeeAsync(int divisionId, int feeId, int userId);
    Task<ServiceResult<List<DivisionFeeDto>>> BulkUpdateDivisionFeesAsync(int divisionId, int userId, List<DivisionFeeRequest> fees);

    // Event fees
    Task<ServiceResult<List<DivisionFeeDto>>> GetEventFeesAsync(int eventId);
    Task<ServiceResult<DivisionFeeDto>> CreateEventFeeAsync(int eventId, int userId, DivisionFeeRequest request);
    Task<ServiceResult<DivisionFeeDto>> UpdateEventFeeAsync(int eventId, int feeId, int userId, DivisionFeeRequest request);
    Task<ServiceResult<bool>> DeleteEventFeeAsync(int eventId, int feeId, int userId);
    Task<ServiceResult<List<DivisionFeeDto>>> BulkUpdateEventFeesAsync(int eventId, int userId, List<DivisionFeeRequest> fees);

    // Fee types
    Task<ServiceResult<List<EventFeeTypeDto>>> GetEventFeeTypesAsync(int eventId);
    Task<ServiceResult<EventFeeTypeDto>> CreateEventFeeTypeAsync(int eventId, int userId, EventFeeTypeRequest request);
    Task<ServiceResult<EventFeeTypeDto>> UpdateEventFeeTypeAsync(int eventId, int feeTypeId, int userId, EventFeeTypeRequest request);
    Task<ServiceResult<bool>> DeleteEventFeeTypeAsync(int eventId, int feeTypeId, int userId);
    Task<ServiceResult<List<EventFeeTypeDto>>> BulkUpdateEventFeeTypesAsync(int eventId, int userId, BulkEventFeeTypesRequest request);
}

public class TournamentFeeService : ITournamentFeeService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TournamentFeeService> _logger;

    public TournamentFeeService(ApplicationDbContext context, ILogger<TournamentFeeService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ===== Division Fees =====

    public async Task<ServiceResult<List<DivisionFeeDto>>> GetDivisionFeesAsync(int divisionId)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return ServiceResult<List<DivisionFeeDto>>.NotFound("Division not found");

        var fees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.DivisionId == divisionId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        return ServiceResult<List<DivisionFeeDto>>.Ok(fees.Select(MapToDto).ToList());
    }

    public async Task<ServiceResult<DivisionFeeDto>> CreateDivisionFeeAsync(int divisionId, int userId, DivisionFeeRequest request)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return ServiceResult<DivisionFeeDto>.NotFound("Division not found");

        if (!await CanManageEventAsync(division.EventId, userId))
            return ServiceResult<DivisionFeeDto>.Forbidden();

        var feeType = await _context.EventFeeTypes
            .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == division.EventId);
        if (feeType == null)
            return ServiceResult<DivisionFeeDto>.Fail("Fee type not found for this event");

        var existingFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.DivisionId == divisionId && f.FeeTypeId == request.FeeTypeId);
        if (existingFee != null)
            return ServiceResult<DivisionFeeDto>.Fail("A fee already exists for this fee type in this division");

        if (request.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.DivisionId == divisionId && f.IsDefault)
                .ToListAsync();
            foreach (var existing in existingDefaults)
                existing.IsDefault = false;
        }

        var fee = new DivisionFee
        {
            DivisionId = divisionId,
            EventId = division.EventId,
            FeeTypeId = request.FeeTypeId,
            Amount = request.Amount,
            IsDefault = request.IsDefault,
            AvailableFrom = request.AvailableFrom,
            AvailableUntil = request.AvailableUntil,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.DivisionFees.Add(fee);
        await _context.SaveChangesAsync();

        return ServiceResult<DivisionFeeDto>.Ok(new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType.Name,
            Description = feeType.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        });
    }

    public async Task<ServiceResult<DivisionFeeDto>> UpdateDivisionFeeAsync(int divisionId, int feeId, int userId, DivisionFeeRequest request)
    {
        var fee = await _context.DivisionFees
            .Include(f => f.FeeType)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return ServiceResult<DivisionFeeDto>.NotFound("Fee not found");

        if (!await CanManageEventAsync(fee.EventId, userId))
            return ServiceResult<DivisionFeeDto>.Forbidden();

        EventFeeType? feeType = fee.FeeType;
        if (request.FeeTypeId != fee.FeeTypeId)
        {
            feeType = await _context.EventFeeTypes
                .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == fee.EventId);
            if (feeType == null)
                return ServiceResult<DivisionFeeDto>.Fail("Fee type not found for this event");
        }

        if (request.IsDefault && !fee.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.DivisionId == divisionId && f.IsDefault && f.Id != feeId)
                .ToListAsync();
            foreach (var existing in existingDefaults)
                existing.IsDefault = false;
        }

        fee.FeeTypeId = request.FeeTypeId;
        fee.Amount = request.Amount;
        fee.IsDefault = request.IsDefault;
        fee.AvailableFrom = request.AvailableFrom;
        fee.AvailableUntil = request.AvailableUntil;
        fee.IsActive = request.IsActive;
        fee.SortOrder = request.SortOrder;
        fee.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return ServiceResult<DivisionFeeDto>.Ok(new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType?.Name ?? "",
            Description = feeType?.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        });
    }

    public async Task<ServiceResult<bool>> DeleteDivisionFeeAsync(int divisionId, int feeId, int userId)
    {
        var fee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.Id == feeId && f.DivisionId == divisionId);

        if (fee == null)
            return ServiceResult<bool>.NotFound("Fee not found");

        if (!await CanManageEventAsync(fee.EventId, userId))
            return ServiceResult<bool>.Forbidden();

        var usedByMembers = await _context.EventUnitMembers.AnyAsync(m => m.SelectedFeeId == feeId);
        if (usedByMembers)
            return ServiceResult<bool>.Fail("Cannot delete fee that is in use by existing registrations");

        _context.DivisionFees.Remove(fee);
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<List<DivisionFeeDto>>> BulkUpdateDivisionFeesAsync(int divisionId, int userId, List<DivisionFeeRequest> fees)
    {
        var division = await _context.EventDivisions.FindAsync(divisionId);
        if (division == null)
            return ServiceResult<List<DivisionFeeDto>>.NotFound("Division not found");

        if (!await CanManageEventAsync(division.EventId, userId))
            return ServiceResult<List<DivisionFeeDto>>.Forbidden();

        var feeTypeIds = fees.Select(f => f.FeeTypeId).Distinct().ToList();
        var validFeeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == division.EventId && feeTypeIds.Contains(ft.Id))
            .ToDictionaryAsync(ft => ft.Id, ft => ft);

        var invalidIds = feeTypeIds.Where(id => !validFeeTypes.ContainsKey(id)).ToList();
        if (invalidIds.Any())
            return ServiceResult<List<DivisionFeeDto>>.Fail($"Invalid fee type IDs: {string.Join(", ", invalidIds)}");

        var existingFees = await _context.DivisionFees
            .Where(f => f.DivisionId == divisionId)
            .ToListAsync();

        var existingFeeIds = existingFees.Select(f => f.Id).ToList();
        var usedByMembers = await _context.EventUnitMembers
            .AnyAsync(m => m.SelectedFeeId != null && existingFeeIds.Contains(m.SelectedFeeId.Value));

        if (usedByMembers)
            return ServiceResult<List<DivisionFeeDto>>.Fail("Cannot replace fees that are in use by existing registrations. Please update individual fees instead.");

        _context.DivisionFees.RemoveRange(existingFees);

        var hasDefault = false;
        var newFees = fees.Select((f, index) => {
            var isDefault = f.IsDefault && !hasDefault;
            if (isDefault) hasDefault = true;
            return new DivisionFee
            {
                DivisionId = divisionId,
                EventId = division.EventId,
                FeeTypeId = f.FeeTypeId,
                Amount = f.Amount,
                IsDefault = isDefault,
                AvailableFrom = f.AvailableFrom,
                AvailableUntil = f.AvailableUntil,
                IsActive = f.IsActive,
                SortOrder = f.SortOrder > 0 ? f.SortOrder : index,
                CreatedAt = DateTime.UtcNow
            };
        }).ToList();

        _context.DivisionFees.AddRange(newFees);
        await _context.SaveChangesAsync();

        var result = newFees.OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = validFeeTypes[f.FeeTypeId].Name,
            Description = validFeeTypes[f.FeeTypeId].Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return ServiceResult<List<DivisionFeeDto>>.Ok(result);
    }

    // ===== Event Fees =====

    public async Task<ServiceResult<List<DivisionFeeDto>>> GetEventFeesAsync(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<List<DivisionFeeDto>>.NotFound("Event not found");

        var fees = await _context.DivisionFees
            .Include(f => f.FeeType)
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        return ServiceResult<List<DivisionFeeDto>>.Ok(fees.Select(MapToDto).ToList());
    }

    public async Task<ServiceResult<DivisionFeeDto>> CreateEventFeeAsync(int eventId, int userId, DivisionFeeRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<DivisionFeeDto>.NotFound("Event not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<DivisionFeeDto>.Forbidden();

        var feeType = await _context.EventFeeTypes
            .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return ServiceResult<DivisionFeeDto>.Fail("Fee type not found for this event");

        var existingFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.EventId == eventId && f.DivisionId == 0 && f.FeeTypeId == request.FeeTypeId);
        if (existingFee != null)
            return ServiceResult<DivisionFeeDto>.Fail("An event fee already exists for this fee type");

        if (request.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.EventId == eventId && f.DivisionId == 0 && f.IsDefault)
                .ToListAsync();
            foreach (var existingDefault in existingDefaults)
                existingDefault.IsDefault = false;
        }

        var fee = new DivisionFee
        {
            DivisionId = 0,
            EventId = eventId,
            FeeTypeId = request.FeeTypeId,
            Amount = request.Amount,
            IsDefault = request.IsDefault,
            AvailableFrom = request.AvailableFrom,
            AvailableUntil = request.AvailableUntil,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.DivisionFees.Add(fee);
        await _context.SaveChangesAsync();

        return ServiceResult<DivisionFeeDto>.Ok(new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = feeType.Name,
            Description = feeType.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        });
    }

    public async Task<ServiceResult<DivisionFeeDto>> UpdateEventFeeAsync(int eventId, int feeId, int userId, DivisionFeeRequest request)
    {
        var fee = await _context.DivisionFees
            .Include(f => f.FeeType)
            .FirstOrDefaultAsync(f => f.Id == feeId && f.EventId == eventId && f.DivisionId == 0);

        if (fee == null)
            return ServiceResult<DivisionFeeDto>.NotFound("Fee not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<DivisionFeeDto>.Forbidden();

        if (request.FeeTypeId != fee.FeeTypeId)
        {
            var feeType = await _context.EventFeeTypes
                .FirstOrDefaultAsync(ft => ft.Id == request.FeeTypeId && ft.EventId == eventId);
            if (feeType == null)
                return ServiceResult<DivisionFeeDto>.Fail("Fee type not found for this event");
        }

        if (request.IsDefault && !fee.IsDefault)
        {
            var existingDefaults = await _context.DivisionFees
                .Where(f => f.EventId == eventId && f.DivisionId == 0 && f.IsDefault && f.Id != feeId)
                .ToListAsync();
            foreach (var existing in existingDefaults)
                existing.IsDefault = false;
        }

        fee.FeeTypeId = request.FeeTypeId;
        fee.Amount = request.Amount;
        fee.IsDefault = request.IsDefault;
        fee.AvailableFrom = request.AvailableFrom;
        fee.AvailableUntil = request.AvailableUntil;
        fee.IsActive = request.IsActive;
        fee.SortOrder = request.SortOrder;
        fee.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (fee.FeeType == null || fee.FeeType.Id != fee.FeeTypeId)
            fee.FeeType = await _context.EventFeeTypes.FindAsync(fee.FeeTypeId);

        return ServiceResult<DivisionFeeDto>.Ok(new DivisionFeeDto
        {
            Id = fee.Id,
            DivisionId = fee.DivisionId,
            EventId = fee.EventId,
            FeeTypeId = fee.FeeTypeId,
            Name = fee.FeeType?.Name ?? "",
            Description = fee.FeeType?.Description,
            Amount = fee.Amount,
            IsDefault = fee.IsDefault,
            AvailableFrom = fee.AvailableFrom,
            AvailableUntil = fee.AvailableUntil,
            IsActive = fee.IsActive,
            SortOrder = fee.SortOrder,
            IsCurrentlyAvailable = fee.IsCurrentlyAvailable
        });
    }

    public async Task<ServiceResult<bool>> DeleteEventFeeAsync(int eventId, int feeId, int userId)
    {
        var fee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.Id == feeId && f.EventId == eventId && f.DivisionId == 0);

        if (fee == null)
            return ServiceResult<bool>.NotFound("Fee not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<bool>.Forbidden();

        var isInUse = await _context.EventUnitMembers.AnyAsync(m => m.SelectedFeeId == feeId);
        if (isInUse)
            return ServiceResult<bool>.Fail("Cannot delete fee that is in use by existing registrations");

        _context.DivisionFees.Remove(fee);
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<List<DivisionFeeDto>>> BulkUpdateEventFeesAsync(int eventId, int userId, List<DivisionFeeRequest> fees)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<List<DivisionFeeDto>>.NotFound("Event not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<List<DivisionFeeDto>>.Forbidden();

        var feeTypeIds = fees.Select(f => f.FeeTypeId).Distinct().ToList();
        var validFeeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == eventId && feeTypeIds.Contains(ft.Id))
            .ToDictionaryAsync(ft => ft.Id, ft => ft);

        var invalidIds = feeTypeIds.Where(id => !validFeeTypes.ContainsKey(id)).ToList();
        if (invalidIds.Any())
            return ServiceResult<List<DivisionFeeDto>>.Fail($"Invalid fee type IDs: {string.Join(", ", invalidIds)}");

        var existingFees = await _context.DivisionFees
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .ToListAsync();

        var existingFeeIds = existingFees.Select(f => f.Id).ToList();
        var usedByMembers = await _context.EventUnitMembers
            .AnyAsync(m => m.SelectedFeeId.HasValue && existingFeeIds.Contains(m.SelectedFeeId.Value));

        if (usedByMembers)
            return ServiceResult<List<DivisionFeeDto>>.Fail("Cannot replace fees that are in use by existing registrations. Please update individual fees instead.");

        _context.DivisionFees.RemoveRange(existingFees);

        var hasDefault = false;
        var newFees = fees.Select((f, index) => {
            var isDefault = f.IsDefault && !hasDefault;
            if (isDefault) hasDefault = true;
            return new DivisionFee
            {
                DivisionId = 0,
                EventId = eventId,
                FeeTypeId = f.FeeTypeId,
                Amount = f.Amount,
                IsDefault = isDefault,
                AvailableFrom = f.AvailableFrom,
                AvailableUntil = f.AvailableUntil,
                IsActive = f.IsActive,
                SortOrder = f.SortOrder > 0 ? f.SortOrder : index,
                CreatedAt = DateTime.UtcNow
            };
        }).ToList();

        _context.DivisionFees.AddRange(newFees);
        await _context.SaveChangesAsync();

        var result = newFees.OrderBy(f => f.SortOrder).Select(f => new DivisionFeeDto
        {
            Id = f.Id,
            DivisionId = f.DivisionId,
            EventId = f.EventId,
            FeeTypeId = f.FeeTypeId,
            Name = validFeeTypes[f.FeeTypeId].Name,
            Description = validFeeTypes[f.FeeTypeId].Description,
            Amount = f.Amount,
            IsDefault = f.IsDefault,
            AvailableFrom = f.AvailableFrom,
            AvailableUntil = f.AvailableUntil,
            IsActive = f.IsActive,
            SortOrder = f.SortOrder,
            IsCurrentlyAvailable = f.IsCurrentlyAvailable
        }).ToList();

        return ServiceResult<List<DivisionFeeDto>>.Ok(result);
    }

    // ===== Fee Types =====

    public async Task<ServiceResult<List<EventFeeTypeDto>>> GetEventFeeTypesAsync(int eventId)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<List<EventFeeTypeDto>>.NotFound("Event not found");

        var feeTypes = await _context.EventFeeTypes
            .Where(ft => ft.EventId == eventId)
            .OrderBy(ft => ft.SortOrder)
            .ToListAsync();

        var eventFees = await _context.DivisionFees
            .Where(f => f.EventId == eventId && f.DivisionId == 0)
            .ToListAsync();

        var result = feeTypes.Select(ft =>
        {
            var eventFee = eventFees.FirstOrDefault(f => f.FeeTypeId == ft.Id);
            return new EventFeeTypeDto
            {
                Id = ft.Id,
                EventId = ft.EventId,
                Name = ft.Name,
                Description = ft.Description,
                IsActive = ft.IsActive,
                SortOrder = ft.SortOrder,
                CreatedAt = ft.CreatedAt,
                EventFeeAmount = eventFee?.Amount,
                HasEventFee = eventFee != null
            };
        }).ToList();

        return ServiceResult<List<EventFeeTypeDto>>.Ok(result);
    }

    public async Task<ServiceResult<EventFeeTypeDto>> CreateEventFeeTypeAsync(int eventId, int userId, EventFeeTypeRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<EventFeeTypeDto>.NotFound("Event not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<EventFeeTypeDto>.Forbidden();

        var feeType = new EventFeeType
        {
            EventId = eventId,
            Name = request.Name,
            Description = request.Description,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.EventFeeTypes.Add(feeType);
        await _context.SaveChangesAsync();

        return ServiceResult<EventFeeTypeDto>.Ok(new EventFeeTypeDto
        {
            Id = feeType.Id,
            EventId = feeType.EventId,
            Name = feeType.Name,
            Description = feeType.Description,
            IsActive = feeType.IsActive,
            SortOrder = feeType.SortOrder,
            CreatedAt = feeType.CreatedAt
        });
    }

    public async Task<ServiceResult<EventFeeTypeDto>> UpdateEventFeeTypeAsync(int eventId, int feeTypeId, int userId, EventFeeTypeRequest request)
    {
        var feeType = await _context.EventFeeTypes.FirstOrDefaultAsync(ft => ft.Id == feeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return ServiceResult<EventFeeTypeDto>.NotFound("Fee type not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<EventFeeTypeDto>.Forbidden();

        feeType.Name = request.Name;
        feeType.Description = request.Description;
        feeType.IsActive = request.IsActive;
        feeType.SortOrder = request.SortOrder;
        feeType.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var eventFee = await _context.DivisionFees
            .FirstOrDefaultAsync(f => f.EventId == eventId && f.DivisionId == 0 && f.FeeTypeId == feeTypeId);

        return ServiceResult<EventFeeTypeDto>.Ok(new EventFeeTypeDto
        {
            Id = feeType.Id,
            EventId = feeType.EventId,
            Name = feeType.Name,
            Description = feeType.Description,
            IsActive = feeType.IsActive,
            SortOrder = feeType.SortOrder,
            CreatedAt = feeType.CreatedAt,
            EventFeeAmount = eventFee?.Amount,
            HasEventFee = eventFee != null
        });
    }

    public async Task<ServiceResult<bool>> DeleteEventFeeTypeAsync(int eventId, int feeTypeId, int userId)
    {
        var feeType = await _context.EventFeeTypes.FirstOrDefaultAsync(ft => ft.Id == feeTypeId && ft.EventId == eventId);
        if (feeType == null)
            return ServiceResult<bool>.NotFound("Fee type not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<bool>.Forbidden();

        var usageCount = await _context.DivisionFees.CountAsync(f => f.FeeTypeId == feeTypeId);
        if (usageCount > 0)
            return ServiceResult<bool>.Fail($"Cannot delete fee type - it is used by {usageCount} fee(s). Remove the fees first or update them to use a different fee type.");

        _context.EventFeeTypes.Remove(feeType);
        await _context.SaveChangesAsync();

        return ServiceResult<bool>.Ok(true);
    }

    public async Task<ServiceResult<List<EventFeeTypeDto>>> BulkUpdateEventFeeTypesAsync(int eventId, int userId, BulkEventFeeTypesRequest request)
    {
        var evt = await _context.Events.FindAsync(eventId);
        if (evt == null)
            return ServiceResult<List<EventFeeTypeDto>>.NotFound("Event not found");

        if (!await CanManageEventAsync(eventId, userId))
            return ServiceResult<List<EventFeeTypeDto>>.Forbidden();

        var existingFeeTypes = await _context.EventFeeTypes.Where(ft => ft.EventId == eventId).ToListAsync();

        var existingIds = existingFeeTypes.Select(ft => ft.Id).ToList();
        var usedFeeTypeIds = await _context.DivisionFees
            .Where(f => existingIds.Contains(f.FeeTypeId))
            .Select(f => f.FeeTypeId)
            .Distinct()
            .ToListAsync();

        var feeTypesToDelete = existingFeeTypes.Where(ft => !usedFeeTypeIds.Contains(ft.Id)).ToList();
        _context.EventFeeTypes.RemoveRange(feeTypesToDelete);

        var newFeeTypes = request.FeeTypes.Select((ft, index) => new EventFeeType
        {
            EventId = eventId,
            Name = ft.Name,
            Description = ft.Description,
            IsActive = ft.IsActive,
            SortOrder = ft.SortOrder > 0 ? ft.SortOrder : index,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.EventFeeTypes.AddRange(newFeeTypes);
        await _context.SaveChangesAsync();

        var result = newFeeTypes.OrderBy(ft => ft.SortOrder).Select(ft => new EventFeeTypeDto
        {
            Id = ft.Id,
            EventId = ft.EventId,
            Name = ft.Name,
            Description = ft.Description,
            IsActive = ft.IsActive,
            SortOrder = ft.SortOrder,
            CreatedAt = ft.CreatedAt
        }).ToList();

        return ServiceResult<List<EventFeeTypeDto>>.Ok(result);
    }

    // ===== Helpers =====

    private DivisionFeeDto MapToDto(DivisionFee f) => new()
    {
        Id = f.Id,
        DivisionId = f.DivisionId,
        EventId = f.EventId,
        FeeTypeId = f.FeeTypeId,
        Name = f.FeeType?.Name ?? "",
        Description = f.FeeType?.Description,
        Amount = f.Amount,
        IsDefault = f.IsDefault,
        AvailableFrom = f.AvailableFrom,
        AvailableUntil = f.AvailableUntil,
        IsActive = f.IsActive,
        SortOrder = f.SortOrder,
        IsCurrentlyAvailable = f.IsCurrentlyAvailable
    };

    private async Task<bool> CanManageEventAsync(int eventId, int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user?.Role == "Admin") return true;

        var evt = await _context.Events.FindAsync(eventId);
        if (evt?.OrganizedByUserId == userId) return true;

        var staff = await _context.EventStaff
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.EventId == eventId
                                   && s.UserId == userId
                                   && s.Status == "Active"
                                   && s.Role != null
                                   && s.Role.CanFullyManageEvent);
        return staff != null;
    }
}
