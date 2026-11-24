// Which icon goes with each zone, person, category, planned/unplanned and touch type.
// Defaults for the K3 template; a category or zone can carry its own (chosen in Setup), and
// anything added later gets a suggestion from its name, from the Lucide set in icons-lib.js.
import { CAT_BY_CODE } from './framework.js';
import { state } from './store.js';

export const ZONE_ICONS = {
  'Line-side store': 'warehouse', 'Preform feed': 'test-tube', 'Blow moulder': 'wind', Labeller: 'tag', Filler: 'droplet',
  Capper: 'circle-dot', 'Mixer / carbo': 'beaker', 'CIP / utilities': 'spray-can', Coder: 'printer', 'Inspection / rejects': 'scan-eye',
  Conveyors: 'briefcase-conveyor-belt', 'Packer / shrink': 'package', Palletiser: 'boxes', 'Control room / office': 'monitor', Other: 'map-pin',
};
export const CATEGORY_ICONS = {
  P1: 'replace', P2: 'droplets', P3: 'sliders-horizontal', P4: 'clipboard-check', P5: 'hard-hat', P6: 'wrench', P7: 'package-plus', P8: 'notebook-pen',
  U1: 'triangle-exclamation-point', U2: 'octagon-pause', U3: 'package-x', U4: 'package-search', U5: 'shield-exclamation-point', U6: 'plug-zap', U7: 'bug',
};
export const PLANNED_ICONS = { Planned: 'calendar-check', Unplanned: 'siren' };
export const TOUCH_TYPE_ICONS = { Physical: 'hand', Information: 'file-text' };
const PEOPLE_ICONS = { 'Shift leader': 'user-check', Mechanic: 'wrench', Electrician: 'zap', 'Quality / lab': 'flask-conical', 'Warehouse / forklift': 'forklift', Other: 'users' };

// Words in a name → the icon that fits; first match wins.
const HINTS = [
  [/robot|automat/i, 'robot-arm'], [/clean|cip|wash|sanit|hygien/i, 'spray-can'], [/change ?over|format|swap/i, 'replace'],
  [/setting|adjust|set-?point|recipe/i, 'sliders-horizontal'], [/quality|sample|test|lab|check/i, 'clipboard-check'], [/safety|bos|ppe|loto|permit/i, 'hard-hat'],
  [/mainten|repair|fix|mechanic|cil|lubric/i, 'wrench'], [/electric|power|energy/i, 'zap'], [/air|utility|utilities|steam|gas|co2/i, 'plug-zap'],
  [/water|liquid|syrup|fill/i, 'droplets'], [/material|replen|supply|stock|store/i, 'package-plus'], [/pallet|stack/i, 'boxes'], [/pack|shrink|carton|case/i, 'package'],
  [/label|sleeve/i, 'tag'], [/code|print|mark/i, 'printer'], [/inspect|vision|camera|reject|scan/i, 'scan-eye'], [/report|admin|record|book|data|sap|mes|excel/i, 'file-text'],
  [/meeting|call|talk|handover|communic/i, 'message-square'], [/train|learn|skill/i, 'graduation-cap'], [/walk|travel|search|fetch/i, 'footprints'],
  [/breakdown|failure|fault|alarm/i, 'triangle-exclamation-point'], [/stop|jam|micro|pause|block/i, 'octagon-pause'], [/defect|scrap|waste/i, 'package-x'],
  [/deviation|oos|hold|foreign/i, 'shield-exclamation-point'], [/convey|belt|transport|transfer/i, 'briefcase-conveyor-belt'], [/forklift|warehouse|logistic/i, 'forklift'],
  [/office|control|desk|pc|screen|hmi/i, 'monitor'], [/blow|oven|heat/i, 'flame'], [/cap|closure/i, 'circle-dot'], [/mix|blend|carbo|brix/i, 'beaker'],
  [/preform|bottle|pet/i, 'test-tube'], [/cool|chill|cold/i, 'snowflake'], [/leader|manager|supervis/i, 'user-check'], [/operator|op \d/i, 'user'],
];
/** An icon suggested from a name; `fallback` when nothing matches. */
export function recommendIcon(name, fallback = 'circle-dot') {
  for (const [re, ico] of HINTS) if (re.test(String(name || ''))) return ico;
  return fallback;
}

export const zoneIcon = (zone) => (zone ? state.icons?.zones?.[zone] || ZONE_ICONS[zone] || recommendIcon(zone, 'map-pin') : 'map-pin');
export const personIcon = (who) => (!who ? 'user' : PEOPLE_ICONS[who] || (/^Op \d+$/.test(who) ? 'user' : recommendIcon(who, 'user')));
export function categoryIcon(code) {
  const c = CAT_BY_CODE[code];
  if (!c) return 'circle-question-mark';
  return c.icon || CATEGORY_ICONS[code] || recommendIcon(c.short || c.name, c.planned ? 'calendar-check' : 'circle-exclamation-point');
}
export const plannedIcon = (v) => PLANNED_ICONS[v] || 'circle-question-mark';
export const touchTypeIcon = (v) => TOUCH_TYPE_ICONS[v] || 'circle-question-mark';
