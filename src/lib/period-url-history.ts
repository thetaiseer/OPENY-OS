/**
 * Shallow history update when the user explicitly changes the app date range.
 * Does not run on initial load — avoids polluting `/` and other entry URLs.
 */
export function replaceHistoryWithPeriod(from: string, to: string): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('from') === from && url.searchParams.get('to') === to) return;
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  const href = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', href);
}
