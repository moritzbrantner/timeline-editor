use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineVideoMetadata {
    pub duration_ms: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_rate: Option<f64>,
    pub warnings: Vec<String>,
}

impl TimelineVideoMetadata {
    pub fn unsupported() -> Self {
        Self {
            duration_ms: None,
            width: None,
            height: None,
            frame_rate: None,
            warnings: vec!["Video container parsing is not implemented in the Rust crate yet.".to_string()],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unsupported_metadata_is_recoverable_shape() {
        assert_eq!(TimelineVideoMetadata::unsupported().warnings.len(), 1);
    }
}
