use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineGeoAnalysis {
    pub bbox: Option<[f64; 4]>,
    pub center: Option<[f64; 2]>,
    pub feature_count: usize,
    pub warnings: Vec<String>,
}

pub fn analyze_geojson(value: &Value) -> TimelineGeoAnalysis {
    let mut coordinates = Vec::new();
    collect_coordinates(value, &mut coordinates);

    if coordinates.is_empty() {
        return TimelineGeoAnalysis {
            bbox: None,
            center: None,
            feature_count: count_features(value),
            warnings: vec!["GeoJSON contains no valid coordinates.".to_string()],
        };
    }

    let min_x = coordinates.iter().map(|[x, _]| *x).fold(f64::INFINITY, f64::min);
    let min_y = coordinates.iter().map(|[_, y]| *y).fold(f64::INFINITY, f64::min);
    let max_x = coordinates
        .iter()
        .map(|[x, _]| *x)
        .fold(f64::NEG_INFINITY, f64::max);
    let max_y = coordinates
        .iter()
        .map(|[_, y]| *y)
        .fold(f64::NEG_INFINITY, f64::max);
    let bbox = [min_x, min_y, max_x, max_y];

    TimelineGeoAnalysis {
        bbox: Some(bbox),
        center: Some([(bbox[0] + bbox[2]) / 2.0, (bbox[1] + bbox[3]) / 2.0]),
        feature_count: count_features(value),
        warnings: Vec::new(),
    }
}

fn collect_coordinates(value: &Value, coordinates: &mut Vec<[f64; 2]>) {
    match value {
        Value::Array(values) => {
            if values.len() >= 2 {
                if let (Some(x), Some(y)) = (values[0].as_f64(), values[1].as_f64()) {
                    coordinates.push([x, y]);
                    return;
                }
            }

            for value in values {
                collect_coordinates(value, coordinates);
            }
        }
        Value::Object(object) => {
            for key in ["coordinates", "geometry", "features"] {
                if let Some(value) = object.get(key) {
                    collect_coordinates(value, coordinates);
                }
            }
        }
        _ => {}
    }
}

fn count_features(value: &Value) -> usize {
    match value.get("type").and_then(Value::as_str) {
        Some("Feature") => 1,
        Some("FeatureCollection") => value
            .get("features")
            .and_then(Value::as_array)
            .map_or(0, Vec::len),
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_geojson_bbox() {
        let value = serde_json::json!({
            "type": "Feature",
            "geometry": { "type": "LineString", "coordinates": [[1.0, 2.0], [3.0, 4.0]] }
        });
        let result = analyze_geojson(&value);

        assert_eq!(result.bbox, Some([1.0, 2.0, 3.0, 4.0]));
        assert_eq!(result.center, Some([2.0, 3.0]));
    }
}
