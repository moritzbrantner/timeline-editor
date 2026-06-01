use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TimelineComputeSource {
    Bytes {
        bytes: Vec<u8>,
        label: Option<String>,
        mime_type: Option<String>,
    },
    Url {
        url: String,
        label: Option<String>,
        mime_type: Option<String>,
    },
    Path {
        path: String,
        label: Option<String>,
        mime_type: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineComputeProgress {
    pub phase: String,
    pub completed: Option<u64>,
    pub total: Option<u64>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineComputeErrorCode {
    BackendUnavailable,
    UnsupportedSource,
    UnsupportedCodec,
    DecodeFailed,
    ParseFailed,
    Cancelled,
    Timeout,
    InternalError,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineComputeError {
    pub code: TimelineComputeErrorCode,
    pub message: String,
    pub recoverable: bool,
    pub details: Option<Value>,
}

impl TimelineComputeError {
    pub fn recoverable(code: TimelineComputeErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recoverable: true,
            details: None,
        }
    }

    pub fn fatal(code: TimelineComputeErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recoverable: false,
            details: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineComputeTask {
    pub domain: String,
    pub operation: String,
    pub source: Option<TimelineComputeSource>,
    pub input: Option<String>,
    pub geojson: Option<Value>,
    pub series: Option<Vec<TimelineDataSeries>>,
    pub options: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineDataPoint {
    pub time_ms: f64,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineDataSeries {
    pub id: Option<String>,
    pub label: Option<String>,
    pub unit: Option<String>,
    pub color: Option<String>,
    pub points: Vec<TimelineDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineComputeResponse<T> {
    pub result: Option<T>,
    pub warnings: Vec<String>,
    pub error: Option<TimelineComputeError>,
}

impl<T> TimelineComputeResponse<T> {
    pub fn ok(result: T) -> Self {
        Self {
            result: Some(result),
            warnings: Vec::new(),
            error: None,
        }
    }

    pub fn warn(result: T, warning: impl Into<String>) -> Self {
        Self {
            result: Some(result),
            warnings: vec![warning.into()],
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_error_codes_as_snake_case() {
        let error = TimelineComputeError::recoverable(
            TimelineComputeErrorCode::UnsupportedSource,
            "unsupported",
        );

        let serialized = serde_json::to_string(&error).unwrap();

        assert!(serialized.contains("unsupported_source"));
    }
}
