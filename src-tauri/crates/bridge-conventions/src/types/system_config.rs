//! Base bidding system configuration.
//!
//! Mirrors TS types from `conventions/definitions/system-config.ts`.

use serde::{Deserialize, Serialize};

/// Point formula identifiers for composing total-point values.
///
/// The engine computes raw components (HCP, shortage, length).
/// The fact DSL composes them using these formula IDs via `compute_total_points()`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PointFormulaId {
    HcpOnly,
    HcpPlusShortage,
    HcpPlusAllDistribution,
}

/// Point formula configuration per contract type (NT vs trump).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointConfig {
    pub nt_formula: PointFormulaId,
    pub trump_formula: PointFormulaId,
}

fn default_point_config() -> PointConfig {
    PointConfig {
        nt_formula: PointFormulaId::HcpOnly,
        trump_formula: PointFormulaId::HcpPlusShortage,
    }
}

fn is_default_point_config(config: &PointConfig) -> bool {
    *config == default_point_config()
}

/// Base bidding system identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BaseSystemId {
    #[serde(rename = "sayc")]
    Sayc,
    #[serde(rename = "two-over-one")]
    TwoOverOne,
    #[serde(rename = "acol")]
    Acol,
}

/// Suit total-point equivalents for a threshold.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TotalPointEquivalent {
    pub trump: u32,
}

/// 1NT opening HCP range.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NtOpeningConfig {
    pub min_hcp: u32,
    pub max_hcp: u32,
}

/// Responder point-range thresholds opposite a 1NT opening.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponderThresholds {
    pub invite_min: u32,
    pub invite_max: u32,
    pub game_min: u32,
    pub slam_min: u32,
    pub invite_min_tp: TotalPointEquivalent,
    pub invite_max_tp: TotalPointEquivalent,
    pub game_min_tp: TotalPointEquivalent,
    pub slam_min_tp: TotalPointEquivalent,
}

/// Opener rebid thresholds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenerRebidThresholds {
    pub not_minimum: u32,
    pub not_minimum_tp: TotalPointEquivalent,
}

/// Interference thresholds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterferenceThresholds {
    pub redouble_min: u32,
}

/// Forcing duration of a 2-level new-suit response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SuitResponseForcingDuration {
    OneRound,
    Game,
}

/// Whether 1NT response to 1M is forcing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OneNtForcingStatus {
    NonForcing,
    Forcing,
    SemiForcing,
}

/// 2-level new-suit response parameters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuitResponseConfig {
    pub two_level_min: u32,
    pub two_level_forcing_duration: SuitResponseForcingDuration,
}

/// 1NT response to 1M parameters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OneNtResponseAfterMajorConfig {
    pub forcing: OneNtForcingStatus,
    pub max_hcp: u32,
    pub min_hcp: u32,
}

/// DONT overcall HCP bounds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DontOvercallConfig {
    pub min_hcp: u32,
    pub max_hcp: u32,
}

/// Structural opening bid requirements.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpeningRequirements {
    pub major_suit_min_length: u8,
}

/// Top-level system configuration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemConfig {
    pub system_id: BaseSystemId,
    pub display_name: String,
    pub nt_opening: NtOpeningConfig,
    pub responder_thresholds: ResponderThresholds,
    pub opener_rebid: OpenerRebidThresholds,
    pub interference: InterferenceThresholds,
    pub suit_response: SuitResponseConfig,
    pub one_nt_response_after_major: OneNtResponseAfterMajorConfig,
    pub opening_requirements: OpeningRequirements,
    pub dont_overcall: DontOvercallConfig,
    #[serde(default = "default_point_config", skip_serializing_if = "is_default_point_config")]
    pub point_config: PointConfig,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_system_id_serde() {
        assert_eq!(
            serde_json::to_string(&BaseSystemId::Sayc).unwrap(),
            "\"sayc\""
        );
        assert_eq!(
            serde_json::to_string(&BaseSystemId::TwoOverOne).unwrap(),
            "\"two-over-one\""
        );
        assert_eq!(
            serde_json::to_string(&BaseSystemId::Acol).unwrap(),
            "\"acol\""
        );
    }

    #[test]
    fn forcing_duration_serde() {
        assert_eq!(
            serde_json::to_string(&SuitResponseForcingDuration::OneRound).unwrap(),
            "\"one-round\""
        );
        assert_eq!(
            serde_json::to_string(&SuitResponseForcingDuration::Game).unwrap(),
            "\"game\""
        );
    }

    #[test]
    fn one_nt_forcing_status_serde() {
        assert_eq!(
            serde_json::to_string(&OneNtForcingStatus::NonForcing).unwrap(),
            "\"non-forcing\""
        );
        assert_eq!(
            serde_json::to_string(&OneNtForcingStatus::SemiForcing).unwrap(),
            "\"semi-forcing\""
        );
    }

    #[test]
    fn system_config_roundtrip() {
        let config = SystemConfig {
            system_id: BaseSystemId::Sayc,
            display_name: "Standard American Yellow Card".to_string(),
            nt_opening: NtOpeningConfig {
                min_hcp: 15,
                max_hcp: 17,
            },
            responder_thresholds: ResponderThresholds {
                invite_min: 8,
                invite_max: 9,
                game_min: 10,
                slam_min: 15,
                invite_min_tp: TotalPointEquivalent { trump: 8 },
                invite_max_tp: TotalPointEquivalent { trump: 10 },
                game_min_tp: TotalPointEquivalent { trump: 10 },
                slam_min_tp: TotalPointEquivalent { trump: 16 },
            },
            opener_rebid: OpenerRebidThresholds {
                not_minimum: 16,
                not_minimum_tp: TotalPointEquivalent { trump: 16 },
            },
            interference: InterferenceThresholds { redouble_min: 10 },
            suit_response: SuitResponseConfig {
                two_level_min: 10,
                two_level_forcing_duration: SuitResponseForcingDuration::OneRound,
            },
            one_nt_response_after_major: OneNtResponseAfterMajorConfig {
                forcing: OneNtForcingStatus::NonForcing,
                max_hcp: 10,
                min_hcp: 6,
            },
            opening_requirements: OpeningRequirements {
                major_suit_min_length: 5,
            },
            dont_overcall: DontOvercallConfig {
                min_hcp: 8,
                max_hcp: 15,
            },
            point_config: PointConfig {
                nt_formula: PointFormulaId::HcpOnly,
                trump_formula: PointFormulaId::HcpPlusShortage,
            },
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: SystemConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    #[test]
    fn point_formula_id_serde() {
        assert_eq!(
            serde_json::to_string(&PointFormulaId::HcpOnly).unwrap(),
            "\"hcp-only\""
        );
        assert_eq!(
            serde_json::to_string(&PointFormulaId::HcpPlusShortage).unwrap(),
            "\"hcp-plus-shortage\""
        );
        assert_eq!(
            serde_json::to_string(&PointFormulaId::HcpPlusAllDistribution).unwrap(),
            "\"hcp-plus-all-distribution\""
        );
    }

    #[test]
    fn point_config_default_on_missing_field() {
        // Ensure SystemConfig without pointConfig deserializes with default
        let json = r#"{"systemId":"sayc","displayName":"test","ntOpening":{"minHcp":15,"maxHcp":17},"responderThresholds":{"inviteMin":8,"inviteMax":9,"gameMin":10,"slamMin":15,"inviteMinTp":{"trump":8},"inviteMaxTp":{"trump":10},"gameMinTp":{"trump":10},"slamMinTp":{"trump":16}},"openerRebid":{"notMinimum":16,"notMinimumTp":{"trump":16}},"interference":{"redoubleMin":10},"suitResponse":{"twoLevelMin":10,"twoLevelForcingDuration":"one-round"},"oneNtResponseAfterMajor":{"forcing":"non-forcing","maxHcp":10,"minHcp":6},"openingRequirements":{"majorSuitMinLength":5},"dontOvercall":{"minHcp":8,"maxHcp":15}}"#;
        let config: SystemConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.point_config.nt_formula, PointFormulaId::HcpOnly);
        assert_eq!(config.point_config.trump_formula, PointFormulaId::HcpPlusShortage);
    }
}
