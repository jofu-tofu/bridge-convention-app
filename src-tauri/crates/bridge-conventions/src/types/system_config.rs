//! Base bidding system configuration.
//!
//! Mirrors TS types from `conventions/definitions/system-config.ts`.

use serde::{Deserialize, Serialize};

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

/// Total-point equivalents for a threshold.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TotalPointEquivalent {
    pub trump: u32,
    pub nt: u32,
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
                invite_min_tp: TotalPointEquivalent { trump: 8, nt: 8 },
                invite_max_tp: TotalPointEquivalent { trump: 10, nt: 9 },
                game_min_tp: TotalPointEquivalent { trump: 10, nt: 10 },
                slam_min_tp: TotalPointEquivalent { trump: 16, nt: 15 },
            },
            opener_rebid: OpenerRebidThresholds {
                not_minimum: 16,
                not_minimum_tp: TotalPointEquivalent { trump: 16, nt: 16 },
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
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: SystemConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }
}
