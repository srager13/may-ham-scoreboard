-- Migration 003: Add password_hash column to users table
-- Passwords are stored as bcrypt hashes (cost factor 12).
-- Existing rows will have a NULL password_hash; those users must
-- re-register or have their password set via the API before they
-- can log in.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
