//! Alert/disclosure resolution.
//!
//! Mirrors TS from `pipeline/evaluation/alert.ts`.

use serde::{Deserialize, Serialize};

use crate::types::meaning::Disclosure;

/// How a bid should be annotated for opponents.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AnnotationType {
    Alert,
    Announce,
    Educational,
}

/// Alert resolution result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BidAlert {
    pub alertable: bool,
    pub annotation_type: Option<AnnotationType>,
}

/// Check if a disclosure level requires opponent notification.
pub fn is_alertable(disclosure: Disclosure) -> bool {
    matches!(disclosure, Disclosure::Alert | Disclosure::Announcement)
}

/// Resolve a BidAlert from a disclosure level.
pub fn resolve_alert(disclosure: Disclosure) -> BidAlert {
    match disclosure {
        Disclosure::Alert => BidAlert {
            alertable: true,
            annotation_type: Some(AnnotationType::Alert),
        },
        Disclosure::Announcement => BidAlert {
            alertable: true,
            annotation_type: Some(AnnotationType::Announce),
        },
        Disclosure::Natural | Disclosure::Standard => BidAlert {
            alertable: false,
            annotation_type: Some(AnnotationType::Educational),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_is_alertable() {
        assert!(is_alertable(Disclosure::Alert));
        assert!(is_alertable(Disclosure::Announcement));
        assert!(!is_alertable(Disclosure::Natural));
        assert!(!is_alertable(Disclosure::Standard));
    }
}
