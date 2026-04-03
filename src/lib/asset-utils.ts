/**
 * Shared asset utility helpers used by both the assets page and client detail page.
 */

/**
 * Convert an uppercase snake-case content type (e.g. "SOCIAL_POSTS") into a
 * human-readable title-case label (e.g. "Social Posts").
 */
export function contentTypeLabel(ct: string): string {
  return ct
    .replace(/_/g, ' ')
    .replace(/\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
