-- Migration: Add Group Access Control Features
-- This migration adds:
-- - is_public column to groups table
-- - password_hash column for private group join
-- - group_invitations table for invite links
-- - group_join_requests table for join requests
-- - Updated role column to include 'owner' role

-- Add is_public column to groups table (default to true for backward compatibility)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'is_public'
    ) THEN
        ALTER TABLE groups ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Add password_hash column for private groups
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'groups' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE groups ADD COLUMN password_hash VARCHAR(255);
    END IF;
END $$;

-- Update role check to include 'owner' role
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE group_members ADD CONSTRAINT group_members_role_check 
    CHECK (role IN ('owner', 'admin', 'member'));

-- Create group_invitations table for invite links
CREATE TABLE IF NOT EXISTS group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON group_invitations(token);

-- Create group_join_requests table for requesting to join private groups
CREATE TABLE IF NOT EXISTS group_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_group_id ON group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_user_id ON group_join_requests(user_id);

-- Create trigger to update updated_at on group_join_requests
CREATE OR REPLACE FUNCTION update_group_join_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_group_join_requests_updated_at ON group_join_requests;
CREATE TRIGGER update_group_join_requests_updated_at 
    BEFORE UPDATE ON group_join_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_group_join_requests_updated_at();

-- Migrate existing admin members to also be owners (for backward compatibility)
UPDATE group_members gm
SET role = 'owner'
WHERE gm.role = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM group_members gm2 
    WHERE gm2.group_id = gm.group_id AND gm2.role = 'owner'
);
