// Team colours: planned/unplanned, physical/information, and optional colours per zone.
// Applied as CSS variables, so every chart, badge and button follows a change at once.

export const DEFAULT_COLORS = {
  planned: '#1E63B8', unplanned: '#F40009', physical: '#6250D6', information: '#159A6A', zones: {},
};

/** Swatches offered first: brand red, the validated chart hues, and neutrals. */
export const SWATCHES = ['#F40009', '#B3000B', '#1E63B8', '#0F8A9D', '#6250D6', '#159A6A', '#EB6834', '#EDA100', '#E87BA4', '#3A3A3A', '#8C8C8C', '#C8A27A'];

const HEX = /^#[0-9a-f]{6}$/i;
export const validHex = (v) => HEX.test(String(v || ''));

/** Text colour that reads on a fill: white on dark, near-black on light. */
export function textOn(hex) {
  if (!validHex(hex)) return '#fff';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.4 ? '#141414' : '#fff';
}

/** Merge saved colours over the defaults, ignoring anything that is not a #rrggbb colour. */
export function resolveColors(saved) {
  const c = { ...DEFAULT_COLORS, zones: {} };
  for (const k of ['planned', 'unplanned', 'physical', 'information']) if (validHex(saved?.[k])) c[k] = saved[k];
  for (const [z, v] of Object.entries(saved?.zones || {})) if (validHex(v)) c.zones[z] = v;
  return c;
}

let current = resolveColors(null);
export const colors = () => current;
export const zoneColour = (zone) => current.zones[zone] || null;

export function applyColors(saved) {
  current = resolveColors(saved);
  if (typeof document === 'undefined') return current;
  const st = document.documentElement.style;
  st.setProperty('--c-planned', current.planned);
  st.setProperty('--c-unplanned', current.unplanned);
  st.setProperty('--c-physical', current.physical);
  st.setProperty('--c-information', current.information);
  st.setProperty('--on-planned', textOn(current.planned));
  st.setProperty('--on-unplanned', textOn(current.unplanned));
  return current;
}
