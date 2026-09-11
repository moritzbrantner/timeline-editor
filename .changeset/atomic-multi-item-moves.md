---
"@moritzbrantner/timeline-editor": patch
---

Make multi-item timeline moves atomic so snapping, timeline-boundary clamping, and track movement preserve the selection's relative layout and fail as a unit when any target track is invalid.
