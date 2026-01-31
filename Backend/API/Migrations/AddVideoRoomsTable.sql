-- Migration: Add VideoRooms table for WebRTC video chat rooms
-- Run this against the SQL Server database

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'VideoRooms')
BEGIN
    CREATE TABLE VideoRooms (
        RoomId INT IDENTITY(1,1) PRIMARY KEY,
        RoomCode NVARCHAR(20) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        PasscodeHash NVARCHAR(128) NOT NULL,
        CreatedBy INT NULL,
        CreatorName NVARCHAR(200) NULL,
        MaxParticipants INT NOT NULL DEFAULT 6,
        IsActive BIT NOT NULL DEFAULT 1,
        IsLocked BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        EndedAt DATETIME2 NULL,
        
        CONSTRAINT FK_VideoRooms_Creator FOREIGN KEY (CreatedBy) 
            REFERENCES Users(Id) ON DELETE SET NULL
    );

    CREATE UNIQUE INDEX IX_VideoRooms_RoomCode ON VideoRooms (RoomCode);
    CREATE INDEX IX_VideoRooms_IsActive ON VideoRooms (IsActive);
    CREATE INDEX IX_VideoRooms_CreatedBy ON VideoRooms (CreatedBy);

    PRINT 'VideoRooms table created successfully.';
END
ELSE
BEGIN
    PRINT 'VideoRooms table already exists.';
END
GO
