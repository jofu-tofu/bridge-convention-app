//! Stayman module compositions.

use std::collections::HashMap;

use crate::types::FactComposition;

use super::helpers::{extended_bool, hcp_gte, suit_gte};

pub(super) fn add_stayman_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.stayman.eligible: hasFourCardMajor AND hcp >= inviteMin
    // Note: inviteMin is baked from SystemConfig at evaluation time.
    // We use a BooleanFact reference here since bridge.hasFourCardMajor is
    // evaluated in layer 2 before module-derived facts in layer 4.
    // The HCP threshold is parameterized — the evaluator must substitute
    // the actual threshold. We use 8 as the SAYC default.
    map.insert(
        "module.stayman.eligible".to_string(),
        FactComposition::And {
            operands: vec![extended_bool("bridge.hasFourCardMajor", true), hcp_gte(8)],
        },
    );

    // module.stayman.preferred: eligible AND (no 5-card major OR has 5-4 in both majors)
    map.insert(
        "module.stayman.preferred".to_string(),
        FactComposition::And {
            operands: vec![
                extended_bool("module.stayman.eligible", true),
                FactComposition::Or {
                    operands: vec![
                        // No 5-card major
                        extended_bool("bridge.hasFiveCardMajor", false),
                        // 5-4 in both majors (either way)
                        FactComposition::And {
                            operands: vec![
                                suit_gte("hand.suitLength.spades", 4),
                                suit_gte("hand.suitLength.hearts", 4),
                                FactComposition::Or {
                                    operands: vec![
                                        suit_gte("hand.suitLength.spades", 5),
                                        suit_gte("hand.suitLength.hearts", 5),
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    );
}
