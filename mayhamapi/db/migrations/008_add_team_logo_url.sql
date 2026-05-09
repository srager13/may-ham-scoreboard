-- Migration: add logo_url to teams
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1024);

-- No-op if column already exists
