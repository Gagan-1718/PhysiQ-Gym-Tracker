-- =============================================================================
-- PhysiQ database roles (MySQL 8 roles): least privilege for the web application
--
-- The app must NOT connect as root. scripts/init-db.js creates an application
-- account from MYSQL_APP_USER / MYSQL_APP_PASSWORD and grants it physiq_app.
--
--   physiq_app       what the web app needs and nothing more:
--                    read and write rows, run the stored routines.
--                    NOT: create / alter / drop, grants, other databases, files.
--   physiq_readonly  for analysts and the viva: SELECT only.
--
-- Triggers, views and procedures run with their DEFINER's rights, so the app
-- never needs the TRIGGER or CREATE ROUTINE privileges to benefit from them.
-- =============================================================================

USE physiq_db;

CREATE ROLE IF NOT EXISTS 'physiq_app', 'physiq_readonly';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON physiq_db.* TO 'physiq_app';
GRANT SELECT ON physiq_db.* TO 'physiq_readonly';
