use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineCaptionCue {
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
}

pub fn parse_srt_timestamps(input: &str) -> Vec<TimelineCaptionCue> {
    input
        .replace("\r\n", "\n")
        .split("\n\n")
        .filter_map(parse_srt_block)
        .collect()
}

fn parse_srt_block(block: &str) -> Option<TimelineCaptionCue> {
    let lines: Vec<_> = block.lines().collect();
    let time_line = lines.iter().position(|line| line.contains("-->"))?;
    let (start, end) = lines[time_line].split_once("-->")?;
    let start_ms = parse_timestamp_ms(start.trim())?;
    let end_ms = parse_timestamp_ms(end.split_whitespace().next()?.trim())?;

    Some(TimelineCaptionCue {
        start_ms,
        end_ms,
        text: lines[(time_line + 1)..].join("\n").trim().to_string(),
    })
}

fn parse_timestamp_ms(input: &str) -> Option<u64> {
    let parts: Vec<_> = input.split([':', ',']).collect();
    if parts.len() != 4 {
        return None;
    }

    let hours = parts[0].parse::<u64>().ok()?;
    let minutes = parts[1].parse::<u64>().ok()?;
    let seconds = parts[2].parse::<u64>().ok()?;
    let milliseconds = format!("{:0<3}", parts[3]).get(..3)?.parse::<u64>().ok()?;

    Some(hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_srt_cue_timing() {
        let cues = parse_srt_timestamps("1\n00:00:01,000 --> 00:00:02,500\nHello");

        assert_eq!(cues[0].start_ms, 1_000);
        assert_eq!(cues[0].end_ms, 2_500);
    }
}
