-- SQL to create a dedicated backup user with minimal privileges required
-- for performing pg_dump on the application database.
-- Usage: psql -U postgres -f setup-backup-user.sql

-- Change these as needed before running
\set BACKUP_USER 'mayham_backup_user'
\set BACKUP_PASS 'CHANGE_ME_BACKUP_PASSWORD'
\set DB_NAME 'mayham_prod'

-- Create role if not exists (psql variables are expanded with :'name')
\set q_backup_user '''' :BACKUP_USER ''''
\set q_backup_pass '''' :BACKUP_PASS ''''
\set q_db_name '''' :DB_NAME ''''

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :BACKUP_USER) THEN
       EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L;', :BACKUP_USER, :BACKUP_PASS);
   END IF;
END
$$;

-- Grant connect on the database
EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I;', :DB_NAME, :BACKUP_USER);

-- Connect to the target DB
\c :DB_NAME

-- Grant usage on public schema
EXECUTE format('GRANT USAGE ON SCHEMA public TO %I;', :BACKUP_USER);

-- Grant read-only on tables and sequences
EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA public TO %I;', :BACKUP_USER);
EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO %I;', :BACKUP_USER);

-- Ensure future tables/sequences are readable
EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO %I;', :BACKUP_USER);
EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO %I;', :BACKUP_USER);

\echo 'Backup user setup complete: ' :BACKUP_USER
