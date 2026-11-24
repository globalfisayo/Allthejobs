// One active copy of the app per device. Two tabs (or the installed app and a browser tab)
// share one store; if both saved and synced they would overwrite each other and, before
// this, reload each other in a loop. The copy you last opened is active; any other one
// steps aside: it stops saving and syncing and offers "Use it here".
import { h, icon } from './ui.js';

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('touchmap-tabs') : null;
const me = Math.random().toString(36).slice(2) + Date.now().toString(36);
let passive = false;
let onPassive = () => {};

export const isPassive = () => passive;

function claim() { channel?.postMessage({ type: 'claim', id: me }); }

function stepAside() {
  if (passive) return;
  passive = true;
  onPassive();
  document.body.classList.add('tab-passive');
  const card = h('div', { class: 'tab-away', role: 'alertdialog', 'aria-label': 'Touch Map is open elsewhere' },
    h('div', { class: 'tab-away-card' },
      h('span', { class: 'tab-away-ico' }, icon('layers')),
      h('h2', { text: 'Touch Map is open in another tab' }),
      h('p', { class: 'muted', text: 'Only one copy on this device can log and sync at a time, so nothing is overwritten. Your touches are safe.' }),
      h('button', { type: 'button', class: 'btn primary big', onclick: () => location.reload() }, icon('check'), 'Use it here')));
  document.body.append(card);
}

/** Start: claim this copy, and step aside when another copy is opened or comes to the front. */
export function initTabs({ whenPassive } = {}) {
  if (whenPassive) onPassive = whenPassive;
  if (!channel) return;
  channel.onmessage = (e) => { if (e.data?.type === 'claim' && e.data.id !== me) stepAside(); };
  claim();
  // the copy in front is the one in use; bringing an active one back to the front re-claims
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !passive) claim(); });
  window.addEventListener('focus', () => { if (!passive) claim(); });
}
