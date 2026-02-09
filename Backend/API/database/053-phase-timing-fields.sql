-- Add timing configuration fields to DivisionPhases for court scheduling
-- GameDurationMinutes: per-game estimate (e.g., 12 for rally to 11, 18 for rally to 21)
-- ChangeoverMinutes: time between games within same match
-- MatchBufferMinutes: buffer between different matches on same court

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'GameDurationMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD GameDurationMinutes INT NULL;
    PRINT 'Added GameDurationMinutes to DivisionPhases';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'ChangeoverMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD ChangeoverMinutes INT NOT NULL DEFAULT 2;
    PRINT 'Added ChangeoverMinutes to DivisionPhases';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('DivisionPhases') AND name = 'MatchBufferMinutes')
BEGIN
    ALTER TABLE DivisionPhases ADD MatchBufferMinutes INT NOT NULL DEFAULT 5;
    PRINT 'Added MatchBufferMinutes to DivisionPhases';
END
GO
