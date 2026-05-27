import { getTimelineEditorDurationMs, getTimelineEditorItemEndMs } from "./time";
import {
  isTimelineEditorTransformEasing,
  timelineEditorTransformEasings,
  type TimelineEditorDocument,
  type TimelineEditorValidationIssue,
} from "./types";

export function validateTimelineEditorDocument(document: TimelineEditorDocument) {
  const issues: TimelineEditorValidationIssue[] = [];
  const trackIds = new Set<string>();
  const itemIds = new Set<string>();
  const groupIds = new Set<string>();
  const itemGroupIds = new Set<string>();
  const itemGroupRefs = new Map<string, Set<string>>();
  const markerIds = new Set<string>();
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 1);

  if (document.durationMs !== undefined) {
    if (!Number.isFinite(document.durationMs) || document.durationMs <= 0) {
      issues.push(error("durationMs", "invalid_duration", "Document duration must be > 0."));
    }
  }

  if (document.currentTimeMs !== undefined) {
    if (!Number.isFinite(document.currentTimeMs) || document.currentTimeMs < 0) {
      issues.push(error("currentTimeMs", "invalid_current_time", "Current time must be >= 0."));
    } else if (document.durationMs !== undefined && document.currentTimeMs > document.durationMs) {
      issues.push(
        warning(
          "currentTimeMs",
          "current_time_exceeds_duration",
          "Current time exceeds document duration.",
        ),
      );
    }
  }

  document.tracks.forEach((track, trackIndex) => {
    const trackPath = `tracks[${trackIndex}]`;

    if (!track.id) {
      issues.push(error(`${trackPath}.id`, "missing_track_id", "Track id is required."));
    } else if (trackIds.has(track.id)) {
      issues.push(
        error(`${trackPath}.id`, "duplicate_track_id", `Track id "${track.id}" repeats.`),
      );
    }

    trackIds.add(track.id);

    if (track.height !== undefined && (!Number.isFinite(track.height) || track.height <= 0)) {
      issues.push(
        error(`${trackPath}.height`, "invalid_track_height", "Track height must be > 0."),
      );
    }

    track.items.forEach((item, itemIndex) => {
      const itemPath = `${trackPath}.items[${itemIndex}]`;

      if (!item.id) {
        issues.push(error(`${itemPath}.id`, "missing_item_id", "Item id is required."));
      } else if (itemIds.has(item.id)) {
        issues.push(error(`${itemPath}.id`, "duplicate_item_id", `Item id "${item.id}" repeats.`));
      }

      itemIds.add(item.id);

      if (item.trackId !== track.id) {
        issues.push(
          error(
            `${itemPath}.trackId`,
            "mismatched_track_id",
            `Item references "${item.trackId}" but is inside "${track.id}".`,
          ),
        );
      }

      if (!Number.isFinite(item.startMs) || item.startMs < 0) {
        issues.push(error(`${itemPath}.startMs`, "invalid_start", "Item start must be >= 0."));
      }

      if (!Number.isFinite(item.durationMs) || item.durationMs <= 0) {
        issues.push(
          error(`${itemPath}.durationMs`, "invalid_duration", "Item duration must be > 0."),
        );
      }

      if (getTimelineEditorItemEndMs(item) > durationMs) {
        issues.push(
          warning(`${itemPath}`, "item_exceeds_duration", "Item extends beyond document duration."),
        );
      }

      const transformPointOffsets = new Set<number>();

      item.transform?.points.forEach((point, pointIndex) => {
        const pointPath = `${itemPath}.transform.points[${pointIndex}]`;

        if (!Number.isFinite(point.offsetMs) || point.offsetMs < 0) {
          issues.push(
            error(
              `${pointPath}.offsetMs`,
              "invalid_transform_offset",
              "Transform point offset must be >= 0.",
            ),
          );
        } else if (point.offsetMs > item.durationMs) {
          issues.push(
            warning(
              `${pointPath}.offsetMs`,
              "transform_offset_exceeds_duration",
              "Transform point is outside the item duration.",
            ),
          );
        }

        if (Number.isFinite(point.offsetMs)) {
          if (transformPointOffsets.has(point.offsetMs)) {
            issues.push(
              warning(
                `${pointPath}.offsetMs`,
                "duplicate_transform_offset",
                `Transform offset ${point.offsetMs} repeats.`,
              ),
            );
          }

          transformPointOffsets.add(point.offsetMs);
        }

        if (point.easing !== undefined && !isTimelineEditorTransformEasing(point.easing)) {
          issues.push(
            error(
              `${pointPath}.easing`,
              "invalid_transform_easing",
              `Transform easing must be one of: ${timelineEditorTransformEasings.join(", ")}.`,
            ),
          );
        }

        for (const [key, value] of Object.entries(point.values)) {
          if (!Number.isFinite(value)) {
            issues.push(
              error(
                `${pointPath}.values.${key}`,
                "invalid_transform_value",
                "Transform values must be finite numbers.",
              ),
            );
          }
        }
      });

      if (item.itemGroupId) {
        itemGroupRefs.set(item.itemGroupId, itemGroupRefs.get(item.itemGroupId) ?? new Set());
        itemGroupRefs.get(item.itemGroupId)?.add(item.id);
      }
    });
  });

  document.groups?.forEach((group, groupIndex) => {
    const groupPath = `groups[${groupIndex}]`;
    const seenTrackIds = new Set<string>();

    if (!group.id) {
      issues.push(error(`${groupPath}.id`, "missing_group_id", "Group id is required."));
    } else if (groupIds.has(group.id)) {
      issues.push(
        error(`${groupPath}.id`, "duplicate_group_id", `Group id "${group.id}" repeats.`),
      );
    }

    groupIds.add(group.id);

    group.trackIds.forEach((trackId, trackIdIndex) => {
      if (seenTrackIds.has(trackId)) {
        issues.push(
          warning(
            `${groupPath}.trackIds[${trackIdIndex}]`,
            "duplicate_group_track",
            `Track "${trackId}" repeats in group "${group.id}".`,
          ),
        );
      }

      seenTrackIds.add(trackId);

      if (!trackIds.has(trackId)) {
        issues.push(
          error(
            `${groupPath}.trackIds[${trackIdIndex}]`,
            "unknown_group_track",
            `Group references unknown track "${trackId}".`,
          ),
        );
      }
    });
  });

  document.itemGroups?.forEach((group, groupIndex) => {
    const groupPath = `itemGroups[${groupIndex}]`;
    const seenItemIds = new Set<string>();

    if (!group.id) {
      issues.push(error(`${groupPath}.id`, "missing_item_group_id", "Item group id is required."));
    } else if (itemGroupIds.has(group.id)) {
      issues.push(
        error(`${groupPath}.id`, "duplicate_item_group_id", `Item group id "${group.id}" repeats.`),
      );
    }

    itemGroupIds.add(group.id);

    group.itemIds.forEach((itemId, itemIdIndex) => {
      if (seenItemIds.has(itemId)) {
        issues.push(
          warning(
            `${groupPath}.itemIds[${itemIdIndex}]`,
            "duplicate_item_group_item",
            `Item "${itemId}" repeats in item group "${group.id}".`,
          ),
        );
      }

      seenItemIds.add(itemId);

      if (!itemIds.has(itemId)) {
        issues.push(
          error(
            `${groupPath}.itemIds[${itemIdIndex}]`,
            "unknown_item_group_item",
            `Item group references unknown item "${itemId}".`,
          ),
        );
        return;
      }

      if (!itemGroupRefs.get(group.id)?.has(itemId)) {
        issues.push(
          error(
            `${groupPath}.itemIds[${itemIdIndex}]`,
            "mismatched_item_group",
            `Item "${itemId}" does not reference item group "${group.id}".`,
          ),
        );
      }
    });
  });

  itemGroupRefs.forEach((referencedItemIds, itemGroupId) => {
    if (!itemGroupIds.has(itemGroupId)) {
      issues.push(
        error(
          "itemGroups",
          "missing_item_group",
          `Items reference missing item group "${itemGroupId}".`,
        ),
      );
    }

    if (referencedItemIds.size < 2) {
      issues.push(
        warning(
          "itemGroups",
          "singleton_item_group",
          `Item group "${itemGroupId}" should contain at least two items.`,
        ),
      );
    }
  });

  document.markers?.forEach((marker, markerIndex) => {
    const markerPath = `markers[${markerIndex}]`;

    if (!marker.id) {
      issues.push(error(`${markerPath}.id`, "missing_marker_id", "Marker id is required."));
    } else if (markerIds.has(marker.id)) {
      issues.push(
        error(`${markerPath}.id`, "duplicate_marker_id", `Marker id "${marker.id}" repeats.`),
      );
    }

    markerIds.add(marker.id);

    if (!Number.isFinite(marker.timeMs) || marker.timeMs < 0) {
      issues.push(
        error(`${markerPath}.timeMs`, "invalid_marker_time", "Marker time must be >= 0."),
      );
    } else if (document.durationMs !== undefined && marker.timeMs > document.durationMs) {
      issues.push(
        warning(
          `${markerPath}.timeMs`,
          "marker_exceeds_duration",
          "Marker time exceeds document duration.",
        ),
      );
    }
  });

  return issues;
}

export function getTimelineEditorValidationErrors(document: TimelineEditorDocument) {
  return validateTimelineEditorDocument(document).filter((issue) => issue.severity === "error");
}

export function getTimelineEditorValidationIssueTarget(
  issue: TimelineEditorValidationIssue,
):
  | { type: "document" }
  | { type: "track"; index: number }
  | { type: "item"; trackIndex: number; itemIndex: number }
  | { type: "marker"; index: number }
  | { type: "track-group"; index: number }
  | { type: "item-group"; index: number } {
  const markerMatch = issue.path.match(/^markers\[(\d+)\]/);

  if (markerMatch?.[1]) {
    return { type: "marker", index: Number(markerMatch[1]) };
  }

  const itemMatch = issue.path.match(/^tracks\[(\d+)\]\.items\[(\d+)\]/);

  if (itemMatch?.[1] && itemMatch[2]) {
    return {
      type: "item",
      trackIndex: Number(itemMatch[1]),
      itemIndex: Number(itemMatch[2]),
    };
  }

  const trackMatch = issue.path.match(/^tracks\[(\d+)\]/);

  if (trackMatch?.[1]) {
    return { type: "track", index: Number(trackMatch[1]) };
  }

  const trackGroupMatch = issue.path.match(/^groups\[(\d+)\]/);

  if (trackGroupMatch?.[1]) {
    return { type: "track-group", index: Number(trackGroupMatch[1]) };
  }

  const itemGroupMatch = issue.path.match(/^itemGroups\[(\d+)\]/);

  if (itemGroupMatch?.[1]) {
    return { type: "item-group", index: Number(itemGroupMatch[1]) };
  }

  return { type: "document" };
}

function error(path: string, code: string, message: string): TimelineEditorValidationIssue {
  return { path, code, message, severity: "error" };
}

function warning(path: string, code: string, message: string): TimelineEditorValidationIssue {
  return { path, code, message, severity: "warning" };
}
