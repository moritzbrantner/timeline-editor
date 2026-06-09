use serde::{Deserialize, Serialize};
use serde_json::Value;
use timeline_compute::{
    TimelineComputeError, TimelineComputeErrorCode, TimelineComputeResponse, TimelineComputeTask,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TauriComputeRequest {
    pub task: TimelineComputeTask,
}

pub fn timeline_editor_process(request: TauriComputeRequest) -> TimelineComputeResponse<Value> {
    match (
        request.task.domain.as_str(),
        request.task.operation.as_str(),
    ) {
        ("geo", "analyze") => request
            .task
            .geojson
            .as_ref()
            .map(timeline_geo::analyze_geojson)
            .and_then(|analysis| serde_json::to_value(analysis).ok())
            .map(TimelineComputeResponse::ok)
            .unwrap_or_else(|| unsupported("Geo analysis requires a geojson payload.")),
        _ => unsupported(format!(
            "Unsupported timeline compute task {}:{}.",
            request.task.domain, request.task.operation
        )),
    }
}

fn unsupported(message: impl Into<String>) -> TimelineComputeResponse<Value> {
    TimelineComputeResponse {
        result: None,
        warnings: Vec::new(),
        error: Some(TimelineComputeError::recoverable(
            TimelineComputeErrorCode::UnsupportedSource,
            message,
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_geo_task_contract() {
        let response = timeline_editor_process(TauriComputeRequest {
            task: TimelineComputeTask {
                domain: "geo".to_string(),
                operation: "analyze".to_string(),
                source: None,
                input: None,
                geojson: Some(serde_json::json!({
                    "type": "Feature",
                    "geometry": { "type": "Point", "coordinates": [1.0, 2.0] }
                })),
                series: None,
                options: None,
            },
        });

        assert!(response.result.is_some());
        assert!(response.error.is_none());
    }

    #[test]
    fn processes_shared_task_envelope_fixtures() {
        let fixtures: Vec<Value> = serde_json::from_str(include_str!(
            "../../../tests/fixtures/compute-task-envelopes.json"
        ))
        .unwrap();

        for fixture in fixtures {
            let task = fixture.get("task").unwrap().clone();
            let request: TauriComputeRequest =
                serde_json::from_value(serde_json::json!({ "task": task })).unwrap();
            let task_label = format!("{}:{}", request.task.domain, request.task.operation);
            let response = timeline_editor_process(request);

            if task_label == "geo:analyze" {
                assert!(
                    response.result.is_some(),
                    "{task_label} should return a result"
                );
                assert!(
                    response.error.is_none(),
                    "{task_label} should not return an error"
                );
            } else {
                assert!(
                    response.result.is_none(),
                    "{task_label} should not return a result"
                );
                let error = response
                    .error
                    .unwrap_or_else(|| panic!("{task_label} should return an unsupported error"));
                assert!(
                    error.recoverable,
                    "{task_label} error should be recoverable"
                );
                assert_eq!(error.code, TimelineComputeErrorCode::UnsupportedSource);
            }
        }
    }
}
