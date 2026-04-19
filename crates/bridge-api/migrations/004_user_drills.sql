-- vulnerability_distribution: {none: number, ours: number, theirs: number, both: number}
-- pinned to v1. Any shape change requires a new migration that bumps
-- vulnerability_distribution_version and rewrites affected rows.

CREATE TABLE user_drills (
    id                                 TEXT PRIMARY KEY,
    user_id                            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                               TEXT NOT NULL,
    practice_mode                      TEXT NOT NULL,
    practice_role                      TEXT NOT NULL,
    system_selection_id                TEXT NOT NULL,
    opponent_mode                      TEXT NOT NULL,
    play_profile_id                    TEXT NOT NULL,
    vulnerability_distribution         TEXT NOT NULL,
    vulnerability_distribution_version INTEGER NOT NULL DEFAULT 1,
    show_educational_annotations       INTEGER NOT NULL,
    created_at                         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                         TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at                       TEXT,
    deleted_at                         TEXT
);

CREATE TABLE user_drill_modules (
    drill_id  TEXT NOT NULL REFERENCES user_drills(id) ON DELETE CASCADE,
    position  INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    PRIMARY KEY (drill_id, position)
);

CREATE INDEX idx_user_drills_list
    ON user_drills (user_id, deleted_at, last_used_at DESC, updated_at DESC);
