import { createElement } from "react";

import type { TimelineEditorExtension, TimelineWorkbenchAsset } from "./react/workbench/types";
import type { TimelineMediaSourceRef } from "./media-types";
import { formatTimelineEditorTimeMs } from "./time";

export type TimelineTextAlignment =
  | "left"
  | "center"
  | "right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type TimelineTextCue = {
  id?: string;
  startMs: number;
  endMs: number;
  text: string;
  layer?: number;
  styleName?: string;
  actor?: string;
  alignment?: TimelineTextAlignment;
  marginLeft?: number;
  marginRight?: number;
  marginVertical?: number;
  overrideText?: string;
  positionX?: number;
  positionY?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  outlineColor?: string;
  shadowColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  data?: Record<string, unknown>;
};

export type TimelineTextStyle = {
  name: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: TimelineTextAlignment;
  outlineColor?: string;
  shadowColor?: string;
  marginLeft?: number;
  marginRight?: number;
  marginVertical?: number;
  data?: Record<string, unknown>;
};

export type TimelineTextFormat = "plain" | "ass-like" | "ass" | "ssa" | "srt" | "webvtt";

export type TimelineTextParseOptions = {
  format?: TimelineTextFormat;
  sourceLabel?: string;
  mimeType?: string;
};

export type TimelineTextParseResult = {
  format: TimelineTextFormat;
  cues: TimelineTextCue[];
  styles?: TimelineTextStyle[];
  warnings?: string[];
};

export type TimelineTextItemData = {
  mediaType: "text";
  format?: TimelineTextFormat;
  text?: string;
  cues?: TimelineTextCue[];
  styles?: TimelineTextStyle[];
  language?: string;
  source?: TimelineMediaSourceRef;
};

export type TimelineTextFileAssetOptions = {
  id?: string;
  label?: string;
  durationMs?: number;
  color?: string;
  language?: string;
  metadata?: Record<string, unknown>;
};

export type TimelineTextFileAssetResult = {
  asset: TimelineWorkbenchAsset<TimelineTextItemData>;
  warnings?: string[];
};

export type { TimelineMediaSourceRef } from "./media-types";

export function getTimelineTextCueAt(
  data: TimelineTextItemData | undefined,
  offsetMs: number,
): TimelineTextCue | undefined {
  return getTimelineTextCuesAt(data, offsetMs).at(-1);
}

export function getTimelineTextCuesAt(
  data: TimelineTextItemData | undefined,
  offsetMs: number,
): TimelineTextCue[] {
  return (
    data?.cues
      ?.filter((cue) => cue.startMs <= offsetMs && cue.endMs >= offsetMs)
      .sort(
        (left, right) => (left.layer ?? 0) - (right.layer ?? 0) || left.startMs - right.startMs,
      ) ?? []
  );
}

export function getTimelineTextStyleForCue(
  data: TimelineTextItemData | undefined,
  cue: TimelineTextCue,
): TimelineTextStyle | undefined {
  return cue.styleName
    ? data?.styles?.find((style) => style.name.toLowerCase() === cue.styleName?.toLowerCase())
    : undefined;
}

export function getTimelineTextDisplayText(
  data: TimelineTextItemData | undefined,
  fallback: string,
  offsetMs?: number,
) {
  const activeCue =
    offsetMs === undefined ? undefined : getTimelineTextCueAt(data, Math.max(0, offsetMs));
  const cue = activeCue ?? data?.cues?.[0];

  return cue?.overrideText ?? cue?.text ?? data?.text ?? data?.source?.label ?? fallback;
}

export function createTimelineTextExtension(): TimelineEditorExtension<TimelineTextItemData> {
  return {
    id: "timeline-text",
    itemKinds: ["text", "caption", "subtitle"],
    mediaTypes: ["text"],
    renderItem: ({ item }) =>
      createElement(
        "span",
        { className: "grid min-w-0 gap-0.5" },
        createElement(
          "span",
          { className: "truncate italic" },
          getTimelineTextDisplayText(item.data, item.label),
        ),
        item.data?.language
          ? createElement(
              "span",
              { className: "truncate text-[10px] uppercase tracking-normal text-white/70" },
              item.data.language,
            )
          : null,
      ),
    renderPreview: ({ currentTimeMs, items }) =>
      createElement(
        "div",
        { className: "grid w-full max-w-xl gap-2 text-white" },
        items.map((item) => {
          const offsetMs = currentTimeMs - item.startMs;
          const cues = getTimelineTextCuesAt(item.data, offsetMs);
          const cue = cues.at(-1);
          const text = getTimelineTextDisplayText(item.data, item.label, offsetMs);

          return createElement(
            "div",
            {
              key: item.id,
              "data-slot": "timeline-media-text-cue",
              className: "grid gap-1 rounded border border-white/10 bg-white/10 px-3 py-2",
            },
            cues.length > 0
              ? createElement(
                  "div",
                  { className: "grid gap-1 text-sm font-medium whitespace-pre-line" },
                  cues.map((activeCue, index) =>
                    createElement(
                      "div",
                      {
                        key: activeCue.id ?? `${activeCue.startMs}-${activeCue.endMs}-${index}`,
                      },
                      activeCue.overrideText ?? activeCue.text,
                    ),
                  ),
                )
              : createElement(
                  "div",
                  { className: "text-sm font-medium whitespace-pre-line" },
                  text,
                ),
            cue
              ? createElement(
                  "div",
                  { className: "text-xs text-white/60" },
                  `${formatTimelineEditorTimeMs(cue.startMs)} - ${formatTimelineEditorTimeMs(cue.endMs)}`,
                )
              : null,
          );
        }),
      ),
  };
}

export function detectTimelineTextFormat(
  input: string,
  options: TimelineTextParseOptions = {},
): TimelineTextFormat {
  if (options.format) {
    return options.format;
  }

  const mimeType = options.mimeType?.toLowerCase();

  if (mimeType) {
    if (mimeType.includes("webvtt") || mimeType.includes("vtt")) {
      return "webvtt";
    }

    if (mimeType.includes("subrip") || mimeType.includes("srt")) {
      return "srt";
    }

    if (mimeType.includes("ssa") || mimeType.includes("ass")) {
      return "ass";
    }
  }

  const sourceLabel = options.sourceLabel?.toLowerCase();
  const extension = sourceLabel?.match(/\.([a-z0-9]+)(?:$|[?#])/)?.[1];

  if (extension === "vtt" || extension === "webvtt") {
    return "webvtt";
  }

  if (extension === "srt") {
    return "srt";
  }

  if (extension === "ass") {
    return "ass";
  }

  if (extension === "ssa") {
    return "ssa";
  }

  const trimmed = input.replace(/^\uFEFF/, "").trimStart();

  if (/^WEBVTT\b/i.test(trimmed)) {
    return "webvtt";
  }

  if (/^\[(Script Info|Events)\]/im.test(input)) {
    return "ass";
  }

  if (/\d{1,2}:\d{2}:\d{2},\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2},\d{1,3}/.test(input)) {
    return "srt";
  }

  return "plain";
}

export function parseTimelineText(
  input: string,
  options: TimelineTextParseOptions = {},
): TimelineTextParseResult {
  const format = detectTimelineTextFormat(input, options);

  if (format === "srt") {
    return parseTimelineSrtText(input);
  }

  if (format === "webvtt") {
    return parseTimelineWebVttText(input);
  }

  if (format === "ass" || format === "ssa" || format === "ass-like") {
    const result = parseTimelineAssText(input);

    return { ...result, format };
  }

  return {
    format: "plain",
    cues: input.trim()
      ? [{ startMs: 0, endMs: 1_000, text: input.replace(/\r\n?/g, "\n").trim() }]
      : [],
  };
}

export function parseTimelineSrtText(input: string): TimelineTextParseResult {
  const blocks = splitSubtitleBlocks(input);
  const cues = blocks.flatMap((block, index) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timeLineIndex < 0) {
      return [];
    }

    const [startText, endAndSettings = ""] = lines[timeLineIndex]!.split(/\s*-->\s*/);
    const endText = endAndSettings.split(/\s+/)[0] ?? "";
    const startMs = parseSubtitleTimestampMs(startText);
    const endMs = parseSubtitleTimestampMs(endText);

    if (startMs === undefined || endMs === undefined || endMs < startMs) {
      return [];
    }

    const textLines = lines.slice(timeLineIndex + 1);
    const parsedText = parseTimelineSubtitleInlineText(textLines.join("\n"));

    return [
      {
        id: lines[0] && timeLineIndex > 0 ? lines[0] : undefined,
        startMs,
        endMs,
        text: parsedText.text,
        alignment: parsedText.alignment,
        bold: parsedText.bold,
        italic: parsedText.italic,
        underline: parsedText.underline,
        data: { index },
      } satisfies TimelineTextCue,
    ];
  });

  return { format: "srt", cues };
}

export function parseTimelineWebVttText(input: string): TimelineTextParseResult {
  const blocks = splitSubtitleBlocks(input.replace(/^\uFEFF/, ""));
  const cues: TimelineTextCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());

    if (lines.length === 0 || /^WEBVTT\b/i.test(lines[0] ?? "")) {
      continue;
    }

    if (/^(NOTE|STYLE|REGION)(?:\s|$)/i.test(lines[0] ?? "")) {
      continue;
    }

    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timeLineIndex < 0) {
      continue;
    }

    const cueId = timeLineIndex > 0 ? lines.slice(0, timeLineIndex).join("\n") : undefined;
    const [startText, endAndSettings = ""] = lines[timeLineIndex]!.split(/\s*-->\s*/);
    const [endText = "", ...settingParts] = endAndSettings.trim().split(/\s+/);
    const startMs = parseSubtitleTimestampMs(startText);
    const endMs = parseSubtitleTimestampMs(endText);

    if (startMs === undefined || endMs === undefined || endMs < startMs) {
      continue;
    }

    const parsedText = parseTimelineSubtitleInlineText(lines.slice(timeLineIndex + 1).join("\n"));
    const cue: TimelineTextCue = {
      id: cueId,
      startMs,
      endMs,
      text: parsedText.text,
      alignment: parsedText.alignment,
      bold: parsedText.bold,
      italic: parsedText.italic,
      underline: parsedText.underline,
    };

    for (const setting of settingParts) {
      const [key, value] = setting.split(":");

      if (key === "align") {
        cue.alignment =
          value === "start" || value === "left"
            ? "bottom-left"
            : value === "end" || value === "right"
              ? "bottom-right"
              : "bottom-center";
      }

      if (key === "position") {
        cue.positionX = parsePercentage(value);
      }

      if (key === "line") {
        cue.positionY = parsePercentage(value);
      }
    }

    cues.push(cue);
  }

  return { format: "webvtt", cues };
}

export function parseTimelineAssText(input: string): TimelineTextParseResult {
  const lines = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  let section = "";
  let styleFormat: string[] = [];
  let eventFormat: string[] = [];
  let playResX: number | undefined;
  let playResY: number | undefined;
  const styles: TimelineTextStyle[] = [];
  const cues: TimelineTextCue[] = [];
  const warnings = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith(";")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);

    if (sectionMatch) {
      section = sectionMatch[1]!.toLowerCase();
      continue;
    }

    if (section === "script info") {
      const [key, value = ""] = splitAssKeyValue(line);

      if (key.toLowerCase() === "playresx") {
        playResX = parseFiniteNumber(value);
      }

      if (key.toLowerCase() === "playresy") {
        playResY = parseFiniteNumber(value);
      }
    }

    if (section.includes("styles")) {
      const [key, value = ""] = splitAssKeyValue(line);

      if (key.toLowerCase() === "format") {
        styleFormat = value.split(",").map(normalizeAssFieldName);
        continue;
      }

      if (key.toLowerCase() === "style" && styleFormat.length > 0) {
        const fields = mapAssFormattedFields(styleFormat, value);
        const name = fields.get("name");

        if (!name) {
          continue;
        }

        const alignment = parseAssAlignment(fields.get("alignment"));

        styles.push({
          name,
          fontFamily: emptyToUndefined(fields.get("fontname")),
          fontSize: parseFiniteNumber(fields.get("fontsize")),
          color: parseAssColor(fields.get("primarycolour")),
          backgroundColor: parseAssColor(fields.get("backcolour")),
          bold: parseAssBoolean(fields.get("bold")),
          italic: parseAssBoolean(fields.get("italic")),
          underline: parseAssBoolean(fields.get("underline")),
          alignment,
          marginLeft: parseFiniteNumber(fields.get("marginl")),
          marginRight: parseFiniteNumber(fields.get("marginr")),
          marginVertical: parseFiniteNumber(fields.get("marginv")),
        });
      }
    }

    if (section === "events") {
      const [key, value = ""] = splitAssKeyValue(line);
      const lowerKey = key.toLowerCase();

      if (lowerKey === "format") {
        eventFormat = value.split(",").map(normalizeAssFieldName);
        continue;
      }

      if (lowerKey === "comment") {
        continue;
      }

      if (lowerKey === "dialogue" && eventFormat.length > 0) {
        const fields = mapAssFormattedFields(eventFormat, value);
        const startMs = parseAssTimestampMs(fields.get("start"));
        const endMs = parseAssTimestampMs(fields.get("end"));
        const text = fields.get("text") ?? "";

        if (startMs === undefined || endMs === undefined || endMs < startMs) {
          continue;
        }

        const parsedText = parseAssCueText(text, { playResX, playResY, warnings });
        const styleName = emptyToUndefined(fields.get("style"));
        const style = styleName
          ? styles.find((candidate) => candidate.name.toLowerCase() === styleName.toLowerCase())
          : undefined;
        const overrideAlignment = parseAssAlignment(fields.get("alignment"));

        cues.push({
          startMs,
          endMs,
          text: parsedText.text,
          layer: parseFiniteNumber(fields.get("layer")),
          styleName,
          actor: emptyToUndefined(fields.get("name")),
          alignment: parsedText.alignment ?? overrideAlignment ?? style?.alignment,
          marginLeft: parseFiniteNumber(fields.get("marginl")) ?? style?.marginLeft,
          marginRight: parseFiniteNumber(fields.get("marginr")) ?? style?.marginRight,
          marginVertical: parseFiniteNumber(fields.get("marginv")) ?? style?.marginVertical,
          positionX: parsedText.positionX,
          positionY: parsedText.positionY,
          fontFamily: parsedText.fontFamily,
          fontSize: parsedText.fontSize,
          color: parsedText.color,
          bold: parsedText.bold,
          italic: parsedText.italic,
          underline: parsedText.underline,
          outlineColor: parsedText.outlineColor,
          shadowColor: parsedText.shadowColor,
        });
      }
    }
  }

  return {
    format: "ass",
    cues,
    styles: styles.length > 0 ? styles : undefined,
    warnings: warnings.size > 0 ? [...warnings] : undefined,
  };
}

export async function createTimelineTextFileAsset(
  file: File,
  options: TimelineTextFileAssetOptions = {},
): Promise<TimelineTextFileAssetResult> {
  const label = options.label ?? file.name;
  const text = await readTimelineTextFile(file);
  const parsed = parseTimelineText(text, {
    sourceLabel: label,
    mimeType: file.type || undefined,
  });
  const durationMs =
    options.durationMs ??
    parsed.cues.reduce((duration, cue) => Math.max(duration, cue.endMs), 0) ??
    1_000;

  return {
    asset: {
      id: options.id ?? createTimelineTextFileAssetId(label),
      label,
      kind: "subtitle",
      mediaType: "text",
      durationMs: Math.max(1, durationMs || 1_000),
      color: options.color,
      description: file.type || `${parsed.format.toUpperCase()} subtitles`,
      data: {
        mediaType: "text",
        format: parsed.format,
        language: options.language,
        cues: parsed.cues,
        styles: parsed.styles,
        source: {
          label,
          mimeType: file.type || undefined,
          metadata: {
            fileName: file.name,
            lastModified: file.lastModified,
            size: file.size,
            ...options.metadata,
          },
        },
      },
    },
    warnings: parsed.warnings,
  };
}

function splitSubtitleBlocks(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseSubtitleTimestampMs(input: string | undefined) {
  const match = input?.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?$/);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const milliseconds = Number((match[4] ?? "0").padEnd(3, "0"));

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds;
}

function parseAssTimestampMs(input: string | undefined) {
  const match = input?.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})(?:[.](\d{1,3}))?$/);

  if (!match) {
    return undefined;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const fraction = match[4] ?? "0";
  const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + milliseconds;
}

function parseTimelineSubtitleInlineText(input: string) {
  const alignmentTag = input.match(/\{\\an([1-9])\}/);
  const strippedAlignment = input.replace(/\{\\an[1-9]\}/g, "");
  const trimmed = strippedAlignment.trim();
  const fullItalic = /^<i\b[^>]*>[\s\S]*<\/i>$/i.test(trimmed);
  const fullBold = /^<b\b[^>]*>[\s\S]*<\/b>$/i.test(trimmed);
  const fullUnderline = /^<u\b[^>]*>[\s\S]*<\/u>$/i.test(trimmed);

  return {
    text: stripSubtitleHtmlTags(strippedAlignment),
    alignment: parseAssAlignment(alignmentTag?.[1]),
    bold: fullBold || undefined,
    italic: fullItalic || undefined,
    underline: fullUnderline || undefined,
  };
}

function stripSubtitleHtmlTags(input: string) {
  return input
    .replace(/<\/?(?:i|b|u|c|v|ruby|rt|lang)(?:\.[^>\s]+|\s+[^>]*)?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function splitAssKeyValue(input: string): [string, string] {
  const index = input.indexOf(":");

  return index < 0
    ? [input.trim(), ""]
    : [input.slice(0, index).trim(), input.slice(index + 1).trim()];
}

function normalizeAssFieldName(input: string) {
  return input.trim().toLowerCase().replaceAll(/\s+/g, "");
}

function mapAssFormattedFields(format: string[], value: string) {
  const parts = splitAssFields(value, format.length);
  const fields = new Map<string, string>();

  for (const [index, name] of format.entries()) {
    fields.set(name, parts[index]?.trim() ?? "");
  }

  return fields;
}

function splitAssFields(value: string, fieldCount: number) {
  if (fieldCount <= 1) {
    return [value];
  }

  const fields: string[] = [];
  let rest = value;

  for (let index = 0; index < fieldCount - 1; index += 1) {
    const commaIndex = rest.indexOf(",");

    if (commaIndex < 0) {
      fields.push(rest);
      rest = "";
      continue;
    }

    fields.push(rest.slice(0, commaIndex));
    rest = rest.slice(commaIndex + 1);
  }

  fields.push(rest);

  return fields;
}

function parseAssCueText(
  input: string,
  options: {
    playResX?: number;
    playResY?: number;
    warnings: Set<string>;
  },
): Partial<TimelineTextCue> & { text: string } {
  const cue: Partial<TimelineTextCue> & { text: string } = {
    text: input.replaceAll("\\N", "\n").replaceAll("\\n", "\n"),
  };

  cue.text = cue.text.replace(/\{([^}]*)\}/g, (_block, tags: string) => {
    for (const tag of tags.match(/\\[^\\]+/g) ?? []) {
      const alignment = tag.match(/^\\an([1-9])/);
      const position = tag.match(/^\\pos\(([-\d.]+)\s*,\s*([-\d.]+)\)/);
      const color = tag.match(/^\\(?:1?c)&?H?([0-9a-fA-F]+)&?/);
      const fontSize = tag.match(/^\\fs([-\d.]+)/);
      const fontFamily = tag.match(/^\\fn([^\\]+)/);
      const bold = tag.match(/^\\b(-?1|0)/);
      const italic = tag.match(/^\\i(-?1|0)/);
      const underline = tag.match(/^\\u(-?1|0)/);

      if (alignment) {
        cue.alignment = parseAssAlignment(alignment[1]);
      } else if (position) {
        const x = parseFiniteNumber(position[1]);
        const y = parseFiniteNumber(position[2]);

        cue.positionX =
          x !== undefined && options.playResX
            ? Math.max(0, Math.min(100, (x / options.playResX) * 100))
            : undefined;
        cue.positionY =
          y !== undefined && options.playResY
            ? Math.max(0, Math.min(100, (y / options.playResY) * 100))
            : undefined;
      } else if (color) {
        cue.color = parseAssColor(color[1]);
      } else if (fontSize) {
        cue.fontSize = parseFiniteNumber(fontSize[1]);
      } else if (fontFamily) {
        cue.fontFamily = fontFamily[1]?.trim();
      } else if (bold) {
        cue.bold = bold[1] !== "0";
      } else if (italic) {
        cue.italic = italic[1] !== "0";
      } else if (underline) {
        cue.underline = underline[1] !== "0";
      } else if (/^\\bord/.test(tag)) {
        cue.outlineColor = cue.outlineColor ?? "rgba(0, 0, 0, 0.85)";
      } else if (/^\\shad/.test(tag)) {
        cue.shadowColor = cue.shadowColor ?? "rgba(0, 0, 0, 0.85)";
      } else if (/^\\(?:k|K|kf|ko|t|clip|iclip|move|fad|fade|p)/.test(tag)) {
        options.warnings.add("Some ASS override tags are not rendered in the preview subset.");
      }
    }

    return "";
  });

  cue.text = cue.text.trim();

  return cue;
}

function parseAssAlignment(input: string | undefined): TimelineTextAlignment | undefined {
  switch (input?.trim()) {
    case "1":
      return "bottom-left";
    case "2":
      return "bottom-center";
    case "3":
      return "bottom-right";
    case "4":
      return "middle-left";
    case "5":
      return "middle-center";
    case "6":
      return "middle-right";
    case "7":
      return "top-left";
    case "8":
      return "top-center";
    case "9":
      return "top-right";
    default:
      return undefined;
  }
}

function parseAssColor(input: string | undefined) {
  if (!input) {
    return undefined;
  }

  const hex = input
    .trim()
    .replace(/^&?H/i, "")
    .replace(/&$/g, "")
    .replaceAll(/[^0-9a-fA-F]/g, "");

  if (!hex) {
    return undefined;
  }

  const padded = hex.length <= 6 ? hex.padStart(6, "0") : hex.padStart(8, "0").slice(-8);
  const alphaHex = padded.length === 8 ? padded.slice(0, 2) : undefined;
  const bgr = padded.length === 8 ? padded.slice(2) : padded;
  const blue = Number.parseInt(bgr.slice(0, 2), 16);
  const green = Number.parseInt(bgr.slice(2, 4), 16);
  const red = Number.parseInt(bgr.slice(4, 6), 16);

  if (![red, green, blue].every(Number.isFinite)) {
    return undefined;
  }

  if (!alphaHex) {
    return `#${toHexByte(red)}${toHexByte(green)}${toHexByte(blue)}`;
  }

  const assAlpha = Number.parseInt(alphaHex, 16);
  const alpha = Math.max(0, Math.min(1, 1 - assAlpha / 255));

  return `rgba(${red}, ${green}, ${blue}, ${roundCssAlpha(alpha)})`;
}

function parseAssBoolean(input: string | undefined) {
  if (input === undefined || input.trim() === "") {
    return undefined;
  }

  return input.trim() !== "0";
}

function parseFiniteNumber(input: string | undefined) {
  if (input === undefined || input.trim() === "") {
    return undefined;
  }

  const value = Number(input);

  return Number.isFinite(value) ? value : undefined;
}

function parsePercentage(input: string | undefined) {
  if (!input?.endsWith("%")) {
    return undefined;
  }

  return parseFiniteNumber(input.slice(0, -1));
}

function emptyToUndefined(input: string | undefined) {
  return input?.trim() ? input.trim() : undefined;
}

function toHexByte(value: number) {
  return value.toString(16).padStart(2, "0");
}

function roundCssAlpha(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function createTimelineTextFileAssetId(label: string) {
  const slug = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

  return slug ? `subtitle-${slug}` : "subtitle-file";
}

function readTimelineTextFile(file: File) {
  if (typeof file.text === "function") {
    return file.text();
  }

  if (typeof FileReader === "undefined") {
    return Promise.reject(new Error("FileReader is not available."));
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read subtitle file."));
    reader.readAsText(file);
  });
}
