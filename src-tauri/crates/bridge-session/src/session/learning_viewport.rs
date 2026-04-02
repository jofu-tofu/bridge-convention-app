//! Learning viewport builders — projects convention module internals into
//! viewport response types for UI consumption.
//!
//! Ported from TS `src/session/learning-viewport.ts`.

use std::collections::{HashMap, HashSet, VecDeque};

use bridge_conventions::registry::bundle_registry::list_bundle_inputs;
use bridge_conventions::registry::module_registry::{get_all_modules, get_base_module_ids, get_module};
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::{
    BaseSystemId, BidMeaning, BidMeaningClause, ConventionModule, Disclosure,
    ExplanationEntry, FactOperator, ConstraintValue, LocalFsm, ObsPattern,
    PhaseRef, RecommendationBand, SystemConfig,
};
use bridge_conventions::rule_types::TurnRole;
use bridge_engine::types::{BidSuit, Call};
use serde::{Deserialize, Serialize};

use super::build_viewport::format_call;
use super::format_obs_label::format_transition_label;

// ── DTOs ─────────────────────────────────────────────────────────────

/// Module catalog entry for list display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleCatalogEntry {
    pub module_id: String,
    pub display_name: String,
    pub description: String,
    pub purpose: String,
    pub surface_count: usize,
    pub bundle_ids: Vec<String>,
}

/// Full learning viewport for a single module.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleLearningViewport {
    pub module_id: String,
    pub display_name: String,
    pub description: String,
    pub purpose: String,
    pub teaching: LearningTeachingView,
    pub phases: Vec<PhaseGroupView>,
    pub bundle_ids: Vec<String>,
}

/// Teaching content for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningTeachingView {
    pub tradeoff: Option<String>,
    pub principle: Option<String>,
    pub common_mistakes: Vec<String>,
}

/// Phase group for learning display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseGroupView {
    pub phase: String,
    pub phase_display: String,
    pub turn: Option<String>,
    pub transition_label: Option<String>,
    pub surfaces: Vec<SurfaceDetailView>,
}

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

/// Service teaching label (plain strings, not branded).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceTeachingLabel {
    pub name: String,
    pub summary: String,
}

/// Surface detail view.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceDetailView {
    pub meaning_id: String,
    pub teaching_label: ServiceTeachingLabel,
    pub call: Call,
    pub call_display: String,
    pub disclosure: Disclosure,
    pub recommendation: Option<RecommendationBand>,
    pub explanation_text: Option<String>,
    pub clauses: Vec<SurfaceClauseView>,
}

/// Base module info for settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseModuleInfo {
    pub id: String,
    pub display_name: String,
    pub description: String,
}

/// Entry condition for module root.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryCondition {
    pub label: String,
    pub call: Option<Call>,
    pub turn: Option<String>,
}

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

// ── PhaseRef helpers ─────────────────────────────────────────────────

fn phase_ref_to_vec(pr: &PhaseRef) -> Vec<&str> {
    match pr {
        PhaseRef::Single(s) => vec![s.as_str()],
        PhaseRef::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
    }
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
        } else if ch.is_uppercase() && !result.is_empty() && result.ends_with(|c: char| c.is_lowercase()) {
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

// ── Module catalog ───────────────────────────────────────────────────

/// Build module catalog entries for all registered modules.
pub fn build_module_catalog(system: BaseSystemId) -> Vec<ModuleCatalogEntry> {
    let all_modules = get_all_modules(system);
    let bundle_inputs = list_bundle_inputs();

    // Build reverse map: moduleId → bundleIds that contain it
    let mut module_bundles: HashMap<&str, Vec<String>> = HashMap::new();
    for input in bundle_inputs {
        for member_id in &input.member_ids {
            module_bundles
                .entry(member_id.as_str())
                .or_default()
                .push(input.id.clone());
        }
    }

    all_modules
        .iter()
        .map(|m| ModuleCatalogEntry {
            module_id: m.module_id.clone(),
            display_name: format_module_name(&m.module_id),
            description: format_bid_references(m.description.as_str()),
            purpose: format_bid_references(m.purpose.as_str()),
            surface_count: module_surfaces(m).len(),
            bundle_ids: module_bundles
                .get(m.module_id.as_str())
                .cloned()
                .unwrap_or_default(),
        })
        .collect()
}

/// Build read-only metadata for base system modules (for settings display).
pub fn build_base_module_infos(base_system_id: BaseSystemId) -> Vec<BaseModuleInfo> {
    let ids = get_base_module_ids(base_system_id);
    ids.iter()
        .filter_map(|&id| {
            let m = get_module(id, base_system_id)?;
            Some(BaseModuleInfo {
                id: id.to_string(),
                display_name: format_module_name(id),
                description: m.description.as_str().to_string(),
            })
        })
        .collect()
}

// ── Module learning viewport ─────────────────────────────────────────

/// Build a full learning viewport for a single module.
pub fn build_module_learning_viewport(
    module_id: &str,
    system: BaseSystemId,
) -> Option<ModuleLearningViewport> {
    let m = get_module(module_id, system)?;

    let bundle_inputs = list_bundle_inputs();
    let bundle_ids: Vec<String> = bundle_inputs
        .iter()
        .filter(|b| b.member_ids.iter().any(|mid| mid == module_id))
        .map(|b| b.id.clone())
        .collect();

    let teaching = &m.teaching;
    let phases = build_phase_groups(m, system);

    Some(ModuleLearningViewport {
        module_id: m.module_id.clone(),
        display_name: format_module_name(&m.module_id),
        description: format_bid_references(m.description.as_str()),
        purpose: format_bid_references(m.purpose.as_str()),
        teaching: LearningTeachingView {
            tradeoff: {
                let s = teaching.tradeoff.as_str();
                if s.is_empty() { None } else { Some(format_bid_references(s)) }
            },
            principle: {
                let s = teaching.principle.as_str();
                if s.is_empty() { None } else { Some(format_bid_references(s)) }
            },
            common_mistakes: teaching
                .common_mistakes
                .iter()
                .map(|item| format_bid_references(item.as_str()))
                .collect(),
        },
        phases,
        bundle_ids,
    })
}

// ── Phase ordering ───────────────────────────────────────────────────

/// Derive topological phase order from LocalFsm transitions via BFS.
pub fn derive_phase_order(fsm: &LocalFsm) -> Vec<String> {
    let mut phases = vec![fsm.initial.clone()];
    let mut seen = HashSet::new();
    seen.insert(fsm.initial.as_str().to_string());

    // Build adjacency map
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for t in &fsm.transitions {
        let froms = phase_ref_to_vec(&t.from);
        for f in froms {
            let entry = adjacency.entry(f.to_string()).or_default();
            if !entry.contains(&t.to) {
                entry.push(t.to.clone());
            }
        }
    }

    let mut queue = VecDeque::new();
    queue.push_back(fsm.initial.clone());

    while let Some(current) = queue.pop_front() {
        if let Some(neighbors) = adjacency.get(&current) {
            for next in neighbors {
                if seen.insert(next.clone()) {
                    phases.push(next.clone());
                    queue.push_back(next.clone());
                }
            }
        }
    }

    phases
}

/// Compute the set of post-fit phases for a module.
/// A phase is post-fit if any StateEntry at that phase has `negotiationDelta.fitAgreed`
/// truthy, or if it's reachable downstream from such a phase via FSM transitions.
pub fn compute_post_fit_phases(module: &ConventionModule) -> HashSet<String> {
    let mut fit_phases = HashSet::new();

    for entry in module.states.as_deref().unwrap_or(&[]) {
        let has_fit = entry
            .negotiation_delta
            .as_ref()
            .and_then(|nd| nd.fit_agreed.as_ref())
            .is_some();

        if has_fit {
            for p in phase_ref_to_vec(&entry.phase) {
                fit_phases.insert(p.to_string());
            }
        }
    }

    // Build adjacency from transitions
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::new();
    for t in &module.local.transitions {
        for f in phase_ref_to_vec(&t.from) {
            let entry = adjacency.entry(f.to_string()).or_default();
            if !entry.contains(&t.to) {
                entry.push(t.to.clone());
            }
        }
    }

    // BFS from fit-establishing phases
    let mut result = fit_phases.clone();
    let mut queue: VecDeque<String> = fit_phases.into_iter().collect();
    while let Some(current) = queue.pop_front() {
        if let Some(neighbors) = adjacency.get(&current) {
            for next in neighbors {
                if result.insert(next.clone()) {
                    queue.push_back(next.clone());
                }
            }
        }
    }

    result
}

/// Format a phase string for display. "asked" → "Asked", "shown-hearts" → "Shown Hearts".
fn format_phase_display(phase: &str, turn: Option<&str>) -> String {
    let phase_title = format_module_name(phase);
    if let Some(t) = turn {
        let turn_title = capitalize_first(t);
        format!("{} \u{2014} {}", phase_title, turn_title)
    } else {
        phase_title
    }
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

// ── Entry condition ──────────────────────────────────────────────────

/// Capability → entry condition mapping.
fn cap_entry_conditions() -> HashMap<&'static str, EntryCondition> {
    let mut map = HashMap::new();
    map.insert(
        "opening.1nt",
        EntryCondition {
            label: "Partner opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.major",
        EntryCondition {
            label: "Partner opened a major".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opening.weak-two",
        EntryCondition {
            label: "Partner opened a weak two".to_string(),
            call: None,
            turn: Some("opener".to_string()),
        },
    );
    map.insert(
        "opponent.1nt",
        EntryCondition {
            label: "Opponent opened 1NT".to_string(),
            call: Some(Call::Bid {
                level: 1,
                strain: BidSuit::NoTrump,
            }),
            turn: None,
        },
    );
    map
}

/// Get the primary capability key from declared capabilities.
fn get_primary_capability(
    declared_capabilities: Option<&HashMap<String, String>>,
) -> Option<String> {
    let caps = declared_capabilities?;
    caps.keys().next().cloned()
}

/// Derive full entry condition from the module's host capability.
pub fn derive_entry_condition(module_id: &str) -> Option<EntryCondition> {
    let conditions = cap_entry_conditions();
    for input in list_bundle_inputs() {
        if !input.member_ids.iter().any(|id| id == module_id) {
            continue;
        }
        let cap_id = get_primary_capability(input.declared_capabilities.as_ref())?;
        if let Some(ec) = conditions.get(cap_id.as_str()) {
            return Some(ec.clone());
        }
    }
    None
}

/// Derive root phase label from the module's host capability.
fn derive_root_phase_label(module_id: &str) -> Option<String> {
    derive_entry_condition(module_id).map(|ec| ec.label)
}

/// Find the first surface at a given phase whose normalized intent matches a transition obs pattern.
fn find_trigger_call(
    module: &ConventionModule,
    from_phase: &str,
    obs: &ObsPattern,
) -> Option<Call> {
    for entry in module.states.as_deref().unwrap_or(&[]) {
        let entry_phases = phase_ref_to_vec(&entry.phase);
        if !entry_phases.contains(&from_phase) {
            continue;
        }
        for surface in &entry.surfaces {
            let actions = normalize_intent(&surface.source_intent);
            if actions.iter().any(|a| match_obs(obs, a, None)) {
                return Some(surface.encoding.default_call.clone());
            }
        }
    }
    None
}

/// Convert TurnRole to display string.
fn turn_role_display(role: TurnRole) -> &'static str {
    match role {
        TurnRole::Opener => "opener",
        TurnRole::Responder => "responder",
        TurnRole::Opponent => "opponent",
    }
}

/// Build PhaseGroupView[] from a module's states, ordered by FSM topology.
fn build_phase_groups(
    module: &ConventionModule,
    _system: BaseSystemId,
) -> Vec<PhaseGroupView> {
    let states = module.states.as_deref().unwrap_or(&[]);
    if states.is_empty() {
        return Vec::new();
    }

    let phase_order = derive_phase_order(&module.local);
    let post_fit_phases = compute_post_fit_phases(module);

    // Build incoming transition map
    let mut incoming_map: HashMap<String, Vec<(ObsPattern, String)>> = HashMap::new();
    for t in &module.local.transitions {
        for f in phase_ref_to_vec(&t.from) {
            incoming_map
                .entry(t.to.clone())
                .or_default()
                .push((t.on.clone(), f.to_string()));
        }
    }

    // Group states by phase string (flatten multi-phase entries)
    struct PhaseGroup {
        turn: Option<TurnRole>,
        surfaces: Vec<SurfaceDetailView>,
    }

    let mut phase_map: HashMap<String, PhaseGroup> = HashMap::new();

    for entry in states {
        let entry_phases = phase_ref_to_vec(&entry.phase);

        for phase in entry_phases {
            let metric = if post_fit_phases.contains(phase) {
                Some(RelevantMetric::TrumpTp)
            } else {
                Some(RelevantMetric::Hcp)
            };

            let group = phase_map
                .entry(phase.to_string())
                .or_insert_with(|| PhaseGroup {
                    turn: entry.turn,
                    surfaces: Vec::new(),
                });

            let seen: HashSet<String> = group
                .surfaces
                .iter()
                .map(|s| s.meaning_id.clone())
                .collect();

            for surface in &entry.surfaces {
                if seen.contains(&surface.meaning_id) {
                    continue;
                }

                let raw_explanation =
                    find_explanation_text(&module.explanation_entries, &surface.meaning_id);

                group.surfaces.push(SurfaceDetailView {
                    meaning_id: surface.meaning_id.clone(),
                    teaching_label: ServiceTeachingLabel {
                        name: format_bid_references(surface.teaching_label.name.as_str()),
                        summary: format_bid_references(surface.teaching_label.summary.as_str()),
                    },
                    call: surface.encoding.default_call.clone(),
                    call_display: format_call(&surface.encoding.default_call),
                    disclosure: surface.disclosure,
                    recommendation: Some(surface.ranking.recommendation_band),
                    explanation_text: raw_explanation.map(|t| format_bid_references(&t)),
                    clauses: map_clauses(&surface.clauses, metric),
                });
            }
        }
    }

    // Determine visible phases
    let visible_phases: Vec<&str> = phase_order
        .iter()
        .filter(|p| {
            phase_map
                .get(p.as_str())
                .map_or(false, |g| !g.surfaces.is_empty())
        })
        .map(|p| p.as_str())
        .collect();
    let suppress_labels = visible_phases.len() < 3;

    let mut result = Vec::new();
    for phase in &phase_order {
        let group = match phase_map.get(phase.as_str()) {
            Some(g) if !g.surfaces.is_empty() => g,
            _ => continue,
        };

        let transition_label = if suppress_labels {
            None
        } else if phase == &module.local.initial {
            derive_root_phase_label(&module.module_id)
        } else {
            incoming_map.get(phase.as_str()).and_then(|incoming| {
                let (obs, from_phase) = incoming.first()?;
                let trigger_call = find_trigger_call(module, from_phase, obs);
                let from_group = phase_map.get(from_phase.as_str());
                let source_turn = from_group.and_then(|g| g.turn);
                let turn_str = source_turn.map(turn_role_display);
                Some(format_transition_label(
                    obs,
                    trigger_call.as_ref(),
                    turn_str,
                ))
            })
        };

        let turn_str = group.turn.map(turn_role_display);
        result.push(PhaseGroupView {
            phase: phase.clone(),
            phase_display: format_phase_display(phase, turn_str),
            turn: turn_str.map(|s| s.to_string()),
            transition_label,
            surfaces: group.surfaces.clone(),
        });
    }

    result
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use bridge_conventions::{LocalFsm, ObsPattern, ObsPatternAct, PhaseRef, PhaseTransition};
    use bridge_conventions::BidActionType;
    use bridge_engine::types::{BidSuit, Call};

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
        // Should not match "A2C" because preceded by letter
        assert_eq!(format_bid_references("A2C"), "A2C");
    }

    #[test]
    fn build_module_catalog_returns_8() {
        let catalog = build_module_catalog(BaseSystemId::Sayc);
        assert_eq!(catalog.len(), 8);
    }

    #[test]
    fn build_module_catalog_has_stayman() {
        let catalog = build_module_catalog(BaseSystemId::Sayc);
        let stayman = catalog.iter().find(|e| e.module_id == "stayman");
        assert!(stayman.is_some());
        let s = stayman.unwrap();
        assert_eq!(s.display_name, "Stayman");
        assert!(s.surface_count > 0);
    }

    #[test]
    fn build_module_learning_viewport_stayman() {
        let viewport = build_module_learning_viewport("stayman", BaseSystemId::Sayc);
        assert!(viewport.is_some());
        let v = viewport.unwrap();
        assert_eq!(v.module_id, "stayman");
        assert_eq!(v.display_name, "Stayman");
        assert!(!v.phases.is_empty());
    }

    #[test]
    fn build_module_learning_viewport_unknown() {
        let viewport = build_module_learning_viewport("nonexistent", BaseSystemId::Sayc);
        assert!(viewport.is_none());
    }

    #[test]
    fn derive_phase_order_simple_fsm() {
        let fsm = LocalFsm {
            initial: "idle".to_string(),
            transitions: vec![
                PhaseTransition {
                    from: PhaseRef::Single("idle".to_string()),
                    to: "asked".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Specific(BidActionType::Inquire),
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
                PhaseTransition {
                    from: PhaseRef::Single("asked".to_string()),
                    to: "responded".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Specific(BidActionType::Show),
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
            ],
        };
        let order = derive_phase_order(&fsm);
        assert_eq!(order, vec!["idle", "asked", "responded"]);
    }

    #[test]
    fn derive_phase_order_multi_from() {
        let fsm = LocalFsm {
            initial: "a".to_string(),
            transitions: vec![
                PhaseTransition {
                    from: PhaseRef::Single("a".to_string()),
                    to: "b".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Any,
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
                PhaseTransition {
                    from: PhaseRef::Multiple(vec!["a".to_string(), "b".to_string()]),
                    to: "c".to_string(),
                    on: ObsPattern {
                        act: ObsPatternAct::Any,
                        feature: None,
                        suit: None,
                        strain: None,
                        strength: None,
                        actor: None,
                    },
                },
            ],
        };
        let order = derive_phase_order(&fsm);
        assert_eq!(order, vec!["a", "b", "c"]);
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
        // Just verify the function doesn't panic and returns reasonable results
        let surfaces = module_surfaces(module);
        if let Some(first) = surfaces.first() {
            // May or may not find explanation — we just test the function works
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
    fn build_base_module_infos_returns_4() {
        let infos = build_base_module_infos(BaseSystemId::Sayc);
        assert_eq!(infos.len(), 4);
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
