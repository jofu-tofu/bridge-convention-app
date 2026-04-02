//! Clause transformation helpers — maps raw BidMeaningClause data into
//! SurfaceClauseView DTOs for the learning viewport, including system-fact
//! variant expansion and neutral description derivation.

use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::{
    BaseSystemId, BidMeaningClause, ConstraintValue, FactOperator, SystemConfig,
};
use serde::{Deserialize, Serialize};

// ── DTOs ─────────────────────────────────────────────────────────────

/// Clause system variant (per-system threshold descriptions).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClauseSystemVariant {
    pub system_label: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trump_tp_description: Option<String>,
}

/// Relevant metric for a clause context.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RelevantMetric {
    #[serde(rename = "hcp")]
    Hcp,
    #[serde(rename = "trumpTp")]
    TrumpTp,
}

/// Surface clause view for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceClauseView {
    pub fact_id: String,
    pub operator: FactOperator,
    pub value: ConstraintValue,
    pub description: String,
    pub is_public: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_variants: Option<Vec<ClauseSystemVariant>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relevant_metric: Option<RelevantMetric>,
}

// ── System-fact clause helpers ───────────────────────────────────────

/// All base systems with their short labels.
struct SystemWithLabel {
    sys: SystemConfig,
    label: &'static str,
}

fn all_systems() -> Vec<SystemWithLabel> {
    vec![
        SystemWithLabel {
            sys: get_system_config(BaseSystemId::Sayc),
            label: "SAYC",
        },
        SystemWithLabel {
            sys: get_system_config(BaseSystemId::TwoOverOne),
            label: "2/1",
        },
        SystemWithLabel {
            sys: get_system_config(BaseSystemId::Acol),
            label: "Acol",
        },
    ]
}

/// Result of describing a system fact value.
struct SystemFactDescription {
    hcp: String,
    trump_tp: Option<String>,
}

/// Describe what a system-derived fact concretely means for a given SystemConfig.
fn describe_system_fact_value(fact_id: &str, sys: &SystemConfig) -> Option<SystemFactDescription> {
    match fact_id {
        "system.responder.weakHand" => {
            let t = &sys.responder_thresholds;
            Some(SystemFactDescription {
                hcp: format!("< {} HCP", t.invite_min),
                trump_tp: Some(format!("< {}", t.invite_min_tp.trump)),
            })
        }
        "system.responder.inviteValues" => {
            let t = &sys.responder_thresholds;
            Some(SystemFactDescription {
                hcp: format!("{}\u{2013}{} HCP", t.invite_min, t.invite_max),
                trump_tp: Some(format!(
                    "{}\u{2013}{}",
                    t.invite_min_tp.trump, t.invite_max_tp.trump
                )),
            })
        }
        "system.responder.gameValues" => {
            let t = &sys.responder_thresholds;
            Some(SystemFactDescription {
                hcp: format!("{}+ HCP", t.game_min),
                trump_tp: Some(format!("{}+", t.game_min_tp.trump)),
            })
        }
        "system.responder.slamValues" => {
            let t = &sys.responder_thresholds;
            Some(SystemFactDescription {
                hcp: format!("{}+ HCP", t.slam_min),
                trump_tp: Some(format!("{}+", t.slam_min_tp.trump)),
            })
        }
        "system.opener.notMinimum" => {
            let r = &sys.opener_rebid;
            Some(SystemFactDescription {
                hcp: format!("{}+ HCP", r.not_minimum),
                trump_tp: Some(format!("{}+", r.not_minimum_tp.trump)),
            })
        }
        "system.responder.twoLevelNewSuit" => Some(SystemFactDescription {
            hcp: format!("{}+ HCP", sys.suit_response.two_level_min),
            trump_tp: None,
        }),
        "system.suitResponse.isGameForcing" => {
            let desc = match sys.suit_response.two_level_forcing_duration {
                bridge_conventions::SuitResponseForcingDuration::Game => "Game-forcing",
                bridge_conventions::SuitResponseForcingDuration::OneRound => "One-round forcing",
            };
            Some(SystemFactDescription {
                hcp: desc.to_string(),
                trump_tp: None,
            })
        }
        "system.oneNtResponseAfterMajor.forcing" => {
            let forcing_str = match sys.one_nt_response_after_major.forcing {
                bridge_conventions::OneNtForcingStatus::NonForcing => "non-forcing",
                bridge_conventions::OneNtForcingStatus::Forcing => "forcing",
                bridge_conventions::OneNtForcingStatus::SemiForcing => "semi-forcing",
            };
            Some(SystemFactDescription {
                hcp: format!("1NT is {}", forcing_str),
                trump_tp: None,
            })
        }
        "system.responder.oneNtRange" => Some(SystemFactDescription {
            hcp: format!(
                "{}\u{2013}{} HCP",
                sys.one_nt_response_after_major.min_hcp, sys.one_nt_response_after_major.max_hcp
            ),
            trump_tp: None,
        }),
        "system.dontOvercall.inRange" => Some(SystemFactDescription {
            hcp: format!(
                "{}\u{2013}{} HCP",
                sys.dont_overcall.min_hcp, sys.dont_overcall.max_hcp
            ),
            trump_tp: None,
        }),
        _ => None,
    }
}

/// Build system variants for a system.* fact — one entry per known base system.
fn build_system_variants(fact_id: &str) -> Vec<ClauseSystemVariant> {
    all_systems()
        .into_iter()
        .map(|s| {
            let result = describe_system_fact_value(fact_id, &s.sys);
            match result {
                Some(desc) => ClauseSystemVariant {
                    system_label: s.label.to_string(),
                    description: desc.hcp,
                    trump_tp_description: desc.trump_tp,
                },
                None => ClauseSystemVariant {
                    system_label: s.label.to_string(),
                    description: fact_id.to_string(),
                    trump_tp_description: None,
                },
            }
        })
        .collect()
}

// ── Display name resolution ──────────────────────────────────────────

/// Well-known factId -> natural language display name mappings.
fn display_name(fact_id: &str) -> String {
    match fact_id {
        "hand.hcp" => return "HCP".to_string(),
        "hand.isBalanced" => return "balanced".to_string(),
        "bridge.hasFourCardMajor" => return "4-card major".to_string(),
        "bridge.hasFiveCardMajor" => return "5-card major".to_string(),
        "bridge.hasShortage" => return "short suit".to_string(),
        "bridge.fitWithBoundSuit" => return "fit with partner's suit".to_string(),
        "bridge.totalPointsForRaise" => return "total points".to_string(),
        "system.dontOvercall.inRange" => return "HCP in overcall range".to_string(),
        "system.responder.oneNtRange" => return "1NT response range".to_string(),
        _ => {}
    }

    // Extract suit from suitLength path: hand.suitLength.hearts -> "hearts"
    if let Some(suit) = fact_id.strip_prefix("hand.suitLength.") {
        return suit.to_string();
    }

    // Strip namespace prefix
    let name = if let Some(rest) = fact_id.strip_prefix("hand.") {
        rest.to_string()
    } else if let Some(rest) = fact_id.strip_prefix("bridge.") {
        rest.to_string()
    } else if fact_id.starts_with("system.") || fact_id.starts_with("module.") {
        // system.<role>.<concept> or module.<name>.<fact> -- strip first two segments
        let parts: Vec<&str> = fact_id.splitn(3, '.').collect();
        if parts.len() >= 3 {
            parts[2].to_string()
        } else {
            fact_id.to_string()
        }
    } else {
        fact_id.to_string()
    };

    // Convert camelCase to space-separated, handle dots as spaces
    let mut result = String::new();
    for ch in name.chars() {
        if ch == '.' {
            result.push(' ');
        } else if ch.is_uppercase() && !result.is_empty() && result.ends_with(|c: char| c.is_lowercase()) {
            result.push(' ');
            result.extend(ch.to_lowercase());
        } else {
            result.extend(ch.to_lowercase());
        }
    }
    result
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => {
            let mut result = first.to_uppercase().to_string();
            result.extend(chars);
            result
        }
    }
}

fn with_rationale(base: &str, rationale: Option<&str>) -> String {
    match rationale {
        Some(r) => format!("{} ({})", base, r),
        None => base.to_string(),
    }
}

/// Read the description from a BidMeaningClause.
fn read_clause_description(c: &BidMeaningClause) -> String {
    c.description
        .clone()
        .unwrap_or_else(|| format!("{} {:?} {:?}", c.fact_id, c.operator, c.value))
}

// ── Public API ───────────────────────────────────────────────────────

/// Derive a value-free, system-neutral description from a factId.
pub fn derive_neutral_description(fact_id: &str, rationale: Option<&str>) -> String {
    let dn = display_name(fact_id);
    let capitalized = capitalize_first(&dn);

    // For system facts, rationale is typically richer context -- use it directly
    if fact_id.starts_with("system.") {
        if let Some(r) = rationale {
            return capitalize_first(r);
        }
    }

    with_rationale(&capitalized, rationale)
}

/// Map raw BidMeaningClause[] to SurfaceClauseView[] for the learning viewport.
pub fn map_clauses(
    clauses: &[BidMeaningClause],
    metric: Option<RelevantMetric>,
) -> Vec<SurfaceClauseView> {
    clauses
        .iter()
        .map(|c| {
            let is_system_fact = c.fact_id.starts_with("system.");
            let description = if is_system_fact {
                derive_neutral_description(&c.fact_id, c.rationale.as_deref())
            } else {
                read_clause_description(c)
            };

            SurfaceClauseView {
                fact_id: c.fact_id.clone(),
                operator: c.operator,
                value: c.value.clone(),
                description,
                is_public: c.is_public.unwrap_or(false),
                system_variants: if is_system_fact {
                    Some(build_system_variants(&c.fact_id))
                } else {
                    None
                },
                relevant_metric: if is_system_fact { metric } else { None },
            }
        })
        .collect()
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_neutral_description_system_fact_with_rationale() {
        let desc = derive_neutral_description(
            "system.responder.inviteValues",
            Some("invite values opposite 1NT"),
        );
        assert_eq!(desc, "Invite values opposite 1NT");
    }

    #[test]
    fn derive_neutral_description_dont_overcall_no_rationale() {
        let desc = derive_neutral_description("system.dontOvercall.inRange", None);
        assert_eq!(desc, "HCP in overcall range");
    }

    #[test]
    fn derive_neutral_description_one_nt_range_no_rationale() {
        let desc = derive_neutral_description("system.responder.oneNtRange", None);
        assert_eq!(desc, "1NT response range");
    }

    #[test]
    fn derive_neutral_description_hand_hcp() {
        let desc = derive_neutral_description("hand.hcp", Some("for Stayman"));
        assert_eq!(desc, "HCP (for Stayman)");
    }

    #[test]
    fn describe_system_fact_value_responder_invite() {
        let sys = get_system_config(BaseSystemId::Sayc);
        let desc = describe_system_fact_value("system.responder.inviteValues", &sys);
        assert!(desc.is_some());
        let d = desc.unwrap();
        assert_eq!(d.hcp, "8\u{2013}9 HCP");
        assert!(d.trump_tp.is_some());
    }

    #[test]
    fn build_system_variants_responder_invite() {
        let variants = build_system_variants("system.responder.inviteValues");
        assert_eq!(variants.len(), 3); // SAYC, 2/1, Acol
        assert_eq!(variants[0].system_label, "SAYC");
    }
}
