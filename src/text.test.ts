import { describe, expect, test } from "vitest";

import {
  createTimelineTextFileAsset,
  detectTimelineTextFormat,
  getTimelineTextCuesAt,
  parseTimelineAssText,
  parseTimelineSrtText,
  parseTimelineText,
  parseTimelineWebVttText,
} from "./text";

describe("subtitle text parsing", () => {
  test("parses SRT indexes, multiline text, timing, and alignment tags", () => {
    const result = parseTimelineSrtText(String.raw`1
00:00:01,250 --> 00:00:03,500
{\an8}<i>Hello</i>
world

2
00:00:04,000 --> 00:00:05,000
<b>Next line</b>`);

    expect(result.format).toBe("srt");
    expect(result.cues).toHaveLength(2);
    expect(result.cues[0]).toMatchObject({
      id: "1",
      startMs: 1_250,
      endMs: 3_500,
      text: "Hello\nworld",
      alignment: "top-center",
    });
    expect(result.cues[1]).toMatchObject({
      startMs: 4_000,
      endMs: 5_000,
      text: "Next line",
      bold: true,
    });
  });

  test("parses WebVTT cue identifiers and simple settings", () => {
    const result = parseTimelineWebVttText(`WEBVTT

intro
00:00:01.000 --> 00:00:02.500 align:end position:70% line:20%
<v Speaker>Hello</v>

NOTE ignored
not a cue`);

    expect(result.format).toBe("webvtt");
    expect(result.cues).toEqual([
      expect.objectContaining({
        id: "intro",
        startMs: 1_000,
        endMs: 2_500,
        text: "Hello",
        alignment: "bottom-right",
        positionX: 70,
        positionY: 20,
      }),
    ]);
  });

  test("parses ASS styles, colors, alignment, and common override tags", () => {
    const result = parseTimelineAssText(String.raw`[Script Info]
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, BackColour, Bold, Italic, Underline, Alignment, MarginL, MarginR, MarginV
Style: Default, Arial, 32, &H00FFFFFF, &H80000000, -1, 0, 0, 2, 30, 40, 50

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 3,0:00:01.00,0:00:04.50,Default,Actor,0,0,0,,{\an8\pos(960,100)\b1\i1\u1\fs44\fnVerdana\c&H0000FF&\bord2\shad1}Hello\NASS
Comment: 0,0:00:02.00,0:00:03.00,Default,,0,0,0,,Ignored`);

    expect(result.format).toBe("ass");
    expect(result.styles?.[0]).toMatchObject({
      name: "Default",
      fontFamily: "Arial",
      fontSize: 32,
      color: "rgba(255, 255, 255, 1)",
      backgroundColor: "rgba(0, 0, 0, 0.498)",
      bold: true,
      italic: false,
      underline: false,
      alignment: "bottom-center",
      marginLeft: 30,
      marginRight: 40,
      marginVertical: 50,
    });
    expect(result.cues).toHaveLength(1);
    expect(result.cues[0]).toMatchObject({
      startMs: 1_000,
      endMs: 4_500,
      text: "Hello\nASS",
      layer: 3,
      styleName: "Default",
      actor: "Actor",
      alignment: "top-center",
      positionX: 50,
      bold: true,
      italic: true,
      underline: true,
      fontFamily: "Verdana",
      fontSize: 44,
      color: "#ff0000",
      outlineColor: "rgba(0, 0, 0, 0.85)",
      shadowColor: "rgba(0, 0, 0, 0.85)",
    });
    expect(result.cues[0]?.positionY).toBeCloseTo(9.259, 2);
  });

  test("detects text formats from options, mime type, extension, and content", () => {
    expect(detectTimelineTextFormat("", { format: "srt" })).toBe("srt");
    expect(detectTimelineTextFormat("", { mimeType: "text/vtt" })).toBe("webvtt");
    expect(detectTimelineTextFormat("", { sourceLabel: "dialogue.ass" })).toBe("ass");
    expect(detectTimelineTextFormat("WEBVTT\n\n")).toBe("webvtt");
    expect(detectTimelineTextFormat("[Events]\nFormat: Start, End, Text")).toBe("ass");
    expect(detectTimelineTextFormat("00:00:01,000 --> 00:00:02,000")).toBe("srt");
    expect(detectTimelineTextFormat("just text")).toBe("plain");
  });

  test("parses through the generic helper and returns active cues", () => {
    const result = parseTimelineText("00:00:01,000 --> 00:00:02,000\nHello", {
      sourceLabel: "line.srt",
    });

    expect(result.format).toBe("srt");
    expect(getTimelineTextCuesAt({ mediaType: "text", cues: result.cues }, 1_500)).toHaveLength(1);
    expect(getTimelineTextCuesAt({ mediaType: "text", cues: result.cues }, 2_500)).toHaveLength(0);
  });

  test("creates subtitle assets from files", async () => {
    const file = new File(["00:00:00,000 --> 00:00:02,000\nImported"], "imported.srt", {
      type: "application/x-subrip",
    });
    const result = await createTimelineTextFileAsset(file, { language: "en" });

    expect(result.asset).toEqual(
      expect.objectContaining({
        id: "subtitle-imported-srt",
        label: "imported.srt",
        kind: "subtitle",
        mediaType: "text",
        durationMs: 2_000,
        data: expect.objectContaining({
          mediaType: "text",
          format: "srt",
          language: "en",
          cues: [expect.objectContaining({ text: "Imported" })],
        }),
      }),
    );
  });
});
