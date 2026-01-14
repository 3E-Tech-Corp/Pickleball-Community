-- Migration 089: Add per-game format fields to EventDivisions
-- Allows setting different game formats for Game 1, 2, 3 in a match (Best of 3/5)

PRINT 'Migration 089: Adding per-game format fields to EventDivisions...'

-- Add Game1ScoreFormatId column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'Game1ScoreFormatId')
BEGIN
    ALTER TABLE EventDivisions ADD Game1ScoreFormatId INT NULL
    PRINT 'Added Game1ScoreFormatId column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'Game1ScoreFormatId column already exists'
END

-- Add Game2ScoreFormatId column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'Game2ScoreFormatId')
BEGIN
    ALTER TABLE EventDivisions ADD Game2ScoreFormatId INT NULL
    PRINT 'Added Game2ScoreFormatId column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'Game2ScoreFormatId column already exists'
END

-- Add Game3ScoreFormatId column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventDivisions') AND name = 'Game3ScoreFormatId')
BEGIN
    ALTER TABLE EventDivisions ADD Game3ScoreFormatId INT NULL
    PRINT 'Added Game3ScoreFormatId column to EventDivisions'
END
ELSE
BEGIN
    PRINT 'Game3ScoreFormatId column already exists'
END

-- Add foreign key constraints
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventDivisions_ScoreFormats_Game1')
BEGIN
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_ScoreFormats_Game1
        FOREIGN KEY (Game1ScoreFormatId) REFERENCES ScoreFormats(Id)
    PRINT 'Added FK_EventDivisions_ScoreFormats_Game1 foreign key'
END
ELSE
BEGIN
    PRINT 'FK_EventDivisions_ScoreFormats_Game1 already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventDivisions_ScoreFormats_Game2')
BEGIN
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_ScoreFormats_Game2
        FOREIGN KEY (Game2ScoreFormatId) REFERENCES ScoreFormats(Id)
    PRINT 'Added FK_EventDivisions_ScoreFormats_Game2 foreign key'
END
ELSE
BEGIN
    PRINT 'FK_EventDivisions_ScoreFormats_Game2 already exists'
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EventDivisions_ScoreFormats_Game3')
BEGIN
    ALTER TABLE EventDivisions ADD CONSTRAINT FK_EventDivisions_ScoreFormats_Game3
        FOREIGN KEY (Game3ScoreFormatId) REFERENCES ScoreFormats(Id)
    PRINT 'Added FK_EventDivisions_ScoreFormats_Game3 foreign key'
END
ELSE
BEGIN
    PRINT 'FK_EventDivisions_ScoreFormats_Game3 already exists'
END

PRINT 'Migration 089 completed successfully'
