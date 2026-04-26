/** Detects canonical UUID strings so we never show them as a person's name. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_RE.test(value.trim());
}

/** Picks a display name for team UI; skips UUID-shaped garbage from bad imports or fallbacks. */
export function pickMemberDisplayName(options: {
  teamFullName?: string | null;
  profileFullName?: string | null;
  profileName?: string | null;
  profileEmail?: string | null;
  fallbackLabel?: string;
}): string {
  const candidates = [
    options.teamFullName?.trim(),
    options.profileFullName?.trim(),
    options.profileName?.trim(),
    options.profileEmail?.trim(),
  ].filter((s): s is string => Boolean(s));
  for (const c of candidates) {
    if (!looksLikeUuid(c)) return c;
  }
  const fb = options.fallbackLabel?.trim();
  if (fb && !looksLikeUuid(fb)) return fb;
  return 'Team member';
}
