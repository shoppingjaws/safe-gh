import type { AiMarkerConfig } from "./types.ts";

// Invisible marker using Zero Width characters
// ZWSP (U+200B) + ZWNJ (U+200C) pattern
const INVISIBLE_MARKER = "\u200B\u200C\u200B\u200C\u200B";

/**
 * Add AI marker to comment body
 * Adds visible prefix (🤖) at the start and invisible marker at the end
 */
export function addAiMarker(body: string, config: AiMarkerConfig): string {
  if (!config.enabled) {
    return body;
  }

  const visiblePrefix = config.visiblePrefix || "";
  return `${visiblePrefix}${body}${INVISIBLE_MARKER}`;
}

/**
 * Check if comment body contains AI marker
 */
export function hasAiMarker(body: string): boolean {
  return body.includes(INVISIBLE_MARKER);
}

/**
 * Remove AI marker from comment body (for editing)
 * Removes both visible prefix and invisible marker
 */
export function removeAiMarker(body: string, config: AiMarkerConfig): string {
  let result = body;

  // Remove invisible marker
  result = result.replace(INVISIBLE_MARKER, "");

  // Remove visible prefix if present
  if (config.visiblePrefix && result.startsWith(config.visiblePrefix)) {
    result = result.slice(config.visiblePrefix.length);
  }

  return result;
}

/**
 * Validate that a comment can be edited/deleted by AI
 * Returns true only if the comment has AI marker
 */
export function canEditAiComment(body: string): {
  allowed: boolean;
  reason: string;
} {
  if (hasAiMarker(body)) {
    return {
      allowed: true,
      reason: "Comment has AI marker",
    };
  }

  return {
    allowed: false,
    reason: "Cannot edit/delete non-AI comment: missing AI marker",
  };
}

/**
 * Get the invisible marker string (for testing purposes)
 */
export function getInvisibleMarker(): string {
  return INVISIBLE_MARKER;
}
