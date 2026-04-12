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

/**
 * Convert a client display name to a normalized Drive folder name.
 * Uppercases and replaces whitespace with underscores.
 *
 * Must stay in sync with the folder naming used in the upload route.
 */
export function clientToFolderName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '_');
}
