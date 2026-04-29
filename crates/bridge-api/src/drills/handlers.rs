use std::collections::HashSet;

use axum::extract::{Path as AxumPath, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use axum_extra::extract::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::models::User;
use crate::auth::session;
use crate::billing::entitlements::tier_for;
use crate::error::AppError;
use crate::AppState;

use super::entitlement::{blocked_modules, unknown_modules};
use super::models::{DrillModuleRow, DrillRow, VulnerabilityDistribution};
use super::repository::{self, InsertDrill, UpdateDrill};

const DRILL_NAME_MAX: usize = 80;
const DRILL_MODULE_IDS_MAX: usize = 16;

/// API DTO. Wire shape is camelCase, mirroring `Drill` in
/// `src/stores/drills.svelte.ts`. Never returned as a `DrillRow` directly —
/// always converted via `From<(DrillRow, Vec<DrillModuleRow>)>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillPayload {
    pub id: String,
    pub name: String,
    pub module_ids: Vec<String>,
    pub practice_mode: String,
    pub practice_role: String,
    pub system_selection_id: String,
    pub opponent_mode: String,
    pub play_profile_id: String,
    pub vulnerability_distribution: VulnerabilityDistribution,
    pub show_educational_annotations: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DrillRequest {
    pub id: Option<String>,
    pub name: String,
    pub module_ids: Vec<String>,
    pub practice_mode: String,
    pub practice_role: String,
    pub system_selection_id: String,
    pub opponent_mode: String,
    pub play_profile_id: String,
    pub vulnerability_distribution: VulnerabilityDistribution,
    pub show_educational_annotations: bool,
}

#[derive(Serialize)]
struct DrillResponse {
    drill: DrillPayload,
}

#[derive(Serialize)]
struct DrillsResponse {
    drills: Vec<DrillPayload>,
}

impl From<(DrillRow, Vec<DrillModuleRow>)> for DrillPayload {
    fn from((row, modules): (DrillRow, Vec<DrillModuleRow>)) -> Self {
        let vulnerability_distribution =
            serde_json::from_str::<VulnerabilityDistribution>(&row.vulnerability_distribution)
                .unwrap_or(VulnerabilityDistribution {
                    none: 1.0,
                    ours: 0.0,
                    theirs: 0.0,
                    both: 0.0,
                });

        let mut module_ids: Vec<String> = modules.into_iter().map(|m| m.module_id).collect();
        // already sorted by position in repository, but defend against drift
        module_ids.shrink_to_fit();

        DrillPayload {
            id: row.id,
            name: row.name,
            module_ids,
            practice_mode: row.practice_mode,
            practice_role: row.practice_role,
            system_selection_id: row.system_selection_id,
            opponent_mode: row.opponent_mode,
            play_profile_id: row.play_profile_id,
            vulnerability_distribution,
            show_educational_annotations: row.show_educational_annotations != 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
            last_used_at: row.last_used_at,
        }
    }
}

// ─── Handlers ──────────────────────────────────────────────

pub async fn list_drills(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Response, AppError> {
    let user = match require_user(&state, &jar).await? {
        Some(user) => user,
        None => return Ok(unauthenticated_response()),
    };
    let rows = repository::list_drills(&state.pool, &user.id).await?;
    let drills: Vec<DrillPayload> = rows.into_iter().map(DrillPayload::from).collect();
    Ok(Json(DrillsResponse { drills }).into_response())
}

pub async fn create_drill(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<DrillRequest>,
) -> Result<Response, AppError> {
    let user = match require_user(&state, &jar).await? {
        Some(user) => user,
        None => return Ok(unauthenticated_response()),
    };

    let id =
        req.id.as_deref().map(str::to_string).unwrap_or_else(|| {
            format!("drill:{}", &uuid::Uuid::new_v4().simple().to_string()[..8])
        });

    if let Err(resp) = validate_drill_id(&id) {
        return Ok(resp);
    }
    if let Err(resp) = validate_request(&req) {
        return Ok(resp);
    }

    let unknown = unknown_modules(&req.module_ids);
    if !unknown.is_empty() {
        return Ok(unknown_module_response(unknown));
    }

    let tier = tier_for(
        user.subscription_status.as_deref(),
        user.subscription_current_period_end,
        Utc::now().timestamp(),
    );
    let blocked = blocked_modules(tier, &req.module_ids);
    if !blocked.is_empty() {
        return Ok(convention_locked_response(blocked));
    }

    let vuln_json = serde_json::to_string(&req.vulnerability_distribution)
        .map_err(|err| AppError::Internal(format!("vuln serialize: {err}")))?;

    repository::insert_drill(
        &state.pool,
        InsertDrill {
            id: &id,
            user_id: &user.id,
            name: req.name.trim(),
            practice_mode: &req.practice_mode,
            practice_role: &req.practice_role,
            system_selection_id: &req.system_selection_id,
            opponent_mode: &req.opponent_mode,
            play_profile_id: &req.play_profile_id,
            vulnerability_distribution_json: &vuln_json,
            show_educational_annotations: req.show_educational_annotations,
            module_ids: &req.module_ids,
        },
    )
    .await?;

    let saved = repository::get_drill(&state.pool, &user.id, &id).await?;
    let drill = saved
        .map(DrillPayload::from)
        .ok_or_else(|| AppError::Internal("drill should exist after insert".into()))?;

    Ok((StatusCode::CREATED, Json(DrillResponse { drill })).into_response())
}

pub async fn update_drill(
    State(state): State<AppState>,
    jar: CookieJar,
    AxumPath(id): AxumPath<String>,
    Json(req): Json<DrillRequest>,
) -> Result<Response, AppError> {
    let user = match require_user(&state, &jar).await? {
        Some(user) => user,
        None => return Ok(unauthenticated_response()),
    };

    if let Err(resp) = validate_drill_id(&id) {
        return Ok(resp);
    }
    if let Err(resp) = validate_request(&req) {
        return Ok(resp);
    }

    let existing = match repository::get_drill(&state.pool, &user.id, &id).await? {
        Some(existing) => existing,
        None => return Ok(not_found_response()),
    };
    let stored_module_ids: HashSet<&str> =
        existing.1.iter().map(|m| m.module_id.as_str()).collect();

    let unknown = unknown_modules(&req.module_ids);
    if !unknown.is_empty() {
        return Ok(unknown_module_response(unknown));
    }

    let added: Vec<String> = req
        .module_ids
        .iter()
        .filter(|id| !stored_module_ids.contains(id.as_str()))
        .cloned()
        .collect();

    if !added.is_empty() {
        let tier = tier_for(
            user.subscription_status.as_deref(),
            user.subscription_current_period_end,
            Utc::now().timestamp(),
        );
        let blocked = blocked_modules(tier, &added);
        if !blocked.is_empty() {
            return Ok(convention_locked_response(blocked));
        }
    }

    let vuln_json = serde_json::to_string(&req.vulnerability_distribution)
        .map_err(|err| AppError::Internal(format!("vuln serialize: {err}")))?;

    repository::update_drill(
        &state.pool,
        UpdateDrill {
            id: &id,
            user_id: &user.id,
            name: req.name.trim(),
            practice_mode: &req.practice_mode,
            practice_role: &req.practice_role,
            system_selection_id: &req.system_selection_id,
            opponent_mode: &req.opponent_mode,
            play_profile_id: &req.play_profile_id,
            vulnerability_distribution_json: &vuln_json,
            show_educational_annotations: req.show_educational_annotations,
            module_ids: &req.module_ids,
        },
    )
    .await?;

    let saved = repository::get_drill(&state.pool, &user.id, &id).await?;
    let drill = saved
        .map(DrillPayload::from)
        .ok_or_else(|| AppError::Internal("drill should exist after update".into()))?;

    Ok(Json(DrillResponse { drill }).into_response())
}

pub async fn delete_drill(
    State(state): State<AppState>,
    jar: CookieJar,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, AppError> {
    let user = match require_user(&state, &jar).await? {
        Some(user) => user,
        None => return Ok(unauthenticated_response()),
    };

    if let Err(resp) = validate_drill_id(&id) {
        return Ok(resp);
    }

    let existed = repository::drill_exists_any_state(&state.pool, &user.id, &id).await?;
    if !existed {
        return Ok(not_found_response());
    }

    repository::soft_delete(&state.pool, &user.id, &id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn mark_launched(
    State(state): State<AppState>,
    jar: CookieJar,
    AxumPath(id): AxumPath<String>,
) -> Result<Response, AppError> {
    let user = match require_user(&state, &jar).await? {
        Some(user) => user,
        None => return Ok(unauthenticated_response()),
    };

    if let Err(resp) = validate_drill_id(&id) {
        return Ok(resp);
    }

    let existing = match repository::get_drill(&state.pool, &user.id, &id).await? {
        Some(existing) => existing,
        None => return Ok(not_found_response()),
    };
    let stored_module_ids: Vec<String> = existing.1.iter().map(|m| m.module_id.clone()).collect();

    let tier = tier_for(
        user.subscription_status.as_deref(),
        user.subscription_current_period_end,
        Utc::now().timestamp(),
    );
    let blocked = blocked_modules(tier, &stored_module_ids);
    if !blocked.is_empty() {
        return Ok(convention_locked_response(blocked));
    }

    repository::mark_launched(&state.pool, &user.id, &id).await?;

    let saved = repository::get_drill(&state.pool, &user.id, &id).await?;
    let drill = saved
        .map(DrillPayload::from)
        .ok_or_else(|| AppError::Internal("drill should exist after launch".into()))?;

    Ok(Json(DrillResponse { drill }).into_response())
}

// ─── Validation ──────────────────────────────────────────

fn validate_drill_id(id: &str) -> Result<(), Response> {
    if !id.starts_with("drill:") || id.len() <= "drill:".len() || id.len() > 70 {
        return Err(validation_response("id", "invalid drill id"));
    }
    let suffix = &id["drill:".len()..];
    if !suffix
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
    {
        return Err(validation_response("id", "invalid drill id"));
    }
    Ok(())
}

fn validate_request(req: &DrillRequest) -> Result<(), Response> {
    let trimmed_name = req.name.trim();
    if trimmed_name.is_empty() {
        return Err(validation_response("name", "name is required"));
    }
    if trimmed_name.chars().count() > DRILL_NAME_MAX {
        return Err(validation_response("name", "name exceeds maximum length"));
    }
    if req.module_ids.is_empty() {
        return Err(validation_response(
            "moduleIds",
            "at least one module required",
        ));
    }
    if req.module_ids.len() > DRILL_MODULE_IDS_MAX {
        return Err(validation_response("moduleIds", "too many modules"));
    }
    let mut seen = HashSet::with_capacity(req.module_ids.len());
    for id in &req.module_ids {
        if id.is_empty() {
            return Err(validation_response("moduleIds", "empty module id"));
        }
        if !seen.insert(id.as_str()) {
            return Err(validation_response("moduleIds", "duplicate module id"));
        }
    }
    if !req.vulnerability_distribution.is_valid() {
        return Err(validation_response(
            "vulnerabilityDistribution",
            "weights must be non-negative and sum > 0",
        ));
    }
    Ok(())
}

// ─── Error responses ──────────────────────────────────────

fn validation_response(field: &str, message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "error": "validation",
            "field": field,
            "message": message,
        })),
    )
        .into_response()
}

fn unknown_module_response(module_ids: Vec<String>) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "error": "unknown_module",
            "module_ids": module_ids,
        })),
    )
        .into_response()
}

fn convention_locked_response(blocked_module_ids: Vec<String>) -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({
            "error": "convention_locked",
            "blocked_module_ids": blocked_module_ids,
        })),
    )
        .into_response()
}

fn not_found_response() -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response()
}

fn unauthenticated_response() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "unauthenticated" })),
    )
        .into_response()
}

// ─── Auth ──────────────────────────────────────

async fn require_user(state: &AppState, jar: &CookieJar) -> Result<Option<User>, AppError> {
    let Some(token) = jar.get("session").map(|cookie| cookie.value().to_string()) else {
        return Ok(None);
    };
    Ok(session::lookup_session(&state.pool, &token).await?)
}
