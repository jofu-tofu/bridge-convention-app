//! Bergen module compositions.

use std::collections::HashMap;

use crate::types::FactComposition;

use super::helpers::suit_eq;

pub(super) fn add_bergen_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.bergen.hasMajorSupport: exactly 4 in at least one major
    map.insert(
        "module.bergen.hasMajorSupport".to_string(),
        FactComposition::Or {
            operands: vec![
                suit_eq("hand.suitLength.hearts", 4),
                suit_eq("hand.suitLength.spades", 4),
            ],
        },
    );
}
