//! Encoder resolver — resolves concrete calls for non-direct encoders.
//!
//! Mirrors TS from `pipeline/evaluation/encoder-resolver.ts`.

use bridge_engine::types::Call;

use crate::pipeline::evaluation::provenance::{EncoderKind, EncodingTrace};
use crate::pipeline::types::EncodingOption;
use crate::types::meaning::BidEncoding;

/// Result of encoding resolution.
pub struct EncodingResolution {
    /// The resolved call.
    pub call: Call,
    /// Whether this is the default encoding.
    pub is_default: bool,
    /// All encoding options with legality.
    pub all_encodings: Vec<EncodingOption>,
    /// Encoding trace for provenance.
    pub trace: EncodingTrace,
}

/// Resolve the encoding for a meaning surface.
///
/// Tries default_call first, then alternate_encodings.
/// Returns the first legal call found, or the default if all are illegal.
pub fn resolve_encoding(
    encoding: &BidEncoding,
    is_legal: &dyn Fn(&Call) -> bool,
) -> EncodingResolution {
    let default_legal = is_legal(&encoding.default_call);

    let mut all_encodings = vec![EncodingOption {
        call: encoding.default_call.clone(),
        legal: default_legal,
    }];

    // Check alternate encodings
    if let Some(ref alternates) = encoding.alternate_encodings {
        for alt in alternates {
            let legal = is_legal(&alt.call);
            all_encodings.push(EncodingOption {
                call: alt.call.clone(),
                legal,
            });
        }
    }

    // Find first legal encoding
    let first_legal = all_encodings.iter().find(|e| e.legal);

    match first_legal {
        Some(legal_enc) => {
            let is_default = legal_enc.call == encoding.default_call;
            EncodingResolution {
                call: legal_enc.call.clone(),
                is_default,
                all_encodings,
                trace: EncodingTrace {
                    encoder_kind: if is_default {
                        EncoderKind::DefaultCall
                    } else {
                        EncoderKind::AlternateEncoding
                    },
                    considered_calls: None,
                    blocked_calls: None,
                },
            }
        }
        None => {
            // All illegal — return default anyway
            EncodingResolution {
                call: encoding.default_call.clone(),
                is_default: true,
                all_encodings,
                trace: EncodingTrace {
                    encoder_kind: EncoderKind::DefaultCall,
                    considered_calls: None,
                    blocked_calls: None,
                },
            }
        }
    }
}
