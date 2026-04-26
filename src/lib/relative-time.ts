/** Locale-aware relative time (e.g. "2 minutes ago" / "منذ دقيقتين"). */
export function formatRelativeTime(iso: string, lang: 'en' | 'ar'): string {
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const seconds = Math.floor(diffMs / 1000);
    const locale = lang === 'ar' ? 'ar' : 'en';
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (seconds < 60) return rtf.format(-seconds, 'second');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return rtf.format(-hours, 'hour');
    const days = Math.floor(hours / 24);
    if (days < 8) return rtf.format(-days, 'day');
    return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
