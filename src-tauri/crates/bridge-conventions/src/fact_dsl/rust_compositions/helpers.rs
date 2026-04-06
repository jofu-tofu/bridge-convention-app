//! Shared helpers for building FactComposition trees.

use crate::types::{
    ExtendedClause, FactComposition, PrimitiveClause, PrimitiveClauseOperator, PrimitiveClauseValue,
};

pub(super) fn suit_gte(fact_id: &str, min: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Gte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
        },
    }
}

pub(super) fn suit_lte(fact_id: &str, max: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Lte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
        },
    }
}

pub(super) fn suit_eq(fact_id: &str, val: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: fact_id.to_string(),
            operator: PrimitiveClauseOperator::Eq,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(val)),
        },
    }
}

pub(super) fn hcp_gte(min: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: "hand.hcp".to_string(),
            operator: PrimitiveClauseOperator::Gte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(min)),
        },
    }
}

pub(super) fn hcp_range(min: u64, max: u64) -> FactComposition {
    FactComposition::And {
        operands: vec![hcp_gte(min), hcp_lte(max)],
    }
}

pub(super) fn hcp_lte(max: u64) -> FactComposition {
    FactComposition::Primitive {
        clause: PrimitiveClause {
            fact_id: "hand.hcp".to_string(),
            operator: PrimitiveClauseOperator::Lte,
            value: PrimitiveClauseValue::Single(serde_json::Number::from(max)),
        },
    }
}

pub(super) fn extended_bool(fact_id: &str, expected: bool) -> FactComposition {
    FactComposition::Extended {
        clause: ExtendedClause::BooleanFact {
            fact_id: fact_id.to_string(),
            expected,
        },
    }
}
