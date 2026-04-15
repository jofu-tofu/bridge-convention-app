//! Branded string newtypes for convention surface metadata.
//!
//! Mirrors TS branded types from `conventions/core/authored-text.ts`.
//! Each newtype wraps a `String` with `#[serde(transparent)]` so it
//! serializes/deserializes as a plain JSON string.

use serde::{Deserialize, Serialize};

macro_rules! newtype_string {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(pub String);

        impl $name {
            pub fn new(s: impl Into<String>) -> Self {
                Self(s.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.0.fmt(f)
            }
        }

        impl From<&str> for $name {
            fn from(s: &str) -> Self {
                Self(s.to_string())
            }
        }
    };
}

newtype_string!(
    /// Short name for a bid meaning (e.g., "Stayman 2C").
    BidName
);
newtype_string!(
    /// Longer summary of a bid meaning.
    BidSummary
);
newtype_string!(
    /// One-line description of what a module does.
    ModuleDescription
);
newtype_string!(
    /// Why a module exists — the problem it solves.
    ModulePurpose
);
newtype_string!(
    /// What you give up by playing this convention.
    TeachingTradeoff
);
newtype_string!(
    /// The broader bridge principle a module embodies.
    TeachingPrinciple
);
/// A common mistake or misconception item — structured as `{ text, reason }`.
///
/// Accepts legacy JSON shape (a bare string) on deserialize for fixture
/// back-compat; serializes only in the new object shape.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TeachingItem {
    pub text: String,
    pub reason: String,
}

impl TeachingItem {
    pub fn new(text: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            reason: reason.into(),
        }
    }

    pub fn as_str(&self) -> &str {
        &self.text
    }
}

impl<'de> Deserialize<'de> for TeachingItem {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error;

        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            Legacy(String),
            Structured {
                text: String,
                #[serde(default)]
                reason: String,
            },
        }

        match Raw::deserialize(deserializer).map_err(D::Error::custom)? {
            Raw::Legacy(text) => Ok(TeachingItem {
                text,
                reason: String::new(),
            }),
            Raw::Structured { text, reason } => Ok(TeachingItem { text, reason }),
        }
    }
}

/// Structured teaching label for a bid meaning surface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TeachingLabel {
    pub name: BidName,
    pub summary: BidSummary,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newtype_serializes_as_plain_string() {
        let name = BidName::new("Stayman 2C");
        let json = serde_json::to_string(&name).unwrap();
        assert_eq!(json, "\"Stayman 2C\"");
    }

    #[test]
    fn newtype_deserializes_from_plain_string() {
        let name: BidName = serde_json::from_str("\"Stayman 2C\"").unwrap();
        assert_eq!(name.as_str(), "Stayman 2C");
    }

    #[test]
    fn teaching_label_roundtrip() {
        let label = TeachingLabel {
            name: BidName::new("Stayman"),
            summary: BidSummary::new("Asks opener for a 4-card major"),
        };
        let json = serde_json::to_string(&label).unwrap();
        let back: TeachingLabel = serde_json::from_str(&json).unwrap();
        assert_eq!(back, label);
    }
}
