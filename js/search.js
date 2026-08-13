/* search.js — one box to find any job in the garden or either taxonomy */
import { getStructure, getTitleIndex, getRolesIndex, state, SYS, esc } from './data.js';
import { openCard } from './card.js';

let unitLists = null;      // {noc:[{c,t}], soc:[{c,t}]}
let rolesIdx = null;       // [[title, firmId, roleId, division, noc, soc]]
let bigIdx = { noc: null, soc: null };
let warmed = false;

async function warm() {
  if (warmed) return;
  warmed = true;
  const flat = tree => {
    const out = [];
    (function walk(ns) { ns.forEach(n => { if (n.k?.length) walk(n.k); else out.push({ c: n.c, t: n.t }); }); })(tree);
    return out;
  };
  const [ns, ss, ri] = await Promise.all([getStructure('noc'), getStructure('soc'), getRolesIndex()]);
  unitLists = { noc: flat(ns.tree), soc: flat(ss.tree) };
  rolesIdx = ri;
  // big title indexes in the background — don't block first keystrokes
  getTitleIndex('noc').then(x => { bigIdx.noc = x; }).catch(() => {});
  getTitleIndex('soc').then(x => { bigIdx.soc = x; }).catch(() => {});
}

function score(title, q) {
  const t = title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const wb = t.search(new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  if (wb >= 0) return 60 - Math.min(30, wb / 4);
  if (t.includes(q)) return 30;
  return -1;
}

function top(list, q, key, n = 6) {
  const out = [];
  for (const item of list) {
    const s = score(key(item), q);
    if (s > 0) out.push([s, item]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}

export function initSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  let items = [], sel = -1, t;

  input.addEventListener('focus', warm, { once: true });

  function close() { results.hidden = true; results.innerHTML = ''; sel = -1; items = []; }

  function paint(q) {
    if (!unitLists) { results.innerHTML = '<div class="sr-empty">Warming up the greenhouse…</div>'; results.hidden = false; return; }
    const groups = [];

    const roleHits = top(rolesIdx || [], q, r => r[0], 5);
    if (roleHits.length) groups.push(['🌳 In the garden', roleHits.map(r => ({
      label: r[0], sub: r[1].replace(/-/g, ' '), code: (state.sys === 'noc' ? r[4] : r[5]),
      go: () => { location.hash = `#/firm/${r[1]}?role=${r[2]}`; },
    }))]);

    for (const sys of [state.sys, state.sys === 'noc' ? 'soc' : 'noc']) {
      const hits = top(unitLists[sys], q, u => u.t, 5);
      if (hits.length) groups.push([`${SYS[sys].flag} ${SYS[sys].short} unit groups`, hits.map(u => ({
        label: u.t, code: u.c,
        go: () => openCard({ type: 'unit', sys, code: u.c }),
      }))]);
    }

    // known real-world titles → their unit group
    for (const sys of [state.sys, state.sys === 'noc' ? 'soc' : 'noc']) {
      if (!bigIdx[sys]) continue;
      const hits = top(bigIdx[sys], q, x => x[0], sys === state.sys ? 6 : 3);
      if (hits.length) groups.push([`${SYS[sys].flag} known job titles`, hits.map(x => ({
        label: x[0], code: x[1],
        go: () => openCard({ type: 'unit', sys, code: x[1] }),
      }))]);
    }

    if (!groups.length) {
      results.innerHTML = `<div class="sr-empty">Nothing by that name has grown here yet — try another word for the work.</div>`;
      results.hidden = false;
      return;
    }
    items = [];
    results.innerHTML = groups.map(([g, its]) => `
      <div class="sr-group">${g}</div>
      ${its.map(it => { const i = items.push(it) - 1; return `
        <button class="sr-item" data-i="${i}" role="option">
          <span>${esc(it.label)}</span>
          ${it.sub ? `<span class="where">${esc(it.sub)}</span>` : ''}
          ${it.code ? `<span class="code">${it.code}</span>` : ''}
        </button>`; }).join('')}`).join('');
    results.hidden = false;
    results.querySelectorAll('.sr-item').forEach(b =>
      b.addEventListener('mousedown', e => { e.preventDefault(); pick(+b.dataset.i); }));
  }

  function pick(i) {
    const it = items[i];
    if (!it) return;
    close();
    input.blur();
    it.go();
  }

  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { close(); return; }
    t = setTimeout(() => paint(q), 130);
  });
  input.addEventListener('keydown', e => {
    if (results.hidden) return;
    const els = results.querySelectorAll('.sr-item');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length;
      els.forEach((b, i) => b.classList.toggle('sel', i === sel));
      els[sel]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); pick(sel >= 0 ? sel : 0); }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 160));
}
