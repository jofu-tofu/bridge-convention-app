//! Jacoby Transfers module compositions.

use std::collections::HashMap;

use crate::types::{FactComposition, FactOutput, MatchCase};

use super::helpers::{extended_bool, suit_gte};

pub(super) fn add_transfer_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.transfer.targetSuit: spades first (when both 5+), then hearts
    map.insert(
        "module.transfer.targetSuit".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: suit_gte("hand.suitLength.spades", 5),
                    then: FactOutput::Text("spades".to_string()),
                },
                MatchCase {
                    when: suit_gte("hand.suitLength.hearts", 5),
                    then: FactOutput::Text("hearts".to_string()),
                },
            ],
            default: FactOutput::Text("none".to_string()),
        },
    );

    // module.transfer.eligible: has a 5-card major
    map.insert(
        "module.transfer.eligible".to_string(),
        extended_bool("bridge.hasFiveCardMajor", true),
    );

    // module.transfer.preferred: same as eligible
    map.insert(
        "module.transfer.preferred".to_string(),
        extended_bool("module.transfer.eligible", true),
    );

    // module.transfer.openerHasHeartFit: 3+ hearts
    map.insert(
        "module.transfer.openerHasHeartFit".to_string(),
        suit_gte("hand.suitLength.hearts", 3),
    );

    // module.transfer.openerHasSpadesFit: 3+ spades
    map.insert(
        "module.transfer.openerHasSpadesFit".to_string(),
        suit_gte("hand.suitLength.spades", 3),
    );
}
