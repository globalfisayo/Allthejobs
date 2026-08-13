/* firmview.js — one firm: the organogram as a living tree, plus a classic chart */
import { getFirm, state, SYS, esc } from './data.js';
import { makePanZoom } from './panzoom.js';
import { openCard } from './card.js';

/* ---------- small color helpers (division tinting) ---------- */
function hexToHsl(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslCss(h, s, l) { return `hsl(${h.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`; }

function wrap(text, max = 17) {
  const words = String(text).split(' ');
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > max) lines.push(w);
    else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
  }
  return lines.slice(0, 3);
}

/* ---------- hierarchy ---------- */
function buildHierarchy(firm) {
  const byid = new Map(firm.roles.map(r => [r.id, { ...r, kids: [] }]));
  let root = null;
  for (const n of byid.values()) {
    if (n.reports == null) root = n;
    else byid.get(n.reports)?.kids.push(n);
  }
  // leaf counts
  (function count(n) {
    n.leaves = n.kids.length ? n.kids.reduce((a, k) => a + count(k), 0) : 1;
    return n.leaves;
  })(root);
  return { root, byid };
}

/* butterfly order: largest subtree in the middle */
function butterfly(kids) {
  const sorted = [...kids].sort((a, b) => b.leaves - a.leaves);
  const out = [];
  sorted.forEach((k, i) => { if (i % 2) out.unshift(k); else out.push(k); });
  return out;
}

/* ---------- fan layout ---------- */
function layoutFan(root) {
  const SPREAD = 2.62; // ~150 degrees
  const RADII = [0, 172, 282, 372, 448, 510, 565];
  (function place(n, a0, a1, depth) {
    n.depth = depth;
    if (depth === 0) { n.x = 0; n.y = 0; }
    else {
      const a = (a0 + a1) / 2;
      n.angle = a;
      const r = RADII[Math.min(depth, RADII.length - 1)];
      n.x = Math.sin(a) * r;
      n.y = -Math.cos(a) * r;
    }
    if (!n.kids.length) return;
    let acc = a0;
    for (const k of butterfly(n.kids)) {
      const span = (a1 - a0) * (k.leaves / n.leaves);
      place(k, acc, acc + span, depth + 1);
      acc += span;
    }
  })(root, -SPREAD / 2, SPREAD / 2, 0);
}

const BRANCH_W = [26, 15, 9, 5.5, 3.2, 2.2];

function branchPath(p, c) {
  const mx = p.x + (c.x - p.x) * 0.42, my = p.y + (c.y - p.y) * 0.42;
  const c1x = p.x + (mx - p.x) * 0.5, c1y = p.y + (my - p.y) * 1.15;
  return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${mx.toFixed(1)} ${my.toFixed(1)}, ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
}

function leafPath(w, h) {
  return `M0 ${-h} Q ${w} 0 0 ${h} Q ${-w} 0 0 ${-h} Z`;
}

/* ---------- the tree renderer ---------- */
function drawTree(firm, hier, sys) {
  const { root } = hier;
  layoutFan(root);
  // board apex above everything
  const RMAX = 505;
  root.x = 0; root.y = -(RMAX + 130);

  const divisions = [...new Set(firm.roles.map(r => r.division))];
  const [h0, s0, l0] = hexToHsl(firm.palette.leaf);
  const divColor = d => {
    const i = divisions.indexOf(d);
    return hslCss(h0 + ((i * 47) % 60) - 26, Math.min(70, s0 + 6), Math.max(24, l0 - 4));
  };
  const divColorLight = d => {
    const i = divisions.indexOf(d);
    return hslCss(h0 + ((i * 47) % 60) - 26, Math.min(62, s0), Math.min(80, l0 + 26));
  };

  let sky = '', canopy = '', branches = '', nodes = '', dotted = '';

  /* canopy blobs per division (behind everything) */
  const divPts = new Map();
  (function collect(n) {
    if (n.depth >= 1 && n.id !== root.id) {
      if (!divPts.has(n.division)) divPts.set(n.division, []);
      divPts.get(n.division).push(n);
    }
    n.kids.forEach(collect);
  })(root);
  for (const [d, pts] of divPts) {
    if (!pts.length) continue;
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const spread = Math.max(70, Math.sqrt(pts.reduce((a, p) => a + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / pts.length) * 1.5);
    canopy += `<ellipse class="canopy-blob" cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${(spread * 1.25).toFixed(0)}" ry="${(spread * 0.95).toFixed(0)}" fill="${divColorLight(d)}" opacity="0.34"/>`;
  }
  canopy += `<ellipse class="canopy-blob" cx="0" cy="-330" rx="600" ry="360" fill="${firm.palette.leaf2}" opacity="0.12"/>`;

  /* trunk + ground */
  const ground = `
    <ellipse cx="0" cy="132" rx="360" ry="46" fill="#cdd9ae" opacity=".85"/>
    <ellipse cx="-160" cy="142" rx="200" ry="34" fill="#c2d1a0" opacity=".6"/>
    <path d="M-26 128 C -20 60, -12 24, 0 0 C 12 24, 20 60, 26 128 Z" fill="${firm.palette.bark}"/>
    <path d="M-6 128 C -4 80, -2 40, 0 12" stroke="rgba(255,255,255,.18)" stroke-width="3" fill="none"/>
    <path d="M-40 130 q 6 -14 12 0 M30 132 q 5 -12 10 0 M-58 138 q 5 -10 10 0" stroke="#8fa86b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;

  /* board link: golden thread from trunk top to apex */
  branches += `<path d="M0 0 C 0 ${root.y * 0.45}, 0 ${root.y * 0.72}, ${root.x} ${root.y + 46}" fill="none" stroke="#c9971c" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" opacity=".8"/>`;

  /* recursive branches + nodes */
  (function draw(n, parent) {
    if (parent && parent.id !== root.id) {
      const w = BRANCH_W[Math.min(n.depth, BRANCH_W.length - 1)];
      branches += `<path class="branch lvl${Math.min(n.depth, 3)}" d="${branchPath(parent, n)}" stroke-width="${w}"/>`;
    } else if (parent && parent.id === root.id && n.id !== 'ceo') {
      // governance bough (e.g. internal audit reporting to board): dotted golden
      dotted += `<path class="dotted-line" d="${branchPath({ x: 0, y: -60 }, n)}" stroke="#b08a2e"/>`;
      branches += `<path class="branch lvl1" d="${branchPath({ x: 0, y: 0 }, n)}" stroke-width="${BRANCH_W[1]}" opacity=".9"/>`;
    }

    if (n.id === root.id) {
      const lines = wrap(firm.governance.board, 16);
      nodes += `<g class="node gov-node" data-role="${n.id}" transform="translate(${root.x} ${root.y})">
        <circle class="crown" r="30" fill="#e8bc4a" stroke="#c9971c" stroke-width="3"/>
        <circle r="21" fill="none" stroke="#fff8e6" stroke-width="1.6" stroke-dasharray="3 4" opacity=".9"/>
        <text y="5" text-anchor="middle" font-size="17">🏛️</text>
        ${lines.map((l, i) => `<text class="lbl-e" y="${-44 - (lines.length - 1 - i) * 15}" text-anchor="middle" font-size="13.5" font-weight="700">${esc(l)}</text>`).join('')}
        <text class="lbl-e" y="50" text-anchor="middle" font-size="10" fill="#7c5e18">${firm.governance.committees.length} committees · governance</text>
      </g>`;
    } else {
      const kind = n.kind || 'role';
      const col = divColor(n.division);
      const size = kind === 'exec' ? 17 : kind === 'manager' ? 12 : 8.5;
      const rot = ((n.angle || 0) * 57.3).toFixed(1);
      const lines = wrap(n.title, kind === 'exec' ? 18 : 15);
      const lblClass = kind === 'exec' ? 'lbl-e' : kind === 'manager' ? 'lbl-m' : 'lbl-r';
      const fs = kind === 'exec' ? 12.5 : kind === 'manager' ? 11 : 9.5;
      const fw = kind === 'exec' ? 700 : kind === 'manager' ? 600 : 500;
      const a = n.angle || 0;
      let labels = '';
      if (kind === 'role' || n.depth >= 4) {
        /* rim leaves: label just past the leaf, along the branch angle */
        const dist = size + 7;
        const lx = Math.sin(a) * dist, ly = -Math.cos(a) * dist;
        const anchor = a > 0.1 ? 'start' : a < -0.1 ? 'end' : 'middle';
        const y0 = ly - ((lines.length - 1) * (fs + 2)) / 2 + (anchor === 'middle' ? -(fs / 2 + 2) : 3);
        labels = lines.map((l, i) => `<text class="${lblClass}" x="${lx.toFixed(1)}" y="${(y0 + i * (fs + 2)).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="${fw}">${esc(l)}</text>`).join('');
      } else {
        /* inner nodes: label pushed outward along the angle to dodge siblings */
        const dist = size + 10;
        const lx = Math.sin(a) * dist, ly = -Math.cos(a) * dist * 0.9;
        const anchor = a > 0.12 ? 'start' : a < -0.12 ? 'end' : 'middle';
        const y0 = anchor === 'middle'
          ? ly - (lines.length - 1) * (fs + 2.5) - 6
          : ly - ((lines.length - 1) * (fs + 2.5)) / 2 + 3;
        labels = lines.map((l, i) => `<text class="${lblClass}" x="${lx.toFixed(1)}" y="${(y0 + i * (fs + 2.5)).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="${fw}">${esc(l)}</text>`).join('');
      }
      nodes += `<g class="node" data-role="${n.id}" transform="translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})">
        <circle r="${Math.max(24, size + 12)}" fill="transparent"/>
        <g transform="rotate(${rot})">
          <path class="leafshape" d="${leafPath(size * 0.72, size)}" fill="${col}" stroke="${hslCss(h0, s0, Math.max(14, l0 - 22))}" stroke-width="1.1"/>
          <path d="M0 ${-size * 0.7} L0 ${size * 0.7}" stroke="rgba(255,255,255,.4)" stroke-width="1"/>
        </g>
        ${kind === 'exec' ? `<circle r="${size + 5}" fill="none" stroke="${col}" stroke-width="1.2" opacity=".45"/>` : ''}
        ${labels}
      </g>`;
    }
    n.kids.forEach(k => draw(k, n));
  })(root, null);

  /* internal dotted lines */
  (function dots(n) {
    for (const d of n.dotted || []) {
      const t = hier.byid.get(d);
      if (t) dotted += `<path class="dotted-line" d="${branchPath(n, t)}"/>`;
    }
    n.kids.forEach(dots);
  })(root);

  /* regulator clouds */
  const regs = (firm.regulators?.[state.sys === 'noc' ? 'ca' : 'uk']) || [];
  regs.forEach((rg, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const cx = side * (430 + Math.floor(i / 2) * 150);
    const cy = root.y - 40 + Math.floor(i / 2) * 130 - 40;
    sky += `<g class="cloud-node" data-reg="${esc(rg.n)}" transform="translate(${cx} ${cy})">
      <rect x="-84" y="-40" width="168" height="80" fill="transparent"/>
      <g class="cloud-body">
        <ellipse rx="74" ry="26" fill="#fff" opacity=".95"/>
        <ellipse cx="-34" cy="-12" rx="36" ry="18" fill="#fff"/>
        <ellipse cx="30" cy="-14" rx="40" ry="20" fill="#fff"/>
      </g>
      <text y="-2" text-anchor="middle" font-size="14.5">${esc(rg.n)}</text>
      <text class="cloud-label2" y="13" text-anchor="middle" font-size="8.5">regulator · ${state.sys === 'noc' ? 'Canada' : 'UK'}</text>
    </g>`;
    // dotted authority line to the board
    sky += `<path class="reg-line" stroke-width="2" d="M${cx} ${cy + 26} Q ${cx * 0.45} ${root.y + 60}, ${root.x + side * 24} ${root.y + 8}"/>`;
    // faint lines to touched roles
    for (const t of rg.touch || []) {
      const tn = hier.byid.get(t);
      if (tn) sky += `<path class="reg-line" stroke-width="1.1" opacity=".22" d="M${cx} ${cy + 26} Q ${(cx + tn.x) / 2} ${(cy + tn.y) / 2 - 60}, ${tn.x} ${tn.y - 10}"/>`;
    }
  });

  const bbox = { x: -760, y: root.y - 160, w: 1520, h: -(root.y - 160) + 200 };
  return { svg: sky + canopy + branches + dotted + ground + nodes, bbox, hier };
}

/* ---------- the classic chart renderer ---------- */
function drawChart(firm, hier, sys, collapsed) {
  const { root } = hier;
  const BW = 188, BH = 66, GX = 16, GY = 64;

  (function measure(n) {
    const open = !collapsed.has(n.id);
    const kids = open ? n.kids : [];
    kids.forEach(measure);
    n.cw = kids.length ? Math.max(BW, kids.reduce((a, k) => a + k.cw, 0) + GX * (kids.length - 1)) : BW;
  })(root);

  let boxes = '', links = '';
  const code = r => (state.sys === 'noc' ? r.noc : r.soc) || '';

  (function place(n, x, y) {
    n.bx = x + n.cw / 2 - BW / 2; n.by = y;
    const open = !collapsed.has(n.id);
    const kind = n.kind || 'role';
    const lines = wrap(n.title, 24);
    const kidCount = n.kids.length;
    boxes += `<g class="orgbox ${kind === 'governance' ? 'gov' : ''} ${kind === 'exec' ? 'exec' : ''}" data-role="${n.id}" transform="translate(${n.bx.toFixed(1)} ${n.by.toFixed(1)})">
      <rect class="box" width="${BW}" height="${BH}" rx="13"/>
      ${lines.slice(0, 2).map((l, i) => `<text class="t" x="12" y="${22 + i * 15}">${esc(l)}</text>`).join('')}
      <text class="d" x="12" y="${BH - 10}">${esc(n.division)}</text>
      ${code(n) ? `<text class="c" x="${BW - 12}" y="${BH - 10}" text-anchor="end">${SYS[state.sys].short} ${code(n)}</text>` : ''}
      ${kidCount ? `<g class="expander-g" data-exp="${n.id}" transform="translate(${BW / 2} ${BH})" style="cursor:pointer">
          <circle r="16" fill="transparent"/>
          <circle r="9.5" fill="${open ? '#8fa86b' : '#2e7d43'}"/>
          <text class="expander" text-anchor="middle" y="3.5">${open ? '–' : '+' + kidCount}</text>
        </g>` : ''}
    </g>`;
    if (open && kidCount) {
      let cx = x;
      for (const k of n.kids) {
        place(k, cx, y + BH + GY);
        const px = n.bx + BW / 2, py = n.by + BH + 9.5;
        const kx = k.bx + BW / 2, ky = k.by;
        const midY = py + (ky - py) * 0.55;
        links += `<path class="orglink" d="M${px} ${py} V ${midY} H ${kx} V ${ky}"/>`;
        cx += k.cw + GX;
      }
    }
  })(root, -root.cw / 2, 0);

  let maxY = 0;
  (function deep(n) { maxY = Math.max(maxY, n.by || 0); if (!collapsed.has(n.id)) n.kids.forEach(deep); })(root);
  const bbox = { x: -root.cw / 2 - 30, y: -30, w: root.cw + 60, h: maxY + BH + 80 };
  return { svg: links + boxes, bbox };
}

/* ---------- main render ---------- */
export async function renderFirm(el, id, params) {
  const firm = await getFirm(id);
  const hier = buildHierarchy(firm);
  let mode = params.v === 'chart' ? 'chart' : 'tree';
  const collapsed = new Set();
  // default chart collapse: everything at depth >= 2 with children
  (function initCollapse(n, d) {
    if (d >= 2 && n.kids.length) collapsed.add(n.id);
    n.kids.forEach(k => initCollapse(k, d + 1));
  })(hier.root, 0);

  el.innerHTML = `
  <div class="firm">
    <div class="firm-bar">
      <a class="back-link" href="#/">← Garden</a>
      <div class="firm-title">
        <h1 class="serif">${esc(firm.name)}</h1>
        <span class="sub">${esc(firm.industry)} · ${esc(firm.archetype)}</span>
      </div>
      <div class="firm-bar-tools">
        <button class="roster-btn" id="roster-btn">☰ Roles</button>
        <div class="view-toggle" id="mode-toggle">
          <button data-mode="tree" class="${mode === 'tree' ? 'active' : ''}">🌳 Tree</button>
          <button data-mode="chart" class="${mode === 'chart' ? 'active' : ''}">▦ Chart</button>
        </div>
      </div>
    </div>
    <div class="firm-stage-wrap">
      <div class="firm-stage" id="stage"><svg id="stage-svg"><g id="world"></g></svg></div>
      <div class="roster" id="roster" aria-label="All roles">
        <div class="roster-head"><h3 class="serif">Every role</h3>
          <button class="roster-close" id="roster-close">✕</button></div>
        <div class="roster-list" id="roster-list"></div>
      </div>
      <div class="zoom-controls">
        <button id="z-in" title="Zoom in">+</button>
        <button id="z-out" title="Zoom out">−</button>
        <button id="z-fit" title="Fit">⤢</button>
      </div>
      <div class="zoom-hint">drag to wander · scroll or pinch to zoom · tap a leaf for its card</div>
    </div>
  </div>`;

  const stage = el.querySelector('#stage');
  const svg = el.querySelector('#stage-svg');
  const world = el.querySelector('#world');

  function sizeSvg() {
    svg.setAttribute('viewBox', `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
    svg.setAttribute('width', stage.clientWidth);
    svg.setAttribute('height', stage.clientHeight);
  }
  sizeSvg();

  const pz = makePanZoom(stage, svg, world, {
    onZoom: s => { svg.dataset.zoom = s < 0.62 ? 'z0' : s < 1.05 ? 'z1' : 'z2'; },
  });

  let lastBox = null;
  function paint(fitView = true) {
    const out = mode === 'tree'
      ? drawTree(firm, hier, state.sys)
      : drawChart(firm, hier, state.sys, collapsed);
    world.innerHTML = out.svg;
    lastBox = out.bbox;
    if (fitView) {
      if (mode === 'chart') pz.fit(out.bbox, 30, { minReadable: 0.62, alignTop: true });
      else pz.fit(out.bbox, 30);
    }
    wireWorld();
  }

  function highlight(roleId) {
    world.querySelectorAll('.node.hl, .orgbox.hl').forEach(n => n.classList.remove('hl'));
    const g = world.querySelector(`[data-role="${roleId}"]`);
    if (g) g.classList.add('hl');
  }

  function focusRole(roleId) {
    const n = hier.byid.get(roleId);
    if (!n) return;
    if (mode === 'chart') {
      let p = n.reports && hier.byid.get(n.reports);
      let changed = false;
      while (p) { if (collapsed.delete(p.id)) changed = true; p = p.reports && hier.byid.get(p.reports); }
      if (changed) paint(false);
      pz.center(n.bx + 94, n.by + 33, Math.max(pz.scale, 0.9));
    } else {
      pz.center(n.x, n.y, Math.max(pz.scale, 1.5));
    }
    highlight(roleId);
  }

  function openRole(roleId) {
    const r = hier.byid.get(roleId);
    if (!r) return;
    highlight(roleId);
    openCard({ type: 'role', firm, hier, roleId });
    history.replaceState(null, '', `#/firm/${firm.id}?role=${roleId}`);
  }

  function wireWorld() {
    world.querySelectorAll('.node, .orgbox').forEach(g => {
      g.addEventListener('click', e => {
        if (pz.didMove) return;
        const exp = e.target.closest('.expander-g');
        if (exp) {
          const nid = exp.dataset.exp;
          collapsed.has(nid) ? collapsed.delete(nid) : collapsed.add(nid);
          paint(false);
          return;
        }
        openRole(g.dataset.role);
      });
    });
    world.querySelectorAll('.cloud-node').forEach(c => {
      c.addEventListener('click', () => {
        if (pz.didMove) return;
        openCard({ type: 'regulator', firm, hier, regName: c.dataset.reg });
      });
    });
  }

  /* roster */
  const roster = el.querySelector('#roster');
  const rosterList = el.querySelector('#roster-list');
  function paintRoster() {
    const divs = [...new Set(firm.roles.map(r => r.division))];
    rosterList.innerHTML = divs.map(d => `
      <div class="roster-div">${esc(d)}</div>
      ${firm.roles.filter(r => r.division === d).map(r => `
        <button class="roster-item" data-role="${r.id}">
          <span>${esc(r.title)}</span>
          <span class="code">${(state.sys === 'noc' ? r.noc : r.soc) || ''}</span>
        </button>`).join('')}`).join('');
    rosterList.querySelectorAll('.roster-item').forEach(b =>
      b.addEventListener('click', () => { focusRole(b.dataset.role); openRole(b.dataset.role); if (window.innerWidth < 720) roster.classList.remove('open'); }));
  }
  el.querySelector('#roster-btn').addEventListener('click', () => roster.classList.toggle('open'));
  el.querySelector('#roster-close').addEventListener('click', () => roster.classList.remove('open'));

  /* toolbar */
  el.querySelectorAll('#mode-toggle button').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.mode === mode) return;
      mode = b.dataset.mode;
      el.querySelectorAll('#mode-toggle button').forEach(x => x.classList.toggle('active', x === b));
      paint(true);
    }));
  el.querySelector('#z-in').addEventListener('click', () => pz.zoomIn());
  el.querySelector('#z-out').addEventListener('click', () => pz.zoomOut());
  el.querySelector('#z-fit').addEventListener('click', () => lastBox && pz.fit(lastBox, 30));

  /* react to system toggle while mounted */
  const onSys = () => { if (!el.isConnected) { window.removeEventListener('syschange', onSys); return; } paint(false); paintRoster(); };
  window.addEventListener('syschange', onSys);
  const onResize = () => { if (!el.isConnected) { window.removeEventListener('resize', onResize); return; } sizeSvg(); lastBox && pz.fit(lastBox, 30); };
  window.addEventListener('resize', onResize);

  paint(true);
  paintRoster();

  if (params.role && hier.byid.has(params.role)) {
    setTimeout(() => { focusRole(params.role); openRole(params.role); }, 60);
  }
}
