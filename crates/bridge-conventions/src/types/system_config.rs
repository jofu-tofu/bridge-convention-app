//! Base bidding system configuration.
//!
//! Mirrors TS types from `conventions/definitions/system-config.ts`.

use serde::de::{self, MapAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};

/// Point formula — toggleable components for total-point computation.
///
/// HCP is always included. Shortage and length are independently toggleable.
/// Custom `Deserialize` accepts both the new object format and legacy string
/// format (`"hcp-only"`, `"hcp-plus-shortage"`, `"hcp-plus-all-distribution"`)
/// for backwards compat with existing localStorage data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointFormula {
    pub include_shortage: bool,
    pub include_length: bool,
}

impl<'de> Deserialize<'de> for PointFormula {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PointFormulaVisitor;

        impl<'de> Visitor<'de> for PointFormulaVisitor {
            type Value = PointFormula;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a PointFormula object or legacy string (\"hcp-only\", \"hcp-plus-shortage\", \"hcp-plus-all-distribution\")")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> Result<PointFormula, E> {
                match value {
                    "hcp-only" => Ok(PointFormula {
                        include_shortage: false,
                        include_length: false,
                    }),
                    "hcp-plus-shortage" => Ok(PointFormula {
                        include_shortage: true,
                        include_length: false,
                    }),
                    "hcp-plus-all-distribution" => Ok(PointFormula {
                        include_shortage: true,
                        include_length: true,
                    }),
                    _ => Err(de::Error::unknown_variant(
                        value,
                        &["hcp-only", "hcp-plus-shortage", "hcp-plus-all-distribution"],
                    )),
                }
            }

            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<PointFormula, M::Error> {
                let mut include_shortage = None;
                let mut include_length = None;

                while let Some(key) = map.next_key::<String>()? {
                    match key.as_str() {
                        "includeShortage" => include_shortage = Some(map.next_value()?),
                        "includeLength" => include_length = Some(map.next_value()?),
                        _ => {
                            let _ = map.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }

                Ok(PointFormula {
                    include_shortage: include_shortage.unwrap_or(false),
                    include_length: include_length.unwrap_or(false),
                })
            }
        }

        deserializer.deserialize_any(PointFormulaVisitor)
    }
}

/// Point formula configuration per contract type (NT vs trump).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointConfig {
    pub nt_formula: PointFormula,
    pub trump_formula: PointFormula,
}

fn default_point_config() -> PointConfig {
    PointConfig {
        nt_formula: PointFormula {
            include_shortage: false,
            include_length: false,
        },
        trump_formula: PointFormula {
            include_shortage: true,
            include_length: false,
        },
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
    #[serde(rename = "custom")]
    Custom,
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
    #[serde(
        default = "default_point_config",
        skip_serializing_if = "is_default_point_config"
    )]
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
        assert_eq!(
            serde_json::to_string(&BaseSystemId::Custom).unwrap(),
            "\"custom\""
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
                nt_formula: PointFormula {
                    include_shortage: false,
                    include_length: false,
                },
                trump_formula: PointFormula {
                    include_shortage: true,
                    include_length: false,
                },
            },
        };
        let json = serde_json::to_string(&config).unwrap();
        let back: SystemConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(back, config);
    }

    #[test]
    fn point_formula_serde_roundtrip() {
        let formula = PointFormula {
            include_shortage: true,
            include_length: false,
        };
        let json = serde_json::to_string(&formula).unwrap();
        assert_eq!(json, r#"{"includeShortage":true,"includeLength":false}"#);
        let back: PointFormula = serde_json::from_str(&json).unwrap();
        assert_eq!(back, formula);
    }

    #[test]
    fn point_formula_legacy_string_deserialization() {
        let hcp_only: PointFormula = serde_json::from_str(r#""hcp-only""#).unwrap();
        assert_eq!(
            hcp_only,
            PointFormula {
                include_shortage: false,
                include_length: false
            }
        );

        let hcp_shortage: PointFormula = serde_json::from_str(r#""hcp-plus-shortage""#).unwrap();
        assert_eq!(
            hcp_shortage,
            PointFormula {
                include_shortage: true,
                include_length: false
            }
        );

        let all_dist: PointFormula =
            serde_json::from_str(r#""hcp-plus-all-distribution""#).unwrap();
        assert_eq!(
            all_dist,
            PointFormula {
                include_shortage: true,
                include_length: true
            }
        );
    }

    #[test]
    fn point_config_default_on_missing_field() {
        // Ensure SystemConfig without pointConfig deserializes with default
        let json = r#"{"systemId":"sayc","displayName":"test","ntOpening":{"minHcp":15,"maxHcp":17},"responderThresholds":{"inviteMin":8,"inviteMax":9,"gameMin":10,"slamMin":15,"inviteMinTp":{"trump":8},"inviteMaxTp":{"trump":10},"gameMinTp":{"trump":10},"slamMinTp":{"trump":16}},"openerRebid":{"notMinimum":16,"notMinimumTp":{"trump":16}},"interference":{"redoubleMin":10},"suitResponse":{"twoLevelMin":10,"twoLevelForcingDuration":"one-round"},"oneNtResponseAfterMajor":{"forcing":"non-forcing","maxHcp":10,"minHcp":6},"openingRequirements":{"majorSuitMinLength":5},"dontOvercall":{"minHcp":8,"maxHcp":15}}"#;
        let config: SystemConfig = serde_json::from_str(json).unwrap();
        assert_eq!(
            config.point_config.nt_formula,
            PointFormula {
                include_shortage: false,
                include_length: false
            }
        );
        assert_eq!(
            config.point_config.trump_formula,
            PointFormula {
                include_shortage: true,
                include_length: false
            }
        );
    }

    #[test]
    fn point_config_legacy_string_in_system_config() {
        // Old localStorage format: pointConfig with string formula values
        let json = r#"{"systemId":"sayc","displayName":"test","ntOpening":{"minHcp":15,"maxHcp":17},"responderThresholds":{"inviteMin":8,"inviteMax":9,"gameMin":10,"slamMin":15,"inviteMinTp":{"trump":8},"inviteMaxTp":{"trump":10},"gameMinTp":{"trump":10},"slamMinTp":{"trump":16}},"openerRebid":{"notMinimum":16,"notMinimumTp":{"trump":16}},"interference":{"redoubleMin":10},"suitResponse":{"twoLevelMin":10,"twoLevelForcingDuration":"one-round"},"oneNtResponseAfterMajor":{"forcing":"non-forcing","maxHcp":10,"minHcp":6},"openingRequirements":{"majorSuitMinLength":5},"dontOvercall":{"minHcp":8,"maxHcp":15},"pointConfig":{"ntFormula":"hcp-only","trumpFormula":"hcp-plus-shortage"}}"#;
        let config: SystemConfig = serde_json::from_str(json).unwrap();
        assert_eq!(
            config.point_config.nt_formula,
            PointFormula {
                include_shortage: false,
                include_length: false
            }
        );
        assert_eq!(
            config.point_config.trump_formula,
            PointFormula {
                include_shortage: true,
                include_length: false
            }
        );
    }
}
