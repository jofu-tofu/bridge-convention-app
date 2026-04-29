use sqlx::SqlitePool;

use super::models::{DrillModuleRow, DrillRow};

pub async fn list_drills(
    pool: &SqlitePool,
    user_id: &str,
) -> Result<Vec<(DrillRow, Vec<DrillModuleRow>)>, sqlx::Error> {
    let rows: Vec<DrillRow> = sqlx::query_as(
        "SELECT id, user_id, name, practice_mode, practice_role, system_selection_id, \
                opponent_mode, play_profile_id, vulnerability_distribution, \
                vulnerability_distribution_version, show_educational_annotations, \
                created_at, updated_at, last_used_at, deleted_at \
         FROM user_drills \
         WHERE user_id = ? AND deleted_at IS NULL \
         ORDER BY (last_used_at IS NULL) ASC, last_used_at DESC, updated_at DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let modules = list_modules_for_drill(pool, &row.id).await?;
        out.push((row, modules));
    }
    Ok(out)
}

pub async fn get_drill(
    pool: &SqlitePool,
    user_id: &str,
    drill_id: &str,
) -> Result<Option<(DrillRow, Vec<DrillModuleRow>)>, sqlx::Error> {
    let row: Option<DrillRow> = sqlx::query_as(
        "SELECT id, user_id, name, practice_mode, practice_role, system_selection_id, \
                opponent_mode, play_profile_id, vulnerability_distribution, \
                vulnerability_distribution_version, show_educational_annotations, \
                created_at, updated_at, last_used_at, deleted_at \
         FROM user_drills \
         WHERE user_id = ? AND id = ? AND deleted_at IS NULL",
    )
    .bind(user_id)
    .bind(drill_id)
    .fetch_optional(pool)
    .await?;

    match row {
        None => Ok(None),
        Some(row) => {
            let modules = list_modules_for_drill(pool, &row.id).await?;
            Ok(Some((row, modules)))
        }
    }
}

pub async fn drill_exists_any_state(
    pool: &SqlitePool,
    user_id: &str,
    drill_id: &str,
) -> Result<bool, sqlx::Error> {
    let exists: Option<i64> =
        sqlx::query_scalar("SELECT 1 FROM user_drills WHERE user_id = ? AND id = ? LIMIT 1")
            .bind(user_id)
            .bind(drill_id)
            .fetch_optional(pool)
            .await?;
    Ok(exists.is_some())
}

async fn list_modules_for_drill(
    pool: &SqlitePool,
    drill_id: &str,
) -> Result<Vec<DrillModuleRow>, sqlx::Error> {
    sqlx::query_as(
        "SELECT drill_id, position, module_id \
         FROM user_drill_modules \
         WHERE drill_id = ? \
         ORDER BY position ASC",
    )
    .bind(drill_id)
    .fetch_all(pool)
    .await
}

pub struct InsertDrill<'a> {
    pub id: &'a str,
    pub user_id: &'a str,
    pub name: &'a str,
    pub practice_mode: &'a str,
    pub practice_role: &'a str,
    pub system_selection_id: &'a str,
    pub opponent_mode: &'a str,
    pub play_profile_id: &'a str,
    pub vulnerability_distribution_json: &'a str,
    pub show_educational_annotations: bool,
    pub module_ids: &'a [String],
}

pub async fn insert_drill(pool: &SqlitePool, drill: InsertDrill<'_>) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO user_drills (\
            id, user_id, name, practice_mode, practice_role, system_selection_id, \
            opponent_mode, play_profile_id, vulnerability_distribution, \
            show_educational_annotations\
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(drill.id)
    .bind(drill.user_id)
    .bind(drill.name)
    .bind(drill.practice_mode)
    .bind(drill.practice_role)
    .bind(drill.system_selection_id)
    .bind(drill.opponent_mode)
    .bind(drill.play_profile_id)
    .bind(drill.vulnerability_distribution_json)
    .bind(if drill.show_educational_annotations {
        1_i64
    } else {
        0_i64
    })
    .execute(&mut *tx)
    .await?;

    for (position, module_id) in drill.module_ids.iter().enumerate() {
        sqlx::query(
            "INSERT INTO user_drill_modules (drill_id, position, module_id) VALUES (?, ?, ?)",
        )
        .bind(drill.id)
        .bind(position as i64)
        .bind(module_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub struct UpdateDrill<'a> {
    pub id: &'a str,
    pub user_id: &'a str,
    pub name: &'a str,
    pub practice_mode: &'a str,
    pub practice_role: &'a str,
    pub system_selection_id: &'a str,
    pub opponent_mode: &'a str,
    pub play_profile_id: &'a str,
    pub vulnerability_distribution_json: &'a str,
    pub show_educational_annotations: bool,
    pub module_ids: &'a [String],
}

pub async fn update_drill(pool: &SqlitePool, drill: UpdateDrill<'_>) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "UPDATE user_drills SET \
            name = ?, practice_mode = ?, practice_role = ?, system_selection_id = ?, \
            opponent_mode = ?, play_profile_id = ?, vulnerability_distribution = ?, \
            show_educational_annotations = ?, updated_at = datetime('now') \
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
    .bind(drill.name)
    .bind(drill.practice_mode)
    .bind(drill.practice_role)
    .bind(drill.system_selection_id)
    .bind(drill.opponent_mode)
    .bind(drill.play_profile_id)
    .bind(drill.vulnerability_distribution_json)
    .bind(if drill.show_educational_annotations {
        1_i64
    } else {
        0_i64
    })
    .bind(drill.id)
    .bind(drill.user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM user_drill_modules WHERE drill_id = ?")
        .bind(drill.id)
        .execute(&mut *tx)
        .await?;

    for (position, module_id) in drill.module_ids.iter().enumerate() {
        sqlx::query(
            "INSERT INTO user_drill_modules (drill_id, position, module_id) VALUES (?, ?, ?)",
        )
        .bind(drill.id)
        .bind(position as i64)
        .bind(module_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn soft_delete(
    pool: &SqlitePool,
    user_id: &str,
    drill_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE user_drills SET deleted_at = datetime('now') \
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
    .bind(drill_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn mark_launched(
    pool: &SqlitePool,
    user_id: &str,
    drill_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE user_drills SET last_used_at = datetime('now') \
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    )
    .bind(drill_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}
