//! Learning viewport builders — projects convention module internals into
//! viewport response types for UI consumption.
//!
//! Type definitions live in `learning_types.rs`. Formatting/text helpers
//! live in `learning_formatters.rs`. This file contains only the viewport
//! builder functions and their supporting helpers.
//!
//! Ported from TS `src/session/learning-viewport.ts`.

use std::collections::{HashMap, HashSet, VecDeque};

use bridge_conventions::fact_catalog::{partition_discriminants, FactValue as CatalogFactValue};
use bridge_conventions::fact_dsl::{FactData, FactValue as EvaluatedFactValue};
use bridge_conventions::pipeline::observation::normalize_intent::normalize_intent;
use bridge_conventions::pipeline::observation::route_matcher::match_obs;
use bridge_conventions::registry::bundle_registry::list_bundle_inputs;
use bridge_conventions::registry::module_registry::{
    get_all_modules, get_base_module_ids, get_module,
};
use bridge_conventions::registry::system_configs::get_system_config;
use bridge_conventions::rule_types::TurnRole;
use bridge_conventions::types::meaning::{
    BidMeaning, BidMeaningClause, ConstraintValue, FactOperator,
};
use bridge_conventions::types::module_types::{
    CellBinding, ModuleReference, ModuleReferenceInterference, ModuleReferenceInterferenceItem,
    ModuleReferenceQuickReference, ModuleReferenceWorkedAuction, ModuleReferenceWorkedAuctionCall,
    ModuleReferenceWorkedAuctionKind, QuickReferenceAxis,
};
use bridge_conventions::{BaseSystemId, ConventionModule, LocalFsm, ObsPattern, PhaseRef};
use bridge_engine::types::{BidSuit, Call};

use super::build_viewport::format_call;
use super::format_obs_label::format_transition_label;
use super::learning_formatters::{
    describe_fact_value, describe_system_fact_value, find_explanation_text, format_bid_references,
    format_phase_display, map_clauses, module_surfaces,
};
use super::learning_types::{
    BaseModuleInfo, EntryCondition, InterferenceItem, LearningTeachingView, ModuleCatalogEntry,
    ModuleLearningViewport, PhaseGroupView, ReferencePredicateBullet, ReferenceView, RelatedLink,
    RelevantMetric, ResolvedAxis, ResolvedCell, ResolvedCellKind, ResolvedInterference,
    ResolvedQuickReference, ResolvedQuickReferenceListItem, ServiceTeachingLabel, SummaryCard,
    SummaryCardPeer, SurfaceDetailView, WhenNotItem, WorkedAuction, WorkedAuctionCall,
    WorkedAuctionKind,
};
use super::response_table::build_response_table;

// ── PhaseRef helpers ─────────────────────────────────────────────────

fn phase_ref_to_vec(pr: &PhaseRef) -> Vec<&str> {
    match pr {
        PhaseRef::Single(s) => vec![s.as_str()],
        PhaseRef::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
    }
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
            display_name: format_bid_references(m.display_name.as_str()),
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
                display_name: format_bid_references(m.display_name.as_str()),
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
        display_name: format_bid_references(m.display_name.as_str()),
        description: format_bid_references(m.description.as_str()),
        purpose: format_bid_references(m.purpose.as_str()),
        teaching: LearningTeachingView {
            tradeoff: {
                let s = teaching.tradeoff.as_str();
                if s.is_empty() {
                    None
                } else {
                    Some(format_bid_references(s))
                }
            },
            principle: {
                let s = teaching.principle.as_str();
                if s.is_empty() {
                    None
                } else {
                    Some(format_bid_references(s))
                }
            },
            common_mistakes: teaching
                .common_mistakes
                .iter()
                .map(|item| format_bid_references(item.as_str()))
                .collect(),
        },
        reference: build_reference_view(m, system),
        phases,
        bundle_ids,
    })
}

/// Error returned when `summary_card.defining_meaning_id` does not resolve
/// to any surface in the module. Debug builds panic; release builds emit a
/// `tracing::warn!` once and fall back to empty summary-card fields.
#[derive(Debug, Clone)]
pub struct MissingMeaning {
    pub module_id: String,
    pub meaning_id: String,
}

/// Locate the surface whose meaning_id matches `meaning_id`, scanning
/// `module.states[*].surfaces[*]` in declaration order.
pub fn resolve_defining_meaning<'a>(
    module: &'a ConventionModule,
    meaning_id: &str,
) -> Result<&'a BidMeaning, MissingMeaning> {
    if let Some(states) = module.states.as_deref() {
        for state in states {
            for surface in &state.surfaces {
                if surface.meaning_id == meaning_id {
                    return Ok(surface);
                }
            }
        }
    }
    Err(MissingMeaning {
        module_id: module.module_id.clone(),
        meaning_id: meaning_id.to_string(),
    })
}

fn build_reference_view(module: &ConventionModule, system: BaseSystemId) -> ReferenceView {
    let reference = &module.reference;

    let summary_card = build_summary_card(module, reference);
    let when_not_to_use = module
        .teaching
        .common_mistakes
        .iter()
        .map(|item| WhenNotItem {
            text: format_bid_references(item.text.as_str()),
            reason: format_bid_references(item.reason.as_str()),
        })
        .collect();

    let response_table = build_response_table(module);

    let worked_auctions = reference
        .worked_auctions
        .iter()
        .map(map_worked_auction)
        .collect();

    let interference = map_interference(&reference.interference);
    let quick_reference = map_quick_reference(module, &reference.quick_reference, system);

    let related_links = reference
        .related_links
        .iter()
        .map(|l| RelatedLink {
            module_id: l.module_id.clone(),
            discriminator: l.discriminator.clone(),
        })
        .collect();

    let when_to_use = reference
        .when_to_use
        .iter()
        .map(|item| ReferencePredicateBullet {
            predicate: item.predicate.clone(),
            gloss: format_bid_references(&item.gloss),
        })
        .collect();

    ReferenceView {
        summary_card,
        when_to_use,
        when_not_to_use,
        response_table,
        worked_auctions,
        interference,
        quick_reference,
        related_links,
    }
}

fn build_summary_card(module: &ConventionModule, reference: &ModuleReference) -> SummaryCard {
    let sc = &reference.summary_card;
    let trigger = format_bid_references(&sc.trigger);
    let partnership = format_bid_references(&sc.partnership);
    let guiding_idea = {
        let s = module.teaching.principle.as_str();
        if s.is_empty() {
            String::new()
        } else {
            format_bid_references(s)
        }
    };

    // Derive peers (empty for hierarchical conventions). Sort by (level, strain).
    let mut peers: Vec<SummaryCardPeer> = sc
        .peers
        .iter()
        .filter_map(|p| match resolve_defining_meaning(module, &p.defining_meaning_id) {
            Ok(meaning) => {
                let (promises, denies) = split_promises_denies(&meaning.clauses);
                let call = meaning.encoding.default_call.clone();
                let call_display = format_call(&call);
                Some(SummaryCardPeer {
                    meaning_id: p.defining_meaning_id.clone(),
                    call,
                    call_display,
                    promises,
                    denies,
                    discriminator_label: format_bid_references(&p.discriminator_label),
                })
            }
            Err(err) => {
                if cfg!(debug_assertions) {
                    panic!(
                        "build_reference_view: module '{}' summaryCard.peers entry defining_meaning_id '{}' does not resolve to any surface",
                        err.module_id, err.meaning_id
                    );
                }
                tracing::warn!(
                    module_id = %err.module_id,
                    meaning_id = %err.meaning_id,
                    "summaryCard.peers entry does not resolve to any surface; skipping"
                );
                None
            }
        })
        .collect();
    peers.sort_by_key(|p| call_sort_key(&p.call));

    match resolve_defining_meaning(module, &sc.defining_meaning_id) {
        Ok(meaning) => {
            let (promises, denies) = split_promises_denies(&meaning.clauses);
            SummaryCard {
                trigger,
                bid: meaning.encoding.default_call.clone(),
                promises,
                denies,
                guiding_idea,
                partnership,
                peers,
            }
        }
        Err(err) => {
            if cfg!(debug_assertions) {
                panic!(
                    "build_reference_view: module '{}' summary_card.defining_meaning_id '{}' does not resolve to any surface",
                    err.module_id, err.meaning_id
                );
            }
            tracing::warn!(
                module_id = %err.module_id,
                meaning_id = %err.meaning_id,
                "summary_card.defining_meaning_id does not resolve to any surface; emitting empty fallback"
            );
            SummaryCard {
                trigger,
                bid: Call::Pass,
                promises: String::new(),
                denies: String::new(),
                guiding_idea,
                partnership,
                peers,
            }
        }
    }
}

/// Stable sort key for summary-card peers: (level, strain ordinal).
/// Non-bid calls sort first. Strain order matches BidSuit declaration order
/// (C, D, H, S, NT).
fn call_sort_key(call: &Call) -> (u8, u8) {
    match call {
        Call::Pass => (0, 0),
        Call::Double => (0, 1),
        Call::Redouble => (0, 2),
        Call::Bid { level, strain } => {
            let strain_ord = match strain {
                BidSuit::Clubs => 0,
                BidSuit::Diamonds => 1,
                BidSuit::Hearts => 2,
                BidSuit::Spades => 3,
                BidSuit::NoTrump => 4,
            };
            (*level as u8, strain_ord)
        }
    }
}

/// Split a meaning's clauses into (promises, denies) descriptions joined by "; ".
/// A clause is Denies if it is a Boolean operator with `false` value, OR its
/// fact_id starts with `"deny_"`. All other public clauses are Promises.
fn split_promises_denies(clauses: &[BidMeaningClause]) -> (String, String) {
    let views = map_clauses(clauses, Some(RelevantMetric::Hcp));

    let mut promises: Vec<String> = Vec::new();
    let mut denies: Vec<String> = Vec::new();

    for (clause, view) in clauses.iter().zip(views.into_iter()) {
        if clause.is_public == Some(false) {
            continue;
        }
        let is_denies = clause.fact_id.starts_with("deny_")
            || (matches!(clause.operator, FactOperator::Boolean)
                && matches!(clause.value, ConstraintValue::Bool(false)));

        let text = format_bid_references(&view.description);
        if is_denies {
            denies.push(text);
        } else {
            promises.push(text);
        }
    }

    (promises.join("; "), denies.join("; "))
}

fn map_worked_auction(auction: &ModuleReferenceWorkedAuction) -> WorkedAuction {
    WorkedAuction {
        kind: match auction.kind {
            ModuleReferenceWorkedAuctionKind::Positive => WorkedAuctionKind::Positive,
            ModuleReferenceWorkedAuctionKind::Negative => WorkedAuctionKind::Negative,
        },
        label: auction.label.clone(),
        calls: auction.calls.iter().map(map_worked_auction_call).collect(),
        responder_hand: auction.responder_hand.clone(),
    }
}

fn map_worked_auction_call(call: &ModuleReferenceWorkedAuctionCall) -> WorkedAuctionCall {
    WorkedAuctionCall {
        seat: call.seat.clone(),
        call: call.call.clone(),
        rationale: format_bid_references(&call.rationale),
    }
}

fn map_interference(interference: &ModuleReferenceInterference) -> ResolvedInterference {
    match interference {
        ModuleReferenceInterference::Applicable { items } => ResolvedInterference::Applicable {
            items: items.iter().map(map_interference_item).collect(),
        },
        ModuleReferenceInterference::NotApplicable { reason } => {
            ResolvedInterference::NotApplicable {
                reason: reason.clone(),
            }
        }
    }
}

fn map_interference_item(item: &ModuleReferenceInterferenceItem) -> InterferenceItem {
    InterferenceItem {
        opponent_action: item.opponent_action.clone(),
        our_action: item.our_action.clone(),
        note: item.note.clone(),
    }
}

type RepresentativeFacts = HashMap<String, EvaluatedFactValue>;

#[derive(Debug, Clone)]
struct AxisPoint {
    label: String,
    samples: Vec<RepresentativeFacts>,
}

fn map_quick_reference(
    module: &ConventionModule,
    qr: &ModuleReferenceQuickReference,
    system: BaseSystemId,
) -> ResolvedQuickReference {
    match qr {
        ModuleReferenceQuickReference::Grid {
            row_axis,
            col_axis,
            cells,
        } => {
            let (resolved_row_axis, row_points) = resolve_axis_with_points(row_axis, system);
            let (resolved_col_axis, col_points) = resolve_axis_with_points(col_axis, system);

            let resolved_cells = cells
                .iter()
                .enumerate()
                .map(|(row_index, row)| {
                    row.iter()
                        .enumerate()
                        .map(|(col_index, cell)| {
                            resolve_grid_cell(
                                module,
                                cell,
                                row_points.get(row_index).unwrap_or_else(|| {
                                    panic!(
                                        "quick reference row index {} out of range for module '{}'",
                                        row_index, module.module_id
                                    )
                                }),
                                col_points.get(col_index).unwrap_or_else(|| {
                                    panic!(
                                        "quick reference col index {} out of range for module '{}'",
                                        col_index, module.module_id
                                    )
                                }),
                                row_index,
                                col_index,
                            )
                        })
                        .collect()
                })
                .collect();

            ResolvedQuickReference::Grid {
                row_axis: resolved_row_axis,
                col_axis: resolved_col_axis,
                cells: resolved_cells,
            }
        }
        ModuleReferenceQuickReference::List { axis, items } => ResolvedQuickReference::List {
            axis: resolve_axis(axis, system),
            items: items
                .iter()
                .map(|i| ResolvedQuickReferenceListItem {
                    recommendation: i.recommendation.clone(),
                    note: i.note.clone(),
                })
                .collect(),
        },
    }
}

fn resolve_grid_cell(
    module: &ConventionModule,
    binding: &CellBinding,
    row_point: &AxisPoint,
    col_point: &AxisPoint,
    row_index: usize,
    col_index: usize,
) -> ResolvedCell {
    match binding {
        CellBinding::Auto => {
            let candidates = matching_entry_surfaces(module, row_point, col_point);
            match candidates.len() {
                0 => not_applicable_cell(),
                1 => render_surface(candidates[0]),
                _ => {
                    let candidate_ids = candidates
                        .iter()
                        .map(|surface| surface.meaning_id.as_str())
                        .collect::<Vec<_>>()
                        .join(", ");
                    panic!(
                        "quick reference auto cell for module '{}' at ({}, {}) [{} × {}] is ambiguous; candidates: {}",
                        module.module_id,
                        row_index,
                        col_index,
                        row_point.label,
                        col_point.label,
                        candidate_ids
                    );
                }
            }
        }
        CellBinding::Surface { id } => render_surface(resolve_surface_by_id(module, id)),
        CellBinding::NotApplicable { .. } => not_applicable_cell(),
    }
}

fn matching_entry_surfaces<'a>(
    module: &'a ConventionModule,
    row_point: &AxisPoint,
    col_point: &AxisPoint,
) -> Vec<&'a BidMeaning> {
    let mut seen_ids = HashSet::new();
    quick_reference_entry_surfaces(module)
        .into_iter()
        .filter(|surface| surface_matches_cell(surface, row_point, col_point))
        .filter(|surface| seen_ids.insert(surface.meaning_id.clone()))
        .collect()
}

fn surface_matches_cell(
    surface: &BidMeaning,
    row_point: &AxisPoint,
    col_point: &AxisPoint,
) -> bool {
    if row_point.samples.is_empty() || col_point.samples.is_empty() {
        return false;
    }

    row_point.samples.iter().any(|row_sample| {
        col_point.samples.iter().any(|col_sample| {
            let mut facts = col_sample.clone();
            facts.extend(row_sample.clone());
            surface_matches_representative(surface, &facts)
        })
    })
}

fn surface_matches_representative(surface: &BidMeaning, facts: &RepresentativeFacts) -> bool {
    surface
        .clauses
        .iter()
        .all(|clause| clause_matches_representative(clause, facts))
}

fn clause_matches_representative(clause: &BidMeaningClause, facts: &RepresentativeFacts) -> bool {
    let Some(fact) = facts.get(&clause.fact_id) else {
        return false;
    };

    match clause.operator {
        FactOperator::Gte => match (&fact.value, &clause.value) {
            (FactData::Number(actual), ConstraintValue::Number(expected)) => {
                *actual >= number_to_f64(expected)
            }
            _ => false,
        },
        FactOperator::Lte => match (&fact.value, &clause.value) {
            (FactData::Number(actual), ConstraintValue::Number(expected)) => {
                *actual <= number_to_f64(expected)
            }
            _ => false,
        },
        FactOperator::Eq => match (&fact.value, &clause.value) {
            (FactData::Number(actual), ConstraintValue::Number(expected)) => {
                (*actual - number_to_f64(expected)).abs() < f64::EPSILON
            }
            (FactData::Boolean(actual), ConstraintValue::Bool(expected)) => actual == expected,
            (FactData::Text(actual), ConstraintValue::String(expected)) => actual == expected,
            _ => false,
        },
        FactOperator::Range => match (&fact.value, &clause.value) {
            (FactData::Number(actual), ConstraintValue::Range { min, max }) => {
                *actual >= number_to_f64(min) && *actual <= number_to_f64(max)
            }
            _ => false,
        },
        FactOperator::Boolean => match (&fact.value, &clause.value) {
            (FactData::Boolean(actual), ConstraintValue::Bool(expected)) => actual == expected,
            _ => false,
        },
        FactOperator::In => match (&fact.value, &clause.value) {
            (FactData::Text(actual), ConstraintValue::List(values)) => values.contains(actual),
            _ => false,
        },
    }
}

fn render_surface(surface: &BidMeaning) -> ResolvedCell {
    let gloss = if surface.teaching_label.summary.as_str().is_empty() {
        let name = surface.teaching_label.name.as_str();
        (!name.is_empty()).then(|| format_bid_references(name))
    } else {
        Some(format_bid_references(
            surface.teaching_label.summary.as_str(),
        ))
    };

    ResolvedCell {
        call: format_bid_references(&format_call(&surface.encoding.default_call)),
        gloss,
        kind: ResolvedCellKind::Action,
    }
}

fn not_applicable_cell() -> ResolvedCell {
    ResolvedCell {
        call: "—".to_string(),
        gloss: None,
        kind: ResolvedCellKind::NotApplicable,
    }
}

fn resolve_surface_by_id<'a>(module: &'a ConventionModule, id: &str) -> &'a BidMeaning {
    all_module_surfaces(module)
        .into_iter()
        .find(|surface| surface.meaning_id == id)
        .unwrap_or_else(|| {
            panic!(
                "quick reference surface binding '{}' not found in module '{}'",
                id, module.module_id
            )
        })
}

fn all_module_surfaces(module: &ConventionModule) -> Vec<&BidMeaning> {
    module
        .states
        .as_deref()
        .into_iter()
        .flat_map(|states| states.iter())
        .flat_map(|state| state.surfaces.iter())
        .collect()
}

fn quick_reference_entry_surfaces(module: &ConventionModule) -> Vec<&BidMeaning> {
    module
        .states
        .as_deref()
        .into_iter()
        .flat_map(|states| states.iter())
        .filter(|state| phase_ref_contains(&state.phase, &module.local.initial))
        .flat_map(|state| state.surfaces.iter())
        .collect()
}

fn phase_ref_contains(phase_ref: &PhaseRef, value: &str) -> bool {
    phase_ref_to_vec(phase_ref)
        .iter()
        .any(|phase| *phase == value)
}

fn resolve_axis_with_points(
    axis: &QuickReferenceAxis,
    system: BaseSystemId,
) -> (ResolvedAxis, Vec<AxisPoint>) {
    match axis {
        QuickReferenceAxis::SystemFactLadder { label, facts } => {
            let sys = get_system_config(system);
            let values: Vec<String> = facts
                .iter()
                .map(|fact| match describe_system_fact_value(fact, &sys) {
                    Some(desc) => desc.hcp,
                    None => fact.clone(),
                })
                .collect();
            let points = facts
                .iter()
                .zip(values.iter())
                .map(|(fact, value)| AxisPoint {
                    label: value.clone(),
                    samples: representative_strength_samples(fact, system),
                })
                .collect();
            (
                ResolvedAxis {
                    label: label.clone(),
                    values,
                },
                points,
            )
        }
        QuickReferenceAxis::PartitionLadder { label, fact } => {
            let sys = get_system_config(system);
            let discriminants = partition_discriminants(fact).unwrap_or_default();
            let values: Vec<String> = discriminants
                .iter()
                .map(|discriminant| {
                    describe_fact_value(
                        fact,
                        &CatalogFactValue::Partition(discriminant.id.to_string()),
                        &sys,
                    )
                    .map(|value| value.en)
                    .unwrap_or_else(|| discriminant.display_name.to_string())
                })
                .collect();
            let points = discriminants
                .iter()
                .zip(values.iter())
                .map(|(discriminant, value)| AxisPoint {
                    label: value.clone(),
                    samples: representative_partition_samples(
                        fact.as_str(),
                        discriminant.id,
                        system,
                    ),
                })
                .collect();
            (
                ResolvedAxis {
                    label: label.clone(),
                    values,
                },
                points,
            )
        }
    }
}

fn resolve_axis(axis: &QuickReferenceAxis, system: BaseSystemId) -> ResolvedAxis {
    match axis {
        QuickReferenceAxis::SystemFactLadder { label, facts } => {
            let sys = get_system_config(system);
            let values = facts
                .iter()
                .map(|fact| match describe_system_fact_value(fact, &sys) {
                    Some(desc) => desc.hcp,
                    None => fact.clone(),
                })
                .collect();
            ResolvedAxis {
                label: label.clone(),
                values,
            }
        }
        QuickReferenceAxis::PartitionLadder { label, fact } => {
            let sys = get_system_config(system);
            let values = partition_discriminants(fact)
                .map(|discriminants| {
                    discriminants
                        .iter()
                        .map(|discriminant| {
                            describe_fact_value(
                                fact,
                                &CatalogFactValue::Partition(discriminant.id.to_string()),
                                &sys,
                            )
                            .map(|label| label.en)
                            .unwrap_or_else(|| discriminant.display_name.to_string())
                        })
                        .collect()
                })
                .unwrap_or_default();
            ResolvedAxis {
                label: label.clone(),
                values,
            }
        }
    }
}

fn representative_strength_samples(
    fact_id: &str,
    system: BaseSystemId,
) -> Vec<RepresentativeFacts> {
    let sys = get_system_config(system);
    let hcp = match fact_id {
        "system.responder.weakHand" => (sys.responder_thresholds.invite_min - 1).max(0) as f64,
        "system.responder.inviteValues" => sys.responder_thresholds.invite_min as f64,
        "system.responder.gameValues" => sys.responder_thresholds.game_min as f64,
        _ => return Vec::new(),
    };
    vec![strength_snapshot(hcp, &sys)]
}

fn representative_partition_samples(
    fact_id: &str,
    discriminant_id: &str,
    system: BaseSystemId,
) -> Vec<RepresentativeFacts> {
    let sys = get_system_config(system);
    match (fact_id, discriminant_id) {
        ("responder.majorShape", "noFourCardMajor") => {
            vec![shape_snapshot(3.0, 3.0, 4.0, 3.0, &sys)]
        }
        ("responder.majorShape", "oneFourCardMajor") => vec![
            shape_snapshot(4.0, 3.0, 4.0, 2.0, &sys),
            shape_snapshot(3.0, 4.0, 4.0, 2.0, &sys),
        ],
        ("responder.majorShape", "fiveFourMajors") => vec![
            shape_snapshot(5.0, 4.0, 2.0, 2.0, &sys),
            shape_snapshot(4.0, 5.0, 2.0, 2.0, &sys),
        ],
        ("responder.majorShape", "flatFourCardMajor") => vec![
            shape_snapshot(4.0, 3.0, 3.0, 3.0, &sys),
            shape_snapshot(3.0, 4.0, 3.0, 3.0, &sys),
        ],
        _ => Vec::new(),
    }
}

fn strength_snapshot(hcp: f64, sys: &bridge_conventions::SystemConfig) -> RepresentativeFacts {
    let mut facts = RepresentativeFacts::new();
    facts.insert("hand.hcp".to_string(), number_fact("hand.hcp", hcp));
    insert_responder_strength_flags(&mut facts, hcp, sys);
    facts
}

fn shape_snapshot(
    spades: f64,
    hearts: f64,
    diamonds: f64,
    clubs: f64,
    sys: &bridge_conventions::SystemConfig,
) -> RepresentativeFacts {
    let mut facts = strength_snapshot(0.0, sys);
    facts.insert(
        "hand.suitLength.spades".to_string(),
        number_fact("hand.suitLength.spades", spades),
    );
    facts.insert(
        "hand.suitLength.hearts".to_string(),
        number_fact("hand.suitLength.hearts", hearts),
    );
    facts.insert(
        "hand.suitLength.diamonds".to_string(),
        number_fact("hand.suitLength.diamonds", diamonds),
    );
    facts.insert(
        "hand.suitLength.clubs".to_string(),
        number_fact("hand.suitLength.clubs", clubs),
    );
    facts.insert(
        "bridge.hasFourCardMajor".to_string(),
        bool_fact("bridge.hasFourCardMajor", spades >= 4.0 || hearts >= 4.0),
    );
    facts.insert(
        "bridge.hasFiveCardMajor".to_string(),
        bool_fact("bridge.hasFiveCardMajor", spades >= 5.0 || hearts >= 5.0),
    );
    facts
}

fn insert_responder_strength_flags(
    facts: &mut RepresentativeFacts,
    hcp: f64,
    sys: &bridge_conventions::SystemConfig,
) {
    let invite_min = sys.responder_thresholds.invite_min as f64;
    let invite_max = sys.responder_thresholds.invite_max as f64;
    let game_min = sys.responder_thresholds.game_min as f64;

    facts.insert(
        "system.responder.weakHand".to_string(),
        bool_fact("system.responder.weakHand", hcp < invite_min),
    );
    facts.insert(
        "system.responder.inviteValues".to_string(),
        bool_fact(
            "system.responder.inviteValues",
            hcp >= invite_min && hcp <= invite_max,
        ),
    );
    facts.insert(
        "system.responder.gameValues".to_string(),
        bool_fact("system.responder.gameValues", hcp >= game_min),
    );
}

fn number_fact(fact_id: &str, value: f64) -> EvaluatedFactValue {
    EvaluatedFactValue {
        fact_id: fact_id.to_string(),
        value: FactData::Number(value),
    }
}

fn bool_fact(fact_id: &str, value: bool) -> EvaluatedFactValue {
    EvaluatedFactValue {
        fact_id: fact_id.to_string(),
        value: FactData::Boolean(value),
    }
}

fn number_to_f64(n: &serde_json::Number) -> f64 {
    n.as_f64().unwrap_or(0.0)
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
fn build_phase_groups(module: &ConventionModule, _system: BaseSystemId) -> Vec<PhaseGroupView> {
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
    use bridge_conventions::{BidActionType, LocalFsm, ObsPatternAct, PhaseTransition};

    #[test]
    fn build_module_catalog_returns_14() {
        let catalog = build_module_catalog(BaseSystemId::Sayc);
        assert_eq!(catalog.len(), 14);
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
        let reference = v.reference;
        assert_eq!(
            reference.summary_card.trigger,
            "Partner opens one notrump, you respond"
        );
        assert_eq!(reference.response_table.rows.len(), 3);
        assert!(!reference.response_table.columns.is_empty());
        for row in &reference.response_table.rows {
            assert_eq!(row.cells.len(), reference.response_table.columns.len());
        }
        assert!(
            reference
                .worked_auctions
                .iter()
                .any(|auction| matches!(auction.kind, WorkedAuctionKind::Negative)),
            "stayman should include a negative worked auction"
        );
        assert!(
            reference
                .worked_auctions
                .iter()
                .any(|auction| auction.responder_hand.is_some()),
            "stayman should emit responder_hand for the counter-example auction"
        );
    }

    #[test]
    fn quick_reference_list_variant_resolves_system_fact_ladder() {
        use bridge_conventions::types::authored_text::{
            ModuleDescription, ModulePurpose, TeachingItem, TeachingPrinciple, TeachingTradeoff,
        };
        use bridge_conventions::types::fact_types::FactDefinitionSet;
        use bridge_conventions::types::meaning::Disclosure;
        use bridge_conventions::types::module_types::{
            ModuleCategory, ModuleReference, ModuleReferenceInterference,
            ModuleReferenceQuickReference, ModuleReferenceSummaryCard, ModuleTeaching,
            QuickReferenceAxis, QuickReferenceListItem,
        };
        use bridge_conventions::types::rule_types::LocalFsm;
        let _ = Disclosure::Standard; // keep import used

        let module = ConventionModule {
            module_id: "list-smoke".to_string(),
            display_name: "List Smoke".to_string(),
            category: ModuleCategory::Custom,
            variant_of: None,
            description: ModuleDescription::new("desc"),
            purpose: ModulePurpose::new("purpose"),
            teaching: ModuleTeaching {
                tradeoff: TeachingTradeoff::new(""),
                principle: TeachingPrinciple::new(""),
                common_mistakes: Vec::<TeachingItem>::new(),
            },
            reference: ModuleReference {
                summary_card: ModuleReferenceSummaryCard {
                    trigger: "t".to_string(),
                    defining_meaning_id: "absent:surface".to_string(),
                    partnership: "p".to_string(),
                    peers: Vec::new(),
                },
                when_to_use: Vec::new(),
                worked_auctions: Vec::new(),
                interference: ModuleReferenceInterference::NotApplicable {
                    reason: "n/a".to_string(),
                },
                quick_reference: ModuleReferenceQuickReference::List {
                    axis: QuickReferenceAxis::SystemFactLadder {
                        label: "Responder strength".to_string(),
                        facts: vec![
                            "system.responder.inviteValues".to_string(),
                            "system.responder.gameValues".to_string(),
                        ],
                    },
                    items: vec![
                        QuickReferenceListItem {
                            recommendation: "Invite".to_string(),
                            note: String::new(),
                        },
                        QuickReferenceListItem {
                            recommendation: "Force to game".to_string(),
                            note: String::new(),
                        },
                    ],
                },
                related_links: Vec::new(),
            },
            bundle_metadata: Default::default(),
            default_role: bridge_conventions::types::module_types::PracticeRole::Responder,
            facts: FactDefinitionSet {
                definitions: Vec::new(),
            },
            explanation_entries: Vec::new(),
            local: LocalFsm {
                initial: "root".to_string(),
                transitions: Vec::new(),
            },
            states: Some(Vec::new()),
            symmetric_pairs: Vec::new(),
            attachments: Vec::new(),
            bidding_context: None,
        };

        // Resolve via map_quick_reference directly (avoids debug-panic on missing meaning).
        let resolved = map_quick_reference(
            &module,
            &module.reference.quick_reference,
            BaseSystemId::Sayc,
        );

        match resolved {
            ResolvedQuickReference::List { axis, items } => {
                assert_eq!(axis.label, "Responder strength");
                assert_eq!(axis.values.len(), 2);
                // Values resolved via describe_system_fact_value — known facts don't
                // round-trip to the raw fact id.
                for v in &axis.values {
                    assert!(!v.starts_with("system."), "unresolved fact id: {v}");
                    assert!(!v.is_empty());
                }
                assert_eq!(items.len(), 2);
                assert_eq!(items[0].recommendation, "Invite");
            }
            ResolvedQuickReference::Grid { .. } => {
                panic!("expected List variant");
            }
        }
    }

    #[test]
    fn quick_reference_grid_partition_ladder_resolves_catalog_labels() {
        use bridge_conventions::types::authored_text::{
            ModuleDescription, ModulePurpose, TeachingItem, TeachingPrinciple, TeachingTradeoff,
        };
        use bridge_conventions::types::fact_types::FactDefinitionSet;
        use bridge_conventions::types::module_types::{
            CellBinding, ModuleCategory, ModuleReference, ModuleReferenceInterference,
            ModuleReferenceQuickReference, ModuleReferenceSummaryCard, ModuleTeaching,
            QuickReferenceAxis,
        };
        use bridge_conventions::types::{FactId, LocalFsm};

        let module = ConventionModule {
            module_id: "grid-smoke".to_string(),
            display_name: "Grid Smoke".to_string(),
            category: ModuleCategory::Custom,
            variant_of: None,
            description: ModuleDescription::new("desc"),
            purpose: ModulePurpose::new("purpose"),
            teaching: ModuleTeaching {
                tradeoff: TeachingTradeoff::new(""),
                principle: TeachingPrinciple::new(""),
                common_mistakes: Vec::<TeachingItem>::new(),
            },
            reference: ModuleReference {
                summary_card: ModuleReferenceSummaryCard {
                    trigger: "t".to_string(),
                    defining_meaning_id: "absent:surface".to_string(),
                    partnership: "p".to_string(),
                    peers: Vec::new(),
                },
                when_to_use: Vec::new(),
                worked_auctions: Vec::new(),
                interference: ModuleReferenceInterference::NotApplicable {
                    reason: "n/a".to_string(),
                },
                quick_reference: ModuleReferenceQuickReference::Grid {
                    row_axis: QuickReferenceAxis::SystemFactLadder {
                        label: "Responder strength".to_string(),
                        facts: vec![
                            "system.responder.weakHand".to_string(),
                            "system.responder.inviteValues".to_string(),
                        ],
                    },
                    col_axis: QuickReferenceAxis::PartitionLadder {
                        label: "Shape".to_string(),
                        fact: FactId::parse("responder.majorShape").unwrap(),
                    },
                    cells: vec![
                        vec![
                            CellBinding::NotApplicable {
                                reason: bridge_conventions::types::FactComposition::And {
                                    operands: Vec::new(),
                                },
                            },
                            CellBinding::Auto,
                            CellBinding::Auto,
                            CellBinding::NotApplicable {
                                reason: bridge_conventions::types::FactComposition::And {
                                    operands: Vec::new(),
                                },
                            },
                        ],
                        vec![
                            CellBinding::NotApplicable {
                                reason: bridge_conventions::types::FactComposition::And {
                                    operands: Vec::new(),
                                },
                            },
                            CellBinding::Auto,
                            CellBinding::Surface {
                                id: "grid-smoke:ask".to_string(),
                            },
                            CellBinding::NotApplicable {
                                reason: bridge_conventions::types::FactComposition::And {
                                    operands: Vec::new(),
                                },
                            },
                        ],
                    ],
                },
                related_links: Vec::new(),
            },
            bundle_metadata: Default::default(),
            default_role: bridge_conventions::types::module_types::PracticeRole::Responder,
            facts: FactDefinitionSet {
                definitions: Vec::new(),
            },
            explanation_entries: Vec::new(),
            local: LocalFsm {
                initial: "root".to_string(),
                transitions: Vec::new(),
            },
            states: Some(vec![bridge_conventions::types::StateEntry {
                phase: bridge_conventions::types::PhaseRef::Single("root".to_string()),
                scope: bridge_conventions::types::default_scope(),
                turn: Some(bridge_conventions::types::TurnRole::Responder),
                kernel: None,
                route: None,
                negotiation_delta: None,
                surfaces: vec![BidMeaning {
                    meaning_id: "grid-smoke:ask".to_string(),
                    semantic_class_id: "grid-smoke:ask".to_string(),
                    module_id: Some("grid-smoke".to_string()),
                    encoding: bridge_conventions::types::BidEncoding {
                        default_call: Call::Bid {
                            level: 2,
                            strain: BidSuit::Clubs,
                        },
                        alternate_encodings: None,
                    },
                    clauses: vec![
                        BidMeaningClause {
                            fact_id: "hand.hcp".to_string(),
                            operator: FactOperator::Gte,
                            value: ConstraintValue::int(8),
                            clause_id: None,
                            description: None,
                            rationale: None,
                            is_public: Some(true),
                        },
                        BidMeaningClause {
                            fact_id: "bridge.hasFourCardMajor".to_string(),
                            operator: FactOperator::Boolean,
                            value: ConstraintValue::Bool(true),
                            clause_id: None,
                            description: None,
                            rationale: None,
                            is_public: Some(true),
                        },
                    ],
                    ranking: bridge_conventions::types::AuthoredRankingMetadata {
                        recommendation_band: bridge_conventions::types::RecommendationBand::Should,
                        module_precedence: Some(0),
                        declaration_order: 0,
                    },
                    source_intent: bridge_conventions::types::SourceIntent {
                        intent_type: "StaymanAsk".to_string(),
                        params: std::collections::HashMap::new(),
                    },
                    disclosure: bridge_conventions::types::Disclosure::Standard,
                    teaching_label: bridge_conventions::types::TeachingLabel {
                        name: bridge_conventions::types::BidName::new("Ask"),
                        summary: bridge_conventions::types::BidSummary::new("Ask for a major"),
                    },
                    surface_bindings: None,
                }],
            }]),
            symmetric_pairs: Vec::new(),
            attachments: Vec::new(),
            bidding_context: None,
        };

        let resolved = map_quick_reference(
            &module,
            &module.reference.quick_reference,
            BaseSystemId::Sayc,
        );

        match resolved {
            ResolvedQuickReference::Grid { col_axis, .. } => {
                assert_eq!(col_axis.label, "Shape");
                assert_eq!(
                    col_axis.values,
                    vec![
                        "No four-card major",
                        "One four-card major",
                        "Five-four in the majors",
                        "Flat hand with a four-card major",
                    ]
                );
            }
            ResolvedQuickReference::List { .. } => panic!("expected Grid variant"),
        }
    }

    #[test]
    #[ignore = "post-2026-04-17 stayman scope fix (Larry-regular): quick-reference grid semantics changed (2C no longer requires 4-card major; 4-3-3-3 exception gloss differs). Snapshot needs manual re-capture against new scope; see docs/architecture/authority-and-module-composition.md Part 3."]
    fn build_module_learning_viewport_stayman_quick_reference_snapshot() {
        let viewport = build_module_learning_viewport("stayman", BaseSystemId::Sayc)
            .expect("stayman viewport should build");
        let quick_reference = viewport.reference.quick_reference;

        match quick_reference {
            ResolvedQuickReference::Grid {
                row_axis,
                col_axis,
                cells,
            } => {
                assert_eq!(row_axis.label, "Responder strength");
                assert_eq!(
                    row_axis.values,
                    vec!["< 8 HCP", "8\u{2013}9 HCP", "10+ HCP"]
                );
                assert_eq!(col_axis.label, "Major-suit shape");
                assert_eq!(
                    col_axis.values,
                    vec![
                        "No four-card major",
                        "One four-card major",
                        "Five-four in the majors",
                        "Flat hand with a four-card major",
                    ]
                );
                assert_eq!(
                    cells,
                    vec![
                        vec![
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                        ],
                        vec![
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                            ResolvedCell {
                                call: "2♣".to_string(),
                                gloss: Some("Ask opener if they hold a 4-card major".to_string()),
                                kind: ResolvedCellKind::Action,
                            },
                            ResolvedCell {
                                call: "2♣".to_string(),
                                gloss: Some(
                                    "Seek a 4-4 major fit with 5-4 in both majors at invite strength"
                                        .to_string(),
                                ),
                                kind: ResolvedCellKind::Action,
                            },
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                        ],
                        vec![
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                            ResolvedCell {
                                call: "2♣".to_string(),
                                gloss: Some("Ask opener if they hold a 4-card major".to_string()),
                                kind: ResolvedCellKind::Action,
                            },
                            ResolvedCell {
                                call: "2♣".to_string(),
                                gloss: Some("Ask opener if they hold a 4-card major".to_string()),
                                kind: ResolvedCellKind::Action,
                            },
                            ResolvedCell {
                                call: "—".to_string(),
                                gloss: None,
                                kind: ResolvedCellKind::NotApplicable,
                            },
                        ],
                    ]
                );
            }
            ResolvedQuickReference::List { .. } => panic!("expected Grid variant"),
        }
    }

    #[test]
    fn stayman_quick_reference_projection_is_total() {
        let viewport = build_module_learning_viewport("stayman", BaseSystemId::Sayc)
            .expect("stayman viewport should build");
        let quick_reference = viewport.reference.quick_reference;

        match quick_reference {
            ResolvedQuickReference::Grid { cells, .. } => {
                for row in cells {
                    for cell in row {
                        assert!(
                            !cell.call.is_empty(),
                            "projected cells should always render a marker or call"
                        );
                    }
                }
            }
            ResolvedQuickReference::List { .. } => panic!("expected Grid variant"),
        }
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
                        level: None,
                        jump: None,
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
                        level: None,
                        jump: None,
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
                        level: None,
                        jump: None,
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
                        level: None,
                        jump: None,
                    },
                },
            ],
        };
        let order = derive_phase_order(&fsm);
        assert_eq!(order, vec!["a", "b", "c"]);
    }

    #[test]
    fn build_base_module_infos_returns_4() {
        let infos = build_base_module_infos(BaseSystemId::Sayc);
        assert_eq!(infos.len(), 4);
    }
}
