//! Consistency check between each module fixture's authored
//! `biddingContext` and its `local` FSM idle-exit edge.
//!
//! The FSM deliberately drops actor context on idle-exit edges (see
//! `route_matcher.rs:28–35`), so full derivation is impossible. This test
//! does the partial derivation that IS possible and enforces it, plus pins
//! multi-hop modules via a hand-written allowlist.
//!
//! Transitional: modules without an authored `biddingContext` are skipped
//! (with a log line). Once all 14 module fixtures are backfilled, flip the
//! skip branch to a failure.

use std::fs;
use std::path::PathBuf;

use bridge_conventions::types::bid_action::{BidActionType, BidSuitName};
use bridge_conventions::types::module_types::{BiddingContext, ConventionModule, OpenerRole};
use bridge_conventions::types::rule_types::{LocalFsm, ObsPatternAct, PhaseRef, PhaseTransition};
use bridge_engine::types::{BidSuit, Call};

/// Modules whose trigger the FSM's single idle-exit edge does not encode.
/// Each entry pins the expected authored `biddingContext`; drift causes a
/// clear failure.
fn allowlist() -> Vec<(&'static str, BiddingContext)> {
    vec![(
        "negative-doubles",
        BiddingContext {
            opener_bids: vec![
                Call::Bid { level: 1, strain: BidSuit::Clubs },
                Call::Bid { level: 1, strain: BidSuit::Diamonds },
                Call::Bid { level: 1, strain: BidSuit::Hearts },
                Call::Bid { level: 1, strain: BidSuit::Spades },
            ],
            opener_role: OpenerRole::Partner,
            competitive: true,
        },
    )]
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures")
        .join("modules")
}

fn bid_suit_name_to_bid_suit(name: BidSuitName) -> BidSuit {
    match name {
        BidSuitName::Clubs => BidSuit::Clubs,
        BidSuitName::Diamonds => BidSuit::Diamonds,
        BidSuitName::Hearts => BidSuit::Hearts,
        BidSuitName::Spades => BidSuit::Spades,
        BidSuitName::Notrump => BidSuit::NoTrump,
    }
}

fn from_matches_initial(from: &PhaseRef, initial: &str) -> bool {
    match from {
        PhaseRef::Single(s) => s == initial,
        PhaseRef::Multiple(v) => v.iter().any(|s| s == initial),
    }
}

/// Meaningful idle-exit transitions: those leaving `initial` to a non-idle,
/// non-`inactive` target. Stayman has 5 idle transitions but only 1 leads to
/// a live state; the other 4 funnel to `inactive`.
fn meaningful_idle_exits<'a>(fsm: &'a LocalFsm) -> Vec<&'a PhaseTransition> {
    fsm.transitions
        .iter()
        .filter(|t| from_matches_initial(&t.from, &fsm.initial))
        .filter(|t| t.to != fsm.initial && t.to != "inactive")
        .collect()
}

/// Derive the expected `opener_bids` set from the FSM's idle-exit edges.
/// Returns `Ok(None)` if the FSM encoding is not derivable and the module
/// must be in the allowlist instead.
fn derive_opener_bids(
    module_id: &str,
    fsm: &LocalFsm,
) -> Result<Option<Vec<Call>>, String> {
    let exits = meaningful_idle_exits(fsm);
    if exits.is_empty() {
        return Err(format!(
            "{module_id}: no meaningful idle-exit transition found"
        ));
    }

    let mut bids: Vec<Call> = Vec::new();
    for edge in &exits {
        let act = match edge.on.act {
            ObsPatternAct::Specific(a) => a,
            ObsPatternAct::Any => return Ok(None),
        };
        match act {
            BidActionType::Inquire | BidActionType::Transfer => {
                bids.push(Call::Bid {
                    level: 1,
                    strain: BidSuit::NoTrump,
                });
            }
            BidActionType::Open => {
                let level = edge.on.level.unwrap_or(1);
                let Some(strain) = edge.on.strain else {
                    // Open edge without strain: can't pin a specific opener
                    // bid — treat as un-derivable.
                    return Ok(None);
                };
                bids.push(Call::Bid {
                    level,
                    strain: bid_suit_name_to_bid_suit(strain),
                });
            }
            _ => return Ok(None),
        }
    }

    bids.sort_by(|a, b| {
        let key = |c: &Call| match c {
            Call::Bid { level, strain } => (*level, format!("{strain:?}")),
            _ => (0, String::new()),
        };
        key(a).cmp(&key(b))
    });
    bids.dedup();
    Ok(Some(bids))
}

fn load_module(path: &std::path::Path) -> ConventionModule {
    let raw = fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("failed to read {}: {e}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|e| panic!("failed to parse {}: {e}", path.display()))
}

fn set_of_bids(bids: &[Call]) -> std::collections::BTreeSet<String> {
    bids.iter()
        .map(|c| match c {
            Call::Bid { level, strain } => format!("{level}{strain:?}"),
            other => format!("{other:?}"),
        })
        .collect()
}

#[test]
fn bidding_context_matches_fsm_idle_exit() {
    let allowlist = allowlist();
    let mut checked = 0usize;
    let mut skipped = 0usize;

    for entry in fs::read_dir(fixtures_dir()).expect("read fixtures/modules") {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        let module = load_module(&path);
        let Some(ctx) = module.bidding_context.as_ref() else {
            eprintln!(
                "[bidding_context_consistency] skip {}: biddingContext not authored",
                module.module_id
            );
            skipped += 1;
            continue;
        };

        // All opener_bids entries must be Call::Bid (not Pass/Double/Redouble).
        for call in &ctx.opener_bids {
            match call {
                Call::Bid { .. } => {}
                other => panic!(
                    "{}: biddingContext.openerBids entry must be Call::Bid, got {other:?}",
                    module.module_id
                ),
            }
        }

        // Allowlist pin: authored must match expected exactly.
        if let Some((_, expected)) =
            allowlist.iter().find(|(id, _)| *id == module.module_id.as_str())
        {
            assert_eq!(
                ctx, expected,
                "{}: authored biddingContext diverges from multi-hop allowlist pin",
                module.module_id
            );
            checked += 1;
            continue;
        }

        // Derivable single-hop path.
        let derived = derive_opener_bids(&module.module_id, &module.local)
            .unwrap_or_else(|e| panic!("{e}"));
        let Some(derived) = derived else {
            panic!(
                "{}: FSM idle-exit not derivable and module not in multi-hop allowlist. \
                 Either add `level`/`strain` to the FSM edge or add an allowlist entry.",
                module.module_id
            );
        };

        let authored_set = set_of_bids(&ctx.opener_bids);
        let derived_set = set_of_bids(&derived);
        assert_eq!(
            authored_set, derived_set,
            "{}: authored biddingContext.openerBids = {:?} does not match FSM-derived set {:?}",
            module.module_id, ctx.opener_bids, derived
        );
        checked += 1;
    }

    assert!(
        checked >= 3,
        "expected at least 3 modules with authored biddingContext (stayman, \
         jacoby-transfers, negative-doubles); checked={checked}, skipped={skipped}"
    );
}
