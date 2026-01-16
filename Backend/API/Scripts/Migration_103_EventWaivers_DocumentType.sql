-- Migration 103: Add DocumentType column to EventWaivers table
-- Supports different document types: waiver, map, rules, contacts

PRINT 'Starting Migration 103: Add DocumentType to EventWaivers'
GO

-- Add DocumentType column to EventWaivers if it doesn't exist
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'EventWaivers' AND COLUMN_NAME = 'DocumentType'
)
BEGIN
    PRINT 'Adding DocumentType column to EventWaivers...'
    ALTER TABLE EventWaivers ADD DocumentType NVARCHAR(50) NOT NULL DEFAULT 'waiver'
    PRINT 'DocumentType column added'
END
ELSE
BEGIN
    PRINT 'DocumentType column already exists'
END
GO

-- Update any existing records to ensure they have the default value
UPDATE EventWaivers SET DocumentType = 'waiver' WHERE DocumentType IS NULL OR DocumentType = ''
PRINT 'Updated existing records with default DocumentType'
GO

PRINT 'Migration 103 completed successfully'
GO
