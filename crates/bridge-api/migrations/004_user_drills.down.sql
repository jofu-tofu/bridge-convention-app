-- Documentation-only down migration for 004_user_drills.sql.
-- sqlx does not auto-apply this; authoring it forces verification that the
-- schema is cleanly reversible.

DROP INDEX IF EXISTS idx_user_drills_list;
DROP TABLE IF EXISTS user_drill_modules;
DROP TABLE IF EXISTS user_drills;
