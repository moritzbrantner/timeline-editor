import { getTimelineEditorDurationMs, getTimelineEditorItemEndMs } from "./time";
import { type TimelineEditorDocument, type TimelineEditorValidationIssue } from "./types";

export function validateTimelineEditorDocument(document: TimelineEditorDocument) {
  const issues: TimelineEditorValidationIssue[] = [];
  const trackIds = new Set<string>();
  const itemIds = new Set<string>();
  const groupIds = new Set<string>();
  const itemGroupIds = new Set<string>();
  const itemGroupRefs = new Map<string, Set<string>>();
  const markerIds = new Set<string>();
  const durationMs = document.durationMs ?? getTimelineEditorDurationMs(document.tracks, 1);

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

      if (item.itemGroupId) {
        itemGroupRefs.set(item.itemGroupId, itemGroupRefs.get(item.itemGroupId) ?? new Set());
        itemGroupRefs.get(item.itemGroupId)?.add(item.id);
      }
    });
  });

  document.groups?.forEach((group, groupIndex) => {
    const groupPath = `groups[${groupIndex}]`;

    if (!group.id) {
      issues.push(error(`${groupPath}.id`, "missing_group_id", "Group id is required."));
    } else if (groupIds.has(group.id)) {
      issues.push(
        error(`${groupPath}.id`, "duplicate_group_id", `Group id "${group.id}" repeats.`),
      );
    }

    groupIds.add(group.id);

    group.trackIds.forEach((trackId, trackIdIndex) => {
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

    if (!group.id) {
      issues.push(error(`${groupPath}.id`, "missing_item_group_id", "Item group id is required."));
    } else if (itemGroupIds.has(group.id)) {
      issues.push(
        error(`${groupPath}.id`, "duplicate_item_group_id", `Item group id "${group.id}" repeats.`),
      );
    }

    itemGroupIds.add(group.id);

    group.itemIds.forEach((itemId, itemIdIndex) => {
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
    }
  });

  return issues;
}

export function getTimelineEditorValidationErrors(document: TimelineEditorDocument) {
  return validateTimelineEditorDocument(document).filter((issue) => issue.severity === "error");
}

function error(path: string, code: string, message: string): TimelineEditorValidationIssue {
  return { path, code, message, severity: "error" };
}

function warning(path: string, code: string, message: string): TimelineEditorValidationIssue {
  return { path, code, message, severity: "warning" };
}
