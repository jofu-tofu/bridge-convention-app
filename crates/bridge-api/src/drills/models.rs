use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Storage shape for `user_drills` rows. Never returned directly from a
/// handler — convert to `DrillPayload` in `handlers.rs` first.
#[derive(Debug, Clone, FromRow)]
pub struct DrillRow {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub practice_mode: String,
    pub practice_role: String,
    pub system_selection_id: String,
    pub opponent_mode: String,
    pub play_profile_id: String,
    pub vulnerability_distribution: String,
    #[allow(dead_code)]
    pub vulnerability_distribution_version: i64,
    pub show_educational_annotations: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_used_at: Option<String>,
    #[allow(dead_code)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DrillModuleRow {
    #[allow(dead_code)]
    pub drill_id: String,
    pub position: i64,
    pub module_id: String,
}

/// Vulnerability distribution payload (camelCase wire shape, mirrors TS
/// `VulnerabilityDistribution`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VulnerabilityDistribution {
    pub none: f64,
    pub ours: f64,
    pub theirs: f64,
    pub both: f64,
}

impl VulnerabilityDistribution {
    pub fn is_valid(&self) -> bool {
        let parts = [self.none, self.ours, self.theirs, self.both];
        if parts.iter().any(|v| !v.is_finite() || *v < 0.0) {
            return false;
        }
        parts.iter().sum::<f64>() > 0.0
    }
}
