use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineAudioWaveformOptions {
    pub sample_count: usize,
    pub normalize: bool,
}

impl Default for TimelineAudioWaveformOptions {
    fn default() -> Self {
        Self {
            sample_count: 96,
            normalize: true,
        }
    }
}

pub fn waveform_peaks(samples: &[f32], options: TimelineAudioWaveformOptions) -> Vec<f32> {
    let sample_count = options.sample_count.max(1);
    let mut waveform = vec![0.0; sample_count];

    if samples.is_empty() {
        return waveform;
    }

    for (bucket_index, bucket) in waveform.iter_mut().enumerate() {
        let start = ((bucket_index as f64 / sample_count as f64) * samples.len() as f64).floor() as usize;
        let end = (((bucket_index + 1) as f64 / sample_count as f64) * samples.len() as f64)
            .floor()
            .max((start + 1) as f64) as usize;
        let peak = samples[start..end.min(samples.len())]
            .iter()
            .map(|sample| sample.abs())
            .fold(0.0_f32, f32::max);

        *bucket = peak.clamp(0.0, 1.0);
    }

    if options.normalize {
        let max_peak = waveform.iter().copied().fold(0.0_f32, f32::max);
        if max_peak > 0.0 {
            for value in &mut waveform {
                *value = (*value / max_peak).clamp(0.0, 1.0);
            }
        }
    }

    waveform
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buckets_waveform_peaks() {
        let peaks = waveform_peaks(
            &[0.0, -0.5, 0.25, 1.0],
            TimelineAudioWaveformOptions {
                sample_count: 2,
                normalize: false,
            },
        );

        assert_eq!(peaks, vec![0.5, 1.0]);
    }
}
