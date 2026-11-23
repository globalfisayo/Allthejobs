// The Team sync card on the Run tab, the status pill in the app bar, and the join-link flow.
import { state } from './store.js';
import { status, connect, disconnect, syncNow, joinLink, validSyncUrl, onSync } from './sync.js';
import { h, clear, icon, toast, openModal, closeModal, fmt } from './ui.js';

const SCRIPT_URL = 'sync/apps-script.gs';
const SCRIPT_ON_GITHUB = 'https://github.com/globalfisayo/Allthejobs/blob/main/touchmap/sync/apps-script.gs';

async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); return true; }
  catch { return false; }
}

async function copyScript() {
  try {
    const text = await (await fetch(SCRIPT_URL, { cache: 'no-store' })).text();
    if (!(await copyText(text, 'Script copied. Paste it into Apps Script.'))) window.open(SCRIPT_URL, '_blank');
  } catch { window.open(SCRIPT_ON_GITHUB, '_blank'); }
}

async function shareJoin() {
  const url = joinLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'Join the Touch Map team log', text: 'Open this on your phone or tablet to share one touch log with the team.', url }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  if (!(await copyText(url, 'Join link copied. Send it to the other devices.'))) {
    openModal(h('div', { class: 'confirm' }, h('h2', { text: 'Join link' }), h('p', { class: 'muted', text: 'Copy this and open it on each device.' }),
      h('textarea', { class: 'desc', rows: '4', readonly: true, text: url }),
      h('div', { class: 'row-end' }, h('button', { type: 'button', class: 'btn primary', onclick: () => closeModal() }, 'Done'))), { label: 'Join link' });
  }
}

function shortUrl(u) {
  const m = String(u).match(/macros\/s\/([A-Za-z0-9_-]{6})[A-Za-z0-9_-]*([A-Za-z0-9_-]{4})\/exec/);
  return m ? `script.google.com/…/${m[1]}…${m[2]}/exec` : u;
}

export function syncCard() {
  const card = h('section', { class: 'card sync-card', id: 'team-sync' });

  function paint() {
    const st = status();
    const s = state.sync;
    if (!s.url) {
      const urlIn = h('input', { type: 'url', id: 'sync-url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', spellcheck: 'false' });
      const keyIn = h('input', { type: 'text', id: 'sync-key', placeholder: 'only if set in the script', autocomplete: 'off', spellcheck: 'false' });
      const go = h('button', { type: 'button', class: 'btn primary' }, icon('check'), 'Connect');
      go.addEventListener('click', async () => {
        if (!validSyncUrl(urlIn.value)) { toast('Paste the Web app URL from Apps Script. It ends in /exec.', { tone: 'bad' }); return; }
        go.disabled = true; go.textContent = 'Connecting…';
        try { await connect(urlIn.value, keyIn.value); toast('Connected. This device now shares the team log.'); }
        catch (e) { toast(e.message, { tone: 'bad', timeout: 8000 }); }
        paint();
      });
      clear(card,
        h('div', { class: 'sync-head' }, h('h2', { class: 'card-h', text: 'Team sync' }), h('span', { class: 'pill off', text: 'Off' })),
        h('p', {}, 'Share one live log across every phone and tablet. Touches go to a Google Sheet your team owns, and the sheet itself becomes a live Observation Log. Logging still works offline: changes wait on the device and go up when the signal is back.'),
        h('details', { class: 'steps' },
          h('summary', { text: 'Set it up once for the team (about 5 minutes, easiest on a computer)' }),
          h('ol', {},
            h('li', {}, 'Create a Google Sheet, e.g. “K3 Touch Map · team log” (', h('a', { href: 'https://sheets.new', target: '_blank', rel: 'noopener' }, 'sheets.new'), ').'),
            h('li', {}, 'In the sheet: ', h('strong', { text: 'Extensions → Apps Script' }), '. Delete what is there and paste the Touch Map sync script. Save.',
              h('div', { class: 'row-gap', style: { marginTop: '8px' } },
                h('button', { type: 'button', class: 'btn ghost small', onclick: copyScript }, icon('copy'), 'Copy the script'),
                h('a', { class: 'btn ghost small', href: SCRIPT_ON_GITHUB, target: '_blank', rel: 'noopener' }, 'View it on GitHub'))),
            h('li', {}, h('strong', { text: 'Deploy → New deployment → Web app' }), '. Execute as: ', h('strong', { text: 'Me' }), '. Who has access: ', h('strong', { text: 'Anyone' }), '. Deploy, allow the permissions, and copy the Web app URL.'),
            h('li', {}, 'Paste the URL below and press Connect. Then use ', h('strong', { text: 'Share join link' }), ' to connect every other device in one tap.'))),
        h('div', { class: 'f-grid' },
          h('label', { class: 'f', for: 'sync-url' }, h('span', { class: 'f-label', text: 'Web app URL' }), urlIn),
          h('label', { class: 'f', for: 'sync-key' }, h('span', { class: 'f-label', text: 'Team key (optional)' }), keyIn)),
        h('div', { class: 'row-gap' }, go),
        h('p', { class: 'muted small', text: 'Anyone with the URL can read and add touches, like a shared link to a document. Share it only with the team.' }));
      return;
    }
    clear(card,
      h('div', { class: 'sync-head' }, h('h2', { class: 'card-h', text: 'Team sync' }), h('span', { class: 'pill ' + st.kind, text: st.label })),
      h('p', { class: 'muted' }, `Connected to ${shortUrl(s.url)}. Last synced ${fmt.ago(s.lastOk)}. New touches from other devices arrive within about 30 seconds while the app is open.`),
      st.kind === 'error' ? h('p', { class: 'warn-line' }, icon('warn'), st.error) : null,
      h('div', { class: 'row-gap' },
        h('button', { type: 'button', class: 'btn primary', onclick: async () => { const ok = await syncNow(); toast(ok ? 'Synced.' : (state.sync.error === 'offline' ? 'Offline: changes are kept and will go up later.' : state.sync.error), { tone: ok ? '' : 'bad' }); } }, icon('reset'), 'Sync now'),
        h('button', { type: 'button', class: 'btn ghost', onclick: shareJoin }, icon('share'), 'Share join link'),
        h('button', { type: 'button', class: 'btn danger-ghost', onclick: () => { disconnect(); toast('Disconnected. Touches stay on this device.'); } }, 'Disconnect')),
      h('p', { class: 'muted small', text: 'Disconnecting keeps everything on this device and in the sheet; it only stops sharing.' }));
  }

  onSync(() => { if (card.isConnected) paint(); });
  paint();
  return card;
}

/** The small status pill in the app bar. */
export function paintSyncPill() {
  const el = document.getElementById('sync-pill');
  if (!el) return;
  const st = status();
  el.hidden = st.kind === 'off';
  el.className = 'sync-pill ' + st.kind;
  el.title = st.error || st.label;
  clear(el, h('span', { class: 'sync-dot' }), h('span', { class: 'sync-label', text: st.label }));
}

/** Opening a join link: confirm, then connect this device. */
export async function handleJoin(params) {
  const url = params.get('join') || '';
  const key = params.get('key') || '';
  history.replaceState(null, '', location.pathname + '#run');
  if (!validSyncUrl(url)) { toast('That join link is not a Touch Map sync link.', { tone: 'bad' }); return; }
  if (state.sync.url === url) { toast('This device is already connected to that team log.'); return; }
  openModal(h('div', { class: 'confirm' },
    h('h2', { text: 'Join the team log?' }),
    h('p', {}, 'This device will share its touches with the team’s Google Sheet and show everyone else’s.'),
    h('p', { class: 'muted small', text: shortUrl(url) }),
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Not now'),
      h('button', { type: 'button', class: 'btn primary', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { await connect(url, key); closeModal(); toast('Joined. The team’s touches are on this device now.'); }
        catch (err) { closeModal(); toast(err.message, { tone: 'bad', timeout: 8000 }); }
      } }, 'Join'))),
  { label: 'Join the team log' });
}
