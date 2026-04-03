//! Pipeline result types — PipelineResult, PipelineCarrier, EncodedProposal.
//!
//! Mirrors TS types from `pipeline/pipeline-types.ts`.

use bridge_engine::types::Call;
use serde::{Deserialize, Serialize};

use super::evaluation::provenance::{
    ActivationTrace, ApplicabilityEvidence, ArbitrationTrace, EliminationTrace, EncodingTrace,
    HandoffTrace, LegalityTrace,
};
use super::evaluation::types::{MeaningProposal, RankingMetadata};
use super::evidence_bundle::EvidenceBundle;
use crate::adapter::tree_evaluation::CandidateEligibility;

/// Meaning after call assignment.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncodedProposal {
    pub proposal: MeaningProposal,
    pub call: Call,
    pub is_default_encoding: bool,
    pub legal: bool,
    pub all_encodings: Vec<EncodingOption>,
    pub eligibility: CandidateEligibility,
}

/// One encoding option with legality status.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EncodingOption {
    pub call: Call,
    pub legal: bool,
}

/// A surface carried through the entire pipeline with per-surface traces.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineCarrier {
    #[serde(flatten)]
    pub encoded: EncodedProposal,
    pub traces: CarrierTraces,
}

/// Per-carrier traces attached during pipeline evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CarrierTraces {
    pub encoding: EncodingTrace,
    pub legality: LegalityTrace,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub elimination: Option<EliminationTrace>,
}

/// Complete pipeline result — per-surface data on carriers, cross-surface provenance at top level.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineResult {
    pub selected: Option<PipelineCarrier>,
    pub truth_set: Vec<PipelineCarrier>,
    pub acceptable_set: Vec<PipelineCarrier>,
    pub recommended: Vec<PipelineCarrier>,
    pub eliminated: Vec<PipelineCarrier>,
    pub applicability: ApplicabilityEvidence,
    pub activation: Vec<ActivationTrace>,
    pub arbitration: Vec<ArbitrationTrace>,
    pub handoffs: Vec<HandoffTrace>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_bundle: Option<EvidenceBundle>,
}

impl PipelineResult {
    /// Create an empty result (no surfaces matched).
    pub fn empty() -> Self {
        Self {
            selected: None,
            truth_set: Vec::new(),
            acceptable_set: Vec::new(),
            recommended: Vec::new(),
            eliminated: Vec::new(),
            applicability: ApplicabilityEvidence::default(),
            activation: Vec::new(),
            arbitration: Vec::new(),
            handoffs: Vec::new(),
            evidence_bundle: None,
        }
    }
}

impl PipelineCarrier {
    /// Convenience accessor for the underlying proposal.
    pub fn proposal(&self) -> &MeaningProposal {
        &self.encoded.proposal
    }

    /// Convenience accessor for the resolved call.
    pub fn call(&self) -> &Call {
        &self.encoded.call
    }

    /// Convenience accessor for ranking metadata.
    pub fn ranking(&self) -> &RankingMetadata {
        &self.encoded.proposal.ranking
    }
}
