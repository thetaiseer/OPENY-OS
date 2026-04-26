/** Black artwork — light UI backgrounds and print/PDF (white page). */
export const OPENY_LOGO_LIGHT_FILE = 'openy-marketing-agency-black.png';
/** White artwork — dark UI backgrounds. */
export const OPENY_LOGO_DARK_FILE = 'openy-marketing-agency-white.png';

const BRANDING_DIR = '/branding';

/** Same-origin paths served from `/public/branding` (see `OpenyLogo`, exports). */
export const OPENY_LOGO_LIGHT_URL = `${BRANDING_DIR}/${OPENY_LOGO_LIGHT_FILE}`;
export const OPENY_LOGO_DARK_URL = `${BRANDING_DIR}/${OPENY_LOGO_DARK_FILE}`;

/** Source assets are 1024×194; use with `height` to keep aspect in layouts. */
export const OPENY_MARKETING_LOGO_RATIO = 1024 / 194;

export function openyMarketingLogoDimensions(heightPx: number): { width: number; height: number } {
  return {
    width: Math.round(heightPx * OPENY_MARKETING_LOGO_RATIO),
    height: Math.round(heightPx),
  };
}

export const OPENY_DOC_BLACK = '#111';

export const OPENY_DOC_STYLE = {
  text: '#0f172a',
  textMuted: '#64748b',
  title: '#020617',
  border: '#dbe0e6',
  borderStrong: '#c6ced8',
  background: '#ffffff',
  surface: '#f8fafc',
  headerBg: '#0b0f19',
  headerText: '#ffffff',
  rowAlt: '#f8fafc',
  alert: '#b91c1c',
};
