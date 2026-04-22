const ROOT_PREFIX = 'openy-assets';

export type StorageModule = 'os' | 'docs';

export interface BuildStoragePathInput {
  module: StorageModule;
  section: string;
  filename: string;
  entityId?: string | null;
  entityType?: string | null;
  monthKey?: string | null;
  documentType?: string | null;
  subPath?: string | string[] | null;
}

function sanitizeSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .join('-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || `unknown-${Date.now().toString(36)}`;
}

function sanitizeFilename(value: string): string {
  const safe = sanitizeSegment(value);
  return safe.replace(/^\.+/, '') || `file-${Date.now()}`;
}

function normalizeSubPath(subPath?: string | string[] | null): string[] {
  if (!subPath) return [];
  const raw = Array.isArray(subPath) ? subPath : subPath.split('/');
  return raw.map(sanitizeSegment).filter(Boolean);
}

export function buildStoragePath(input: BuildStoragePathInput): string {
  const section = sanitizeSegment(input.section);
  const filename = sanitizeFilename(input.filename);

  const segments: string[] = [ROOT_PREFIX, input.module, section];

  if (input.module === 'os') {
    if (section === 'activity') {
      if (input.entityType) segments.push(sanitizeSegment(input.entityType));
      if (input.entityId) segments.push(sanitizeSegment(input.entityId));
    } else if (section === 'accounting') {
      if (input.monthKey) segments.push(sanitizeSegment(input.monthKey));
      else if (input.entityId) segments.push(sanitizeSegment(input.entityId));
    } else if (section === 'exports') {
      if (input.documentType) segments.push(sanitizeSegment(input.documentType));
      if (input.entityId) segments.push(sanitizeSegment(input.entityId));
    } else if (input.entityId) {
      segments.push(sanitizeSegment(input.entityId));
    }
  }

  if (input.module === 'docs') {
    if (section === 'exports') {
      if (input.documentType) segments.push(sanitizeSegment(input.documentType));
      if (input.entityId) segments.push(sanitizeSegment(input.entityId));
    } else if (section === 'accounting') {
      if (input.entityId) segments.push(sanitizeSegment(input.entityId));
    } else if (input.entityId) {
      segments.push(sanitizeSegment(input.entityId));
    }
  }

  segments.push(...normalizeSubPath(input.subPath));
  segments.push(filename);

  return segments.join('/');
}
