use timeline_compute::{TimelineDataPoint, TimelineDataSeries};

pub fn downsample_series(series: &[TimelineDataSeries], max_points: usize) -> Vec<TimelineDataSeries> {
    series
        .iter()
        .map(|entry| TimelineDataSeries {
            points: downsample_points(&entry.points, max_points),
            ..entry.clone()
        })
        .collect()
}

pub fn downsample_points(points: &[TimelineDataPoint], max_points: usize) -> Vec<TimelineDataPoint> {
    if max_points == 0 || points.len() <= max_points {
        return points.to_vec();
    }

    let step = points.len() as f64 / max_points as f64;
    (0..max_points)
        .map(|index| points[(index as f64 * step).floor() as usize].clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downsamples_points() {
        let points = (0..10)
            .map(|value| TimelineDataPoint {
                time_ms: value as f64,
                value: value as f64,
            })
            .collect::<Vec<_>>();

        assert_eq!(downsample_points(&points, 5).len(), 5);
    }
}
