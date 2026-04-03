/**
 * Shared utility functions safe to import from both client and server code.
 */

/**
 * Convert a client display name to a normalized Drive folder name.
 * Uppercases and replaces whitespace with underscores.
 *
 * Must stay in sync with `toClientFolderName` in src/lib/google-drive.ts.
 */
export function clientToFolderName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '_');
}
