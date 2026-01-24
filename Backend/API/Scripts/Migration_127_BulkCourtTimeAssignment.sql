-- Migration 127: Bulk Court/Time Assignment Stored Procedure
-- Avoids EF Core query generation issues with Contains() on lists

PRINT 'Creating sp_BulkAssignCourtsAndTimes stored procedure...'

CREATE OR ALTER PROCEDURE sp_BulkAssignCourtsAndTimes
    @EventId INT,
    @AssignmentsJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    -- Parse JSON assignments and update encounters
    -- JSON format: [{"EncounterId": 1, "CourtId": 2, "ScheduledTime": "2024-01-15T10:00:00", "EstimatedStartTime": "2024-01-15T10:00:00"}, ...]

    DECLARE @Now DATETIME = GETDATE();
    DECLARE @UpdatedCount INT = 0;

    -- Create temp table from JSON
    SELECT
        JSON_VALUE(j.value, '$.EncounterId') AS EncounterId,
        JSON_VALUE(j.value, '$.CourtId') AS CourtId,
        JSON_VALUE(j.value, '$.ScheduledTime') AS ScheduledTime,
        JSON_VALUE(j.value, '$.EstimatedStartTime') AS EstimatedStartTime
    INTO #Assignments
    FROM OPENJSON(@AssignmentsJson) j;

    -- Update encounters
    UPDATE e
    SET
        e.TournamentCourtId = CAST(a.CourtId AS INT),
        e.ScheduledTime = CASE WHEN a.ScheduledTime IS NOT NULL THEN CAST(a.ScheduledTime AS DATETIME2) ELSE e.ScheduledTime END,
        e.EstimatedStartTime = CASE WHEN a.EstimatedStartTime IS NOT NULL THEN CAST(a.EstimatedStartTime AS DATETIME2) ELSE e.EstimatedStartTime END,
        e.UpdatedAt = @Now
    FROM EventEncounters e
    INNER JOIN #Assignments a ON e.Id = CAST(a.EncounterId AS INT)
    WHERE e.EventId = @EventId;

    SET @UpdatedCount = @@ROWCOUNT;

    DROP TABLE #Assignments;

    -- Return as Value column for EF Core SqlQueryRaw<int>
    SELECT @UpdatedCount AS Value;
END
GO

PRINT 'Migration 127 completed successfully.'
