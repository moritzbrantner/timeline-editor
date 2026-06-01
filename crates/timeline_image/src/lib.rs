use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TimelineImageMetadata {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub warnings: Vec<String>,
}

pub fn parse_png_dimensions(bytes: &[u8]) -> TimelineImageMetadata {
    let signature = b"\x89PNG\r\n\x1a\n";

    if bytes.len() < 24 || &bytes[..8] != signature {
        return TimelineImageMetadata {
            width: None,
            height: None,
            warnings: vec!["Not a PNG image.".to_string()],
        };
    }

    let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);

    TimelineImageMetadata {
        width: Some(width),
        height: Some(height),
        warnings: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_png_dimensions() {
        let mut png = vec![0; 24];
        png[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        png[16..20].copy_from_slice(&640_u32.to_be_bytes());
        png[20..24].copy_from_slice(&360_u32.to_be_bytes());

        assert_eq!(parse_png_dimensions(&png).width, Some(640));
        assert_eq!(parse_png_dimensions(&png).height, Some(360));
    }
}
