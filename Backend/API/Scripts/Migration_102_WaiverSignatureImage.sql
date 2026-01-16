-- Migration 102: Add waiver signature fields to EventUnitMembers
-- Stores URLs for signature image and signed PDF via asset management

PRINT 'Starting Migration 102 - Waiver Signature Assets...'

-- Add SignatureAssetUrl column to EventUnitMembers (URL to drawn signature image)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignatureAssetUrl')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignatureAssetUrl NVARCHAR(500) NULL;
    PRINT 'Added SignatureAssetUrl column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignatureAssetUrl column already exists in EventUnitMembers';
END

-- Add SignedWaiverPdfUrl column (URL to generated PDF of signed waiver)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignedWaiverPdfUrl')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignedWaiverPdfUrl NVARCHAR(500) NULL;
    PRINT 'Added SignedWaiverPdfUrl column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignedWaiverPdfUrl column already exists in EventUnitMembers';
END

-- Add SignerEmail column to track the email address at time of signing (for legal record)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignerEmail')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignerEmail NVARCHAR(255) NULL;
    PRINT 'Added SignerEmail column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignerEmail column already exists in EventUnitMembers';
END

-- Add SignerIpAddress column for legal record
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EventUnitMembers') AND name = 'SignerIpAddress')
BEGIN
    ALTER TABLE EventUnitMembers ADD SignerIpAddress NVARCHAR(50) NULL;
    PRINT 'Added SignerIpAddress column to EventUnitMembers';
END
ELSE
BEGIN
    PRINT 'SignerIpAddress column already exists in EventUnitMembers';
END

GO

-- Create stored procedure stub for sending waiver signed notification
-- This will be called after waiver is signed to trigger email notification
CREATE OR ALTER PROCEDURE [dbo].[sp_SendWaiverSignedNotification]
    @EventId INT,
    @UserId INT,
    @UserEmail NVARCHAR(255),
    @UserName NVARCHAR(200),
    @EventName NVARCHAR(200),
    @WaiverTitle NVARCHAR(200),
    @SignedAt DATETIME,
    @SignatureAssetUrl NVARCHAR(500),
    @SignedWaiverPdfUrl NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    -- TODO: Implement email notification logic here
    -- This procedure should:
    -- 1. Send email to user with signed waiver PDF attached
    -- 2. Send email to event admin/organizer with notification
    -- 3. Log the notification in your notification system

    PRINT 'Waiver signed notification - EventId: ' + CAST(@EventId AS VARCHAR) +
          ', UserId: ' + CAST(@UserId AS VARCHAR) +
          ', Email: ' + @UserEmail;

    -- Placeholder - return success
    SELECT 1 AS Success, 'Notification queued' AS Message;
END
GO

PRINT 'Migration 102 completed successfully';
