/**
 * Shared asset utility helpers used by both the assets page and client detail page.
 */
import { buildStoragePath } from '@/lib/storage/path-builder';

/**
 * Convert an uppercase snake-case content type (e.g. "SOCIAL_POSTS") into a
 * human-readable title-case label (e.g. "Social Posts").
 */
export function contentTypeLabel(ct: string): string {
  return ct
    .replace(/_/g, ' ')
    .replace(/\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Convert a client display name to a normalized R2 path segment.
 * Uppercases and replaces whitespace with underscores.
 *
 * Must stay in sync with the path naming used in the upload route.
 */
export function clientToFolderName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, '_');
}

// ── New Asset Hierarchy ───────────────────────────────────────────────────────

/**
 * Main categories and their display labels.
 * Storage keys use the slug (e.g. "social-media").
 */
export const MAIN_CATEGORIES = [
  { slug: 'social-media', label: 'Social Media' },
  { slug: 'videos', label: 'Videos' },
  { slug: 'designs', label: 'Designs' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'other', label: 'Other' },
] as const;

export type MainCategorySlug = (typeof MAIN_CATEGORIES)[number]['slug'];

/**
 * Subcategories per main category.
 * Storage keys use the slug (e.g. "source-files").
 */
export const SUBCATEGORIES: Record<MainCategorySlug, { slug: string; label: string }[]> = {
  'social-media': [
    { slug: 'posts', label: 'Posts' },
    { slug: 'reels', label: 'Reels' },
    { slug: 'stories', label: 'Stories' },
    { slug: 'carousels', label: 'Carousels' },
    { slug: 'covers', label: 'Covers' },
  ],
  videos: [
    { slug: 'raw', label: 'Raw' },
    { slug: 'edited', label: 'Edited' },
    { slug: 'shorts', label: 'Shorts' },
    { slug: 'final', label: 'Final' },
  ],
  designs: [
    { slug: 'source-files', label: 'Source Files' },
    { slug: 'exported', label: 'Exported' },
    { slug: 'thumbnails', label: 'Thumbnails' },
    { slug: 'branding', label: 'Branding' },
  ],
  documents: [
    { slug: 'contracts', label: 'Contracts' },
    { slug: 'reports', label: 'Reports' },
    { slug: 'plans', label: 'Plans' },
    { slug: 'briefs', label: 'Briefs' },
  ],
  other: [],
};

/** Return the display label for a main category slug. */
export function mainCategoryLabel(slug: string): string {
  return MAIN_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

/** Return the display label for a subcategory slug. */
export function subCategoryLabel(mainSlug: string, subSlug: string): string {
  const subs = SUBCATEGORIES[mainSlug as MainCategorySlug] ?? [];
  return subs.find((s) => s.slug === subSlug)?.label ?? subSlug;
}

/** Convert a client display name to a URL-safe slug for storage paths. */
export function clientToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Build the canonical storage key for OS client files:
 *   openy-assets/os/client-files/{clientSlug}/{mainCategory}/{year}/{month}/{subCategory}/{timestamp}-{filename}
 *
 * Example:
 *   openy-assets/os/client-files/pro-icon/social-media/2026/04/posts/1712345678-logo.jpg
 */
export function buildStorageKey(params: {
  clientName: string;
  clientId?: string | null;
  mainCategory: string;
  subCategory: string;
  monthKey: string; // "YYYY-MM"
  fileName: string;
  timestamp?: number;
}): string {
  const { clientName, clientId, mainCategory, subCategory, monthKey, fileName, timestamp } = params;
  const ts = timestamp ?? Date.now();
  const safeFileName = `${ts}-${fileName}`;
  const clientSlug = clientToSlug(clientName);
  const [year, month] = /^\d{4}-\d{2}$/.test(monthKey)
    ? monthKey.split('-')
    : [new Date().getUTCFullYear().toString(), '01'];

  return buildStoragePath({
    module: 'os',
    section: 'client-files',
    entityId: clientId || null,
    monthKey,
    subPath: [clientSlug, mainCategory, year, month, subCategory || 'general'],
    filename: safeFileName,
  });
}
