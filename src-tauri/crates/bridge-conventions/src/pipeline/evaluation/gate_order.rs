//! Gate order — 4-gate sequence evaluation.
//!
//! Mirrors TS from `pipeline/evaluation/gate-order.ts`.

/// Gate check result.
pub struct GateResult {
    pub passed: bool,
    pub gate_id: String,
    pub reason: Option<String>,
}

/// 4-gate sequence:
/// 1. semantic-applicability — does the hand satisfy all clauses?
/// 2. obligation-satisfaction — does the bid satisfy any forcing obligation?
/// 3. encoder-availability — can the meaning be encoded as a legal call?
/// 4. concrete-legality — is the resolved call legal in the current auction?
pub fn evaluate_gates(
    hand_satisfied: bool,
    encoding_legal: bool,
) -> Vec<GateResult> {
    let mut results = Vec::new();

    // Gate 1: semantic-applicability
    results.push(GateResult {
        passed: hand_satisfied,
        gate_id: "semantic-applicability".into(),
        reason: if hand_satisfied {
            None
        } else {
            Some("Hand does not satisfy all clauses".into())
        },
    });

    if !hand_satisfied {
        return results;
    }

    // Gate 2: obligation-satisfaction (always passes for now — Phase 4)
    results.push(GateResult {
        passed: true,
        gate_id: "obligation-satisfaction".into(),
        reason: None,
    });

    // Gate 3: encoder-availability
    results.push(GateResult {
        passed: encoding_legal,
        gate_id: "encoder-availability".into(),
        reason: if encoding_legal {
            None
        } else {
            Some("No legal encoding available".into())
        },
    });

    if !encoding_legal {
        return results;
    }

    // Gate 4: concrete-legality
    results.push(GateResult {
        passed: encoding_legal,
        gate_id: "concrete-legality".into(),
        reason: None,
    });

    results
}
