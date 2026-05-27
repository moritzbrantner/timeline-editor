export type TimelineMediaSourceRef = {
  id?: string;
  uri?: string;
  label?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export type TimelineMediaDisplayRange = {
  sourceStartMs?: number;
  sourceEndMs?: number;
};

export type TimelineMediaSize = {
  width?: number;
  height?: number;
};

export type TimelineMediaFit = "contain" | "cover" | "fill" | "none";
