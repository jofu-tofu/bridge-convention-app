use std::fmt;

use serde::{Deserialize, Serialize};

use crate::fact_catalog::{is_known_fact_id, suggest_fact_ids};

/// Validated fact identifier for authored references.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct FactId(String);

impl FactId {
    pub fn parse(raw: &str) -> Result<Self, FactCatalogError> {
        if is_known_fact_id(raw) {
            return Ok(Self(raw.to_string()));
        }

        Err(FactCatalogError::UnknownFactId {
            raw: raw.to_string(),
            suggestions: suggest_fact_ids(raw)
                .into_iter()
                .map(str::to_string)
                .collect(),
        })
    }

    pub fn as_str(&self) -> &str {
        self.0.as_str()
    }

    pub(crate) fn new_unchecked(raw: &str) -> Self {
        Self(raw.to_string())
    }
}

impl<'de> Deserialize<'de> for FactId {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        Self::parse(&raw).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FactCatalogError {
    UnknownFactId {
        raw: String,
        suggestions: Vec<String>,
    },
}

impl fmt::Display for FactCatalogError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FactCatalogError::UnknownFactId { raw, suggestions } => {
                write!(f, "unknown fact id '{raw}'")?;
                if !suggestions.is_empty() {
                    write!(f, "; nearest known ids: {}", suggestions.join(", "))?;
                }
                Ok(())
            }
        }
    }
}

impl std::error::Error for FactCatalogError {}

#[cfg(test)]
mod tests {
    use super::FactId;

    #[test]
    fn parse_known_fact_id() {
        let fact = FactId::parse("system.responder.inviteValues").unwrap();
        assert_eq!(fact.as_str(), "system.responder.inviteValues");
    }

    #[test]
    fn parse_unknown_fact_id_includes_suggestions() {
        let err = FactId::parse("system.responder.invteValues").unwrap_err();
        let message = err.to_string();
        assert!(message.contains("unknown fact id"));
        assert!(message.contains("system.responder.inviteValues"));
    }
}
