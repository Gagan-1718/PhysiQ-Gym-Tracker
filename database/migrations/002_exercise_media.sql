-- =============================================================================
-- Migration 002: exercise demonstrations for the guided workout
--
-- Each exercise can point at a pair of demonstration drawings (start and end
-- position) served from public/exercises/<media_key>/0.svg and 1.svg; the
-- guided workout fades between them like a short animation.
-- media_key is NULL for exercises without drawings (e.g. ones an admin adds
-- later); the app then shows the muscle group instead.
-- =============================================================================

USE physiq_db;

ALTER TABLE exercises
    ADD COLUMN media_key VARCHAR(60) NULL
        COMMENT 'folder under public/exercises with 0.svg and 1.svg; NULL = no drawings'
        AFTER instructions,
    ADD CONSTRAINT chk_exercises_media_key
        CHECK (media_key IS NULL OR REGEXP_LIKE(media_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c'));
