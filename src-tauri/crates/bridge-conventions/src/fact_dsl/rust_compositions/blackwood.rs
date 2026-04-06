//! Blackwood module compositions.

use std::collections::HashMap;

use crate::types::{ExtendedClause, FactComposition, FactOutput, MatchCase};

use super::helpers::hcp_gte;

pub(super) fn add_blackwood_compositions(map: &mut HashMap<String, FactComposition>) {
    // module.blackwood.slamInterest: HCP >= slamMin (default 15 for SAYC)
    map.insert("module.blackwood.slamInterest".to_string(), hcp_gte(15));

    // module.blackwood.aceCount: count of aces
    map.insert(
        "module.blackwood.aceCount".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount {
                            min: Some(4),
                            max: Some(4),
                        },
                    },
                    then: FactOutput::Number(4.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount {
                            min: Some(3),
                            max: Some(3),
                        },
                    },
                    then: FactOutput::Number(3.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount {
                            min: Some(2),
                            max: Some(2),
                        },
                    },
                    then: FactOutput::Number(2.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::AceCount {
                            min: Some(1),
                            max: Some(1),
                        },
                    },
                    then: FactOutput::Number(1.0),
                },
            ],
            default: FactOutput::Number(0.0),
        },
    );

    // module.blackwood.kingCount: count of kings
    map.insert(
        "module.blackwood.kingCount".to_string(),
        FactComposition::Match {
            cases: vec![
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount {
                            min: Some(4),
                            max: Some(4),
                        },
                    },
                    then: FactOutput::Number(4.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount {
                            min: Some(3),
                            max: Some(3),
                        },
                    },
                    then: FactOutput::Number(3.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount {
                            min: Some(2),
                            max: Some(2),
                        },
                    },
                    then: FactOutput::Number(2.0),
                },
                MatchCase {
                    when: FactComposition::Extended {
                        clause: ExtendedClause::KingCount {
                            min: Some(1),
                            max: Some(1),
                        },
                    },
                    then: FactOutput::Number(1.0),
                },
            ],
            default: FactOutput::Number(0.0),
        },
    );
}
