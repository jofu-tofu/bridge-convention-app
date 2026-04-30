//! Provenance and trace types for pipeline decision tracking.
//!
//! Mirrors TS types from `pipeline/evaluation/provenance.ts`.

use serde::{Deserialize, Serialize};

/// How the encoding was resolved.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EncoderKind {
    DefaultCall,
    Resolver,
    AlternateEncoding,
    FrontierStep,
    RelayMap,
}

/// Trace for how a surface's encoding was resolved.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodingTrace {
    pub encoder_kind: EncoderKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub considered_calls: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blocked_calls: Option<Vec<String>>,
}

/// Trace for legality check.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegalityTrace {
    pub legal: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Trace for why a surface was eliminated.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EliminationTrace {
    pub gate_id: String,
    pub reason: String,
}

/// Evidence for how surfaces were found applicable.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApplicabilityEvidence {
    pub total_surfaces: usize,
    pub matched_count: usize,
    pub eliminated_count: usize,
}
