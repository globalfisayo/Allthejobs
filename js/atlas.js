/* atlas.js — the complete field guide: NOC & SOC fully nested */
import { getStructure, getMeta, state, setSys, SYS, levelName, codePath, esc } from './data.js';
import { openCard } from './card.js';

export async function renderAtlas(el, params) {
  if (params.sys && params.sys !== state.sys) setSys(params.sys);
  let sys = state.sys;
  const meta = await getMeta();

  el.innerHTML = `
  <div class="atlas">
    <div class="atlas-head">
      <h1 class="serif">The Atlas 📖</h1>
      <p>The complete official taxonomies, properly nested — every family, every branch, every unit group.
         Open any unit for its full STAR card. This is the seed bank the garden grows from.</p>
    </div>
    <div class="atlas-tools">
      <div class="atlas-tabs" id="atlas-tabs">
        <button data-sys="noc">🇨🇦 NOC 2021</button>
        <button data-sys="soc">🇬🇧 SOC 2020</button>
      </div>
      <input id="atlas-filter" type="search" placeholder="Filter this taxonomy…" autocomplete="off">
      <span class="atlas-counts" id="atlas-counts"></span>
    </div>
    <div class="atlas-tree" id="atlas-tree"></div>
  </div>`;

  const tabs = el.querySelectorAll('#atlas-tabs button');
  const treeEl = el.querySelector('#atlas-tree');
  const countsEl = el.querySelector('#atlas-counts');
  const filterEl = el.querySelector('#atlas-filter');

  function paintTabs() { tabs.forEach(b => b.classList.toggle('active', b.dataset.sys === sys)); }

  function nodeRow(n, depth) {
    const isUnit = !n.k?.length;
    const lvl = levelName(sys, n.c);
    return `
    <div class="anode ${isUnit ? 'leafy' : ''}" data-code="${n.c}">
      <button class="anode-row" data-code="${n.c}" data-unit="${isUnit ? 1 : 0}">
        <span class="tw">▶</span>
        <span class="code">${n.c}</span>
        <span class="ttl">${esc(n.t)}</span>
        ${isUnit && sys === 'noc' ? `<span class="lvl teer">TEER ${n.teer}</span>` : `<span class="lvl">${esc(lvl)}</span>`}
      </button>
      ${n.k?.length ? `<div class="anode-kids">${n.k.map(k => nodeRow(k, depth + 1)).join('')}</div>` : ''}
    </div>`;
  }

  async function paintTree() {
    paintTabs();
    const { tree } = await getStructure(sys);
    const c = meta[sys].counts;
    countsEl.innerHTML = sys === 'noc'
      ? `complete: <b>${c['1']}</b> › <b>${c['2']}</b> › <b>${c['3']}</b> › <b>${c['4']}</b> › <b>${c['5']}</b> unit groups ✓`
      : `complete: <b>${c['1']}</b> › <b>${c['2']}</b> › <b>${c['3']}</b> › <b>${c['4']}</b> unit groups ✓`;
    treeEl.innerHTML = tree.map(n => nodeRow(n, 0)).join('');

    treeEl.querySelectorAll('.anode-row').forEach(row => {
      row.addEventListener('click', () => {
        const code = row.dataset.code;
        if (row.dataset.unit === '1') openCard({ type: 'unit', sys, code });
        else {
          const anode = row.parentElement;
          const opening = !anode.classList.contains('open');
          anode.classList.toggle('open');
          if (opening && (row.altOpened = (row.altOpened || 0) + 1) && code.length >= 1) {
            /* group card available via long-press? keep simple: alt/cmd-click opens group card */
          }
        }
      });
      row.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (row.dataset.unit !== '1') openCard({ type: 'group', sys, code: row.dataset.code });
      });
    });
  }

  /* filter: hide non-matching branches (match on code or title, keep ancestors) */
  function applyFilter(q) {
    q = q.trim().toLowerCase();
    const all = treeEl.querySelectorAll('.anode');
    if (!q) { all.forEach(a => { a.classList.remove('match-hidden'); a.classList.remove('open'); }); return; }
    all.forEach(a => a.classList.add('match-hidden'));
    treeEl.querySelectorAll('.anode-row').forEach(row => {
      const t = row.querySelector('.ttl').textContent.toLowerCase();
      const c = row.dataset.code;
      if (t.includes(q) || c.startsWith(q)) {
        let p = row.closest('.anode');
        while (p) {
          p.classList.remove('match-hidden');
          p.classList.add('open');
          p = p.parentElement.closest('.anode');
        }
        // reveal children of a matching group too
        row.parentElement.querySelectorAll('.anode').forEach(k => k.classList.remove('match-hidden'));
      }
    });
  }

  let ft;
  filterEl.addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(() => applyFilter(filterEl.value), 140); });

  tabs.forEach(b => b.addEventListener('click', async () => {
    if (b.dataset.sys === sys) return;
    sys = b.dataset.sys; setSys(sys);
    await paintTree(); applyFilter(filterEl.value);
  }));

  const onSys = async () => {
    if (!el.isConnected) { window.removeEventListener('syschange', onSys); return; }
    if (state.sys !== sys) { sys = state.sys; await paintTree(); applyFilter(filterEl.value); }
  };
  window.addEventListener('syschange', onSys);

  await paintTree();

  /* deep link: expand to a code and open its card */
  if (params.code) {
    for (const c of codePath(params.code)) {
      const a = treeEl.querySelector(`.anode[data-code="${c}"]`);
      if (a && a.querySelector('.anode-kids')) a.classList.add('open');
    }
    const target = treeEl.querySelector(`.anode[data-code="${params.code}"] > .anode-row`);
    if (target) {
      target.scrollIntoView({ block: 'center' });
      if (target.dataset.unit === '1') openCard({ type: 'unit', sys, code: params.code });
      else openCard({ type: 'group', sys, code: params.code });
    }
  }
}
