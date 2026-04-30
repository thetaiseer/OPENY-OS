/** Black artwork — light UI backgrounds and print/PDF (white page). */
export const OPENY_LOGO_LIGHT_URL = 'https://i.postimg.cc/ZRjtKs2G/OPENY.png';

/** White artwork — dark UI backgrounds. */
export const OPENY_LOGO_DARK_URL = 'https://i.postimg.cc/3N1gZhb8/White-OPENY-Logo.png';

/** Source assets are 1024×194; use with `height` to keep aspect in layouts. */
export const OPENY_MARKETING_LOGO_RATIO = 1024 / 194;

export function openyMarketingLogoDimensions(heightPx: number): { width: number; height: number } {
  return {
    width: Math.round(heightPx * OPENY_MARKETING_LOGO_RATIO),
    height: Math.round(heightPx),
  };
}

/** ~30% smaller on-screen logo in app shell / auth; remote PNG URLs unchanged. */
export const OPENY_APP_LOGO_UI_SCALE = 0.7;

/** Use in sidebar, topbar, login, invite — not in document preview or export HTML. */
export function openyAppChromeLogoDimensions(heightPx: number): { width: number; height: number } {
  return openyMarketingLogoDimensions(Math.round(heightPx * OPENY_APP_LOGO_UI_SCALE));
}

export const OPENY_DOC_BLACK = '#111';

export const OPENY_DOC_STYLE = {
  text: 'var(--surface)',
  textMuted: 'var(--text-secondary)',
  title: '#020617',
  border: '#dbe0e6',
  borderStrong: '#c6ced8',
  background: 'var(--accent-foreground)',
  surface: '#f8fafc',
  headerBg: '#0b0f19',
  headerText: 'var(--accent-foreground)',
  rowAlt: '#f8fafc',
  alert: 'var(--text-primary)',
};
