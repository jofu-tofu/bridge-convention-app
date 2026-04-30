//! Text formatting helpers for the learning viewport — module name formatting,
//! bid reference substitution, call key generation, system-fact descriptions,
//! and clause mapping.

use std::collections::HashSet;

use bridge_conventions::fact_catalog::{
    get_fact_catalog_entry, partition_discriminants, FactKind, FactValue,
};
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::{
    BaseSystemId, BidMeaning, BidMeaningClause, ConventionModule, ExplanationEntry, FactId,
    SystemConfig,
};
use bridge_engine::types::{BidSuit, Call};

use super::learning_types::{ClauseSystemVariant, RelevantMetric, SurfaceClauseView};

// ── Bridge abbreviations ─────────────────────────────────────────────

const BRIDGE_ABBREVIATIONS: &[&str] = &["nt", "sayc", "hcp"];

fn is_bridge_abbreviation(word: &str) -> bool {
    let lower = word.to_lowercase();
    BRIDGE_ABBREVIATIONS.contains(&lower.as_str())
}

// ── Formatting helpers ───────────────────────────────────────────────

/// Convert kebab-case module ID to display name.
/// Splits by "-", capitalizes each word, fully uppercases bridge abbreviations.
pub fn format_module_name(module_id: &str) -> String {
    if module_id.is_empty() {
        return String::new();
    }
    module_id
        .split('-')
        .map(|w| {
            let lower = w.to_lowercase();
            if is_bridge_abbreviation(w) {
                return w.to_uppercase();
            }
            // Check for digit prefix + abbreviation suffix (e.g., "1nt" → "1NT")
            if let Some(pos) = lower.find(|c: char| !c.is_ascii_digit()) {
                let (digits, rest) = lower.split_at(pos);
                if !digits.is_empty() && is_bridge_abbreviation(rest) {
                    return format!("{}{}", digits, rest.to_uppercase());
                }
            }
            // Normal capitalize
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => {
                    let mut s = first.to_uppercase().to_string();
                    s.extend(chars);
                    s
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Replace bid letter references (e.g., "2C", "3H") in text with Unicode suit symbols.
/// Pattern: digit(1-7) followed by C/D/H/S/NT, not surrounded by letters.
pub fn format_bid_references(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut result = String::with_capacity(text.len());
    let mut i = 0;

    while i < len {
        // Check if previous char is a letter (ASCII)
        let prev_is_letter = i > 0 && chars[i - 1].is_ascii_alphabetic();

        if !prev_is_letter && chars[i].is_ascii_digit() {
            let digit = chars[i];
            if digit >= '1' && digit <= '7' && i + 1 < len {
                // Try NT first (2 chars)
                if i + 2 < len && chars[i + 1] == 'N' && chars[i + 2] == 'T' {
                    let next_after = if i + 3 < len { chars[i + 3] } else { ' ' };
                    if !next_after.is_ascii_alphabetic() {
                        result.push(digit);
                        result.push_str("NT");
                        i += 3;
                        continue;
                    }
                }
                // Try single suit letter
                let suit_char = chars[i + 1];
                if matches!(suit_char, 'C' | 'D' | 'H' | 'S') {
                    let next_after = if i + 2 < len { chars[i + 2] } else { ' ' };
                    if !next_after.is_ascii_alphabetic() {
                        result.push(digit);
                        match suit_char {
                            'C' => result.push('\u{2663}'), // ♣
                            'D' => result.push('\u{2666}'), // ♦
                            'H' => result.push('\u{2665}'), // ♥
                            'S' => result.push('\u{2660}'), // ♠
                            _ => unreachable!(),
                        }
                        i += 2;
                        continue;
                    }
                }
            }
        }

        result.push(chars[i]);
        i += 1;
    }
    result
}

/// Convert Call to a string key like "1C", "P", "X", "XX", "7NT".
pub fn call_key(call: &Call) -> String {
    match call {
        Call::Pass => "P".to_string(),
        Call::Double => "X".to_string(),
        Call::Redouble => "XX".to_string(),
        Call::Bid { level, strain } => {
            let suit_str = match strain {
                BidSuit::Clubs => "C",
                BidSuit::Diamonds => "D",
                BidSuit::Hearts => "H",
                BidSuit::Spades => "S",
                BidSuit::NoTrump => "NT",
            };
            format!("{}{}", level, suit_str)
        }
    }
}

/// Extract deduplicated surfaces from module's states.
pub fn module_surfaces(module: &ConventionModule) -> Vec<&BidMeaning> {
    let mut seen = HashSet::new();
    let mut surfaces = Vec::new();
    for entry in module.states.as_deref().unwrap_or(&[]) {
        for surface in &entry.surfaces {
            if seen.insert(&surface.meaning_id) {
                surfaces.push(surface);
            }
        }
    }
    surfaces
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
pub(crate) struct SystemFactDescription {
    pub hcp: String,
    pub trump_tp: Option<String>,
}

/// Locale-ready label wrapper for rendered fact values.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct LocalizedLabel {
    pub en: String,
}

pub(crate) fn describe_fact_value(
    fact: &FactId,
    value: &FactValue,
    sys: &SystemConfig,
) -> Option<LocalizedLabel> {
    let entry = get_fact_catalog_entry(fact.as_str())?;

    match (&entry.kind, value) {
        (FactKind::Threshold, FactValue::Threshold) => {
            let hcp = describe_system_fact_hcp(fact.as_str(), sys)?;
            Some(LocalizedLabel { en: hcp })
        }
        (FactKind::Partition, FactValue::Partition(discriminant_id)) => {
            partition_discriminants(fact)
                .and_then(|discriminants| {
                    discriminants
                        .iter()
                        .find(|discriminant| discriminant.id == discriminant_id.as_str())
                })
                .map(|discriminant| LocalizedLabel {
                    en: discriminant.display_name.to_string(),
                })
        }
        _ => None,
    }
}

/// Describe what a system-derived fact concretely means for a given SystemConfig.
pub(crate) fn describe_system_fact_value(
    fact_id: &str,
    sys: &SystemConfig,
) -> Option<SystemFactDescription> {
    let hcp = FactId::parse(fact_id)
        .ok()
        .and_then(|fact| describe_fact_value(&fact, &FactValue::Threshold, sys))
        .map(|label| label.en)
        .or_else(|| describe_system_fact_hcp(fact_id, sys))?;

    Some(SystemFactDescription {
        hcp,
        trump_tp: describe_system_fact_trump_tp(fact_id, sys),
    })
}

fn describe_system_fact_hcp(fact_id: &str, sys: &SystemConfig) -> Option<String> {
    match fact_id {
        "system.responder.weakHand" => {
            Some(format!("< {} HCP", sys.responder_thresholds.invite_min))
        }
        "system.responder.inviteValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.responder_thresholds.invite_min, sys.responder_thresholds.invite_max
        )),
        "system.responder.gameValues" => {
            Some(format!("{}+ HCP", sys.responder_thresholds.game_min))
        }
        "system.responder.slamValues" => {
            Some(format!("{}+ HCP", sys.responder_thresholds.slam_min))
        }
        "system.opening.weakTwoRange" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.opening.weak_two.min_hcp, sys.opening.weak_two.max_hcp
        )),
        "system.opening.strong2cRange" => Some(format!("{}+ HCP", sys.opening.strong_2c_min)),
        "system.opener.minimumValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.opener_rebid.minimum_min_hcp, sys.opener_rebid.minimum_max_hcp
        )),
        "system.opener.mediumValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.opener_rebid.medium_min_hcp, sys.opener_rebid.medium_max_hcp
        )),
        "system.opener.maximumValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.opener_rebid.maximum_min_hcp, sys.opener_rebid.maximum_max_hcp
        )),
        "system.opener.reverseValues" => Some(format!("{}+ HCP", sys.opener_rebid.reverse_min_hcp)),
        "system.opener.jumpShiftValues" => {
            Some(format!("{}+ HCP", sys.opener_rebid.jump_shift_min_hcp))
        }
        "system.overcaller.simpleValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.competitive.simple_overcall_min_hcp, sys.competitive.simple_overcall_max_hcp
        )),
        "system.overcaller.jumpValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.opening.weak_two.min_hcp, sys.competitive.jump_overcall_max_hcp
        )),
        "system.overcaller.ntValues" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.competitive.nt_overcall_min_hcp, sys.competitive.nt_overcall_max_hcp
        )),
        "system.takeoutDoubler.values" => {
            Some(format!("{}+ HCP", sys.competitive.takeout_double_min_hcp))
        }
        "system.opener.notMinimum" => Some(format!("{}+ HCP", sys.opener_rebid.not_minimum)),
        "system.responderTwoLevelNewSuit" => {
            Some(format!("{}+ HCP", sys.suit_response.two_level_min))
        }
        "system.suitResponseIsGameForcing" => {
            Some(match sys.suit_response.two_level_forcing_duration {
                bridge_conventions::SuitResponseForcingDuration::Game => "Game-forcing".to_string(),
                bridge_conventions::SuitResponseForcingDuration::OneRound => {
                    "One-round forcing".to_string()
                }
            })
        }
        "system.oneNtForcingAfterMajor" => Some(format!(
            "1NT is {}",
            match sys.one_nt_response_after_major.forcing {
                bridge_conventions::OneNtForcingStatus::NonForcing => "non-forcing",
                bridge_conventions::OneNtForcingStatus::Forcing => "forcing",
                bridge_conventions::OneNtForcingStatus::SemiForcing => "semi-forcing",
            }
        )),
        "system.responder.oneNtRange" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.one_nt_response_after_major.min_hcp, sys.one_nt_response_after_major.max_hcp
        )),
        "system.dontOvercall.inRange" => Some(format!(
            "{}\u{2013}{} HCP",
            sys.dont_overcall.min_hcp, sys.dont_overcall.max_hcp
        )),
        _ => None,
    }
}

fn describe_system_fact_trump_tp(fact_id: &str, sys: &SystemConfig) -> Option<String> {
    match fact_id {
        "system.responder.weakHand" => Some(format!(
            "< {}",
            sys.responder_thresholds.invite_min_tp.trump
        )),
        "system.responder.inviteValues" => Some(format!(
            "{}\u{2013}{}",
            sys.responder_thresholds.invite_min_tp.trump,
            sys.responder_thresholds.invite_max_tp.trump
        )),
        "system.responder.gameValues" => {
            Some(format!("{}+", sys.responder_thresholds.game_min_tp.trump))
        }
        "system.responder.slamValues" => {
            Some(format!("{}+", sys.responder_thresholds.slam_min_tp.trump))
        }
        "system.opener.notMinimum" => Some(format!("{}+", sys.opener_rebid.not_minimum_tp.trump)),
        _ => None,
    }
}

/// Build system variants for a system.* fact — one entry per known base system.
pub(crate) fn build_system_variants(fact_id: &str) -> Vec<ClauseSystemVariant> {
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

/// Well-known factId → natural language display name mappings.
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
        "system.opening.weakTwoRange" => return "weak two opening range".to_string(),
        "system.opening.strong2cRange" => return "strong 2C opening range".to_string(),
        "system.opener.minimumValues" => return "minimum opener values".to_string(),
        "system.opener.mediumValues" => return "medium opener values".to_string(),
        "system.opener.maximumValues" => return "maximum opener values".to_string(),
        "system.opener.reverseValues" => return "reverse strength".to_string(),
        "system.opener.jumpShiftValues" => return "jump-shift strength".to_string(),
        "system.overcaller.simpleValues" => return "simple overcall values".to_string(),
        "system.overcaller.jumpValues" => return "jump overcall values".to_string(),
        "system.overcaller.ntValues" => return "1NT overcall values".to_string(),
        "system.takeoutDoubler.values" => return "takeout-double values".to_string(),
        _ => {}
    }

    // Extract suit from suitLength path: hand.suitLength.hearts → "hearts"
    if let Some(suit) = fact_id.strip_prefix("hand.suitLength.") {
        return suit.to_string();
    }

    // Strip namespace prefix
    let name = if let Some(rest) = fact_id.strip_prefix("hand.") {
        rest.to_string()
    } else if let Some(rest) = fact_id.strip_prefix("bridge.") {
        rest.to_string()
    } else if fact_id.starts_with("system.") || fact_id.starts_with("module.") {
        // system.<role>.<concept> or module.<name>.<fact> — strip first two segments
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
        } else if ch.is_uppercase()
            && !result.is_empty()
            && result.ends_with(|c: char| c.is_lowercase())
        {
            result.push(' ');
            result.extend(ch.to_lowercase());
        } else {
            result.extend(ch.to_lowercase());
        }
    }
    result
}

/// Derive a value-free, system-neutral description from a factId.
pub fn derive_neutral_description(fact_id: &str, rationale: Option<&str>) -> String {
    let dn = display_name(fact_id);
    let capitalized = capitalize_first(&dn);

    // For system facts, rationale is typically richer context — use it directly
    if fact_id.starts_with("system.") {
        if let Some(r) = rationale {
            return capitalize_first(r);
        }
    }

    with_rationale(&capitalized, rationale)
}

pub(crate) fn capitalize_first(s: &str) -> String {
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

/// Find explanation text for a meaningId from module explanation entries.
pub fn find_explanation_text(entries: &[ExplanationEntry], meaning_id: &str) -> Option<String> {
    for entry in entries {
        if let ExplanationEntry::Meaning(me) = entry {
            if me.meaning_id == meaning_id {
                return Some(me.display_text.clone());
            }
        }
    }
    None
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

/// Format a phase string for display. "asked" → "Asked", "shown-hearts" → "Shown Hearts".
pub(crate) fn format_phase_display(phase: &str, turn: Option<&str>) -> String {
    let phase_title = format_module_name(phase);
    if let Some(t) = turn {
        let turn_title = capitalize_first(t);
        format!("{} \u{2014} {}", phase_title, turn_title)
    } else {
        phase_title
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::registry::module_registry::get_module;
    use bridge_conventions::registry::system_configs::get_system_config;

    #[test]
    fn format_module_name_empty() {
        assert_eq!(format_module_name(""), "");
    }

    #[test]
    fn format_module_name_single_word() {
        assert_eq!(format_module_name("stayman"), "Stayman");
    }

    #[test]
    fn format_module_name_multi_word() {
        assert_eq!(format_module_name("natural-bids"), "Natural Bids");
    }

    #[test]
    fn format_module_name_abbreviation() {
        assert_eq!(format_module_name("1nt"), "1NT");
    }

    #[test]
    fn format_module_name_jacoby_transfers() {
        assert_eq!(format_module_name("jacoby-transfers"), "Jacoby Transfers");
    }

    #[test]
    fn call_key_pass() {
        assert_eq!(call_key(&Call::Pass), "P");
    }

    #[test]
    fn call_key_bid_1c() {
        assert_eq!(
            call_key(&Call::Bid {
                level: 1,
                strain: BidSuit::Clubs
            }),
            "1C"
        );
    }

    #[test]
    fn call_key_double() {
        assert_eq!(call_key(&Call::Double), "X");
    }

    #[test]
    fn call_key_redouble() {
        assert_eq!(call_key(&Call::Redouble), "XX");
    }

    #[test]
    fn call_key_7nt() {
        assert_eq!(
            call_key(&Call::Bid {
                level: 7,
                strain: BidSuit::NoTrump
            }),
            "7NT"
        );
    }

    #[test]
    fn format_bid_references_basic() {
        assert_eq!(format_bid_references("bid 2C"), "bid 2\u{2663}");
        assert_eq!(format_bid_references("bid 3H"), "bid 3\u{2665}");
        assert_eq!(format_bid_references("bid 1NT"), "bid 1NT");
    }

    #[test]
    fn format_bid_references_no_match_inside_word() {
        assert_eq!(format_bid_references("A2C"), "A2C");
    }

    #[test]
    fn module_surfaces_deduplicates() {
        let module = get_module("stayman", BaseSystemId::Sayc).unwrap();
        let surfaces = module_surfaces(module);
        let ids: Vec<&str> = surfaces.iter().map(|s| s.meaning_id.as_str()).collect();
        let unique: HashSet<&str> = ids.iter().copied().collect();
        assert_eq!(ids.len(), unique.len(), "surfaces should be deduplicated");
    }

    #[test]
    fn find_explanation_text_found() {
        let module = get_module("stayman", BaseSystemId::Sayc).unwrap();
        let surfaces = module_surfaces(module);
        if let Some(first) = surfaces.first() {
            let _ = find_explanation_text(&module.explanation_entries, &first.meaning_id);
        }
    }

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
        assert_eq!(variants.len(), 3);
        assert_eq!(variants[0].system_label, "SAYC");
    }

    #[test]
    fn describe_fact_value_partition_label() {
        use bridge_conventions::fact_catalog::FactValue;
        use bridge_conventions::types::FactId;

        let sys = get_system_config(BaseSystemId::Sayc);
        let fact = FactId::parse("responder.majorShape").unwrap();
        let label = describe_fact_value(
            &fact,
            &FactValue::Partition("flatFourCardMajor".to_string()),
            &sys,
        )
        .unwrap();
        assert_eq!(label.en, "Flat hand with a four-card major");
    }

    #[test]
    fn describe_system_fact_value_weak_two_range() {
        let sys = get_system_config(BaseSystemId::Sayc);
        let desc = describe_system_fact_value("system.opening.weakTwoRange", &sys).unwrap();
        assert_eq!(desc.hcp, "6\u{2013}11 HCP");
        assert!(desc.trump_tp.is_none());
    }

    #[test]
    fn describe_system_fact_value_opener_medium() {
        let sys = get_system_config(BaseSystemId::Sayc);
        let desc = describe_system_fact_value("system.opener.mediumValues", &sys).unwrap();
        assert_eq!(desc.hcp, "16\u{2013}18 HCP");
        assert!(desc.trump_tp.is_none());
    }

    #[test]
    fn describe_system_fact_value_simple_overcall() {
        let sys = get_system_config(BaseSystemId::Sayc);
        let desc = describe_system_fact_value("system.overcaller.simpleValues", &sys).unwrap();
        assert_eq!(desc.hcp, "8\u{2013}16 HCP");
        assert!(desc.trump_tp.is_none());
    }

    #[test]
    fn describe_system_fact_value_nt_overcall() {
        let sys = get_system_config(BaseSystemId::Sayc);
        let desc = describe_system_fact_value("system.overcaller.ntValues", &sys).unwrap();
        assert_eq!(desc.hcp, "15\u{2013}18 HCP");
        assert!(desc.trump_tp.is_none());
    }

    #[test]
    fn describe_fact_value_classic_ace_count_label() {
        use bridge_conventions::fact_catalog::FactValue;
        use bridge_conventions::types::FactId;

        let sys = get_system_config(BaseSystemId::Sayc);
        let fact = FactId::parse("responder.classicAceCount").unwrap();
        let label =
            describe_fact_value(&fact, &FactValue::Partition("two".to_string()), &sys).unwrap();
        assert_eq!(label.en, "2 aces");
    }

    /// Three describe-arms previously matched non-canonical fact ids
    /// (`system.responder.twoLevelNewSuit`, `system.suitResponse.isGameForcing`,
    /// `system.oneNtResponseAfterMajor.forcing`) that no producer emits, so
    /// they were dead. The arms are now keyed to the canonical ids emitted by
    /// `evaluate_system_facts`.
    #[test]
    fn describe_system_fact_value_handles_canonical_forcing_ids() {
        let sys = get_system_config(BaseSystemId::Sayc);

        let two_level = describe_system_fact_value("system.responderTwoLevelNewSuit", &sys)
            .expect("twoLevelNewSuit arm should fire on canonical id");
        assert!(two_level.hcp.contains("HCP"));

        let game_forcing = describe_system_fact_value("system.suitResponseIsGameForcing", &sys)
            .expect("suitResponseIsGameForcing arm should fire on canonical id");
        assert!(
            game_forcing.hcp == "Game-forcing" || game_forcing.hcp == "One-round forcing",
            "unexpected forcing description: {}",
            game_forcing.hcp
        );

        let one_nt = describe_system_fact_value("system.oneNtForcingAfterMajor", &sys)
            .expect("oneNtForcingAfterMajor arm should fire on canonical id");
        assert!(one_nt.hcp.starts_with("1NT is "));
    }
}
