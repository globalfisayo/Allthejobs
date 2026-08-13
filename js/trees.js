/* trees.js — hand-drawn decorative trees for the garden beds & hero sky.
   Deterministic per-firm randomness so every tree is unique but stable. */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- canopy blob helper: cluster of overlapping ellipses --- */
function blobs(r, cx, cy, w, h, n, c1, c2, opacity = 1) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.9;
    const rx = w * (0.32 + r() * 0.2);
    const ry = h * (0.3 + r() * 0.2);
    const x = cx + Math.cos(a) * w * 0.30 * (0.4 + r() * 0.6);
    const y = cy + Math.sin(a) * h * 0.26 * (0.4 + r() * 0.6);
    const fill = r() > 0.45 ? c1 : c2;
    out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" opacity="${opacity}"/>`;
  }
  return out;
}

/* Each species: (r, x, groundY, height, pal) → svg string.
   pal: {leaf, leaf2, bark, fruit?} */
const SPECIES = {
  broadleaf(r, x, gy, h, pal) {
    const trunkH = h * 0.42, cw = h * 0.78, ch = h * 0.62;
    const cy = gy - trunkH - ch * 0.42;
    const lean = (r() - 0.5) * h * 0.08;
    return `
      <path d="M${x - h*0.035} ${gy} C ${x - h*0.02} ${gy - trunkH*0.6}, ${x + lean - h*0.02} ${gy - trunkH*0.8}, ${x + lean} ${gy - trunkH - ch*0.1}
               C ${x + lean + h*0.02} ${gy - trunkH*0.8}, ${x + h*0.02} ${gy - trunkH*0.6}, ${x + h*0.035} ${gy} Z" fill="${pal.bark}"/>
      <path d="M${x + lean*0.6} ${gy - trunkH*0.75} L ${x + lean*0.6 - cw*0.22} ${gy - trunkH - ch*0.18}" stroke="${pal.bark}" stroke-width="${h*0.022}" stroke-linecap="round" fill="none"/>
      <path d="M${x + lean*0.7} ${gy - trunkH*0.85} L ${x + lean*0.7 + cw*0.2} ${gy - trunkH - ch*0.22}" stroke="${pal.bark}" stroke-width="${h*0.02}" stroke-linecap="round" fill="none"/>
      ${blobs(r, x + lean, cy, cw, ch, 7, pal.leaf, pal.leaf2)}
      ${blobs(r, x + lean - cw*0.14, cy - ch*0.16, cw*0.5, ch*0.42, 3, pal.leaf2, pal.leaf)}
      ${pal.fruit ? fruitDots(r, x + lean, cy, cw, ch, pal.fruit) : ''}`;
  },
  conifer(r, x, gy, h, pal) {
    const tw = h * 0.5;
    let out = `<rect x="${x - h*0.028}" y="${gy - h*0.2}" width="${h*0.056}" height="${h*0.2}" rx="${h*0.02}" fill="${pal.bark}"/>`;
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const ty = gy - h * 0.14 - (h * 0.78) * (i / tiers);
      const wI = tw * (1 - i / tiers) + h * 0.06;
      const hI = h * 0.30;
      const fill = i % 2 ? pal.leaf2 : pal.leaf;
      out += `<path d="M${x} ${ty - hI} L ${x + wI/2 + (r()-0.5)*4} ${ty} Q ${x} ${ty + h*0.02} ${x - wI/2 - (r()-0.5)*4} ${ty} Z" fill="${fill}"/>`;
    }
    return out;
  },
  columnar(r, x, gy, h, pal) {
    const cw = h * 0.3, ch = h * 0.86;
    const cy = gy - h * 0.12 - ch / 2;
    return `
      <rect x="${x - h*0.024}" y="${gy - h*0.16}" width="${h*0.048}" height="${h*0.16}" rx="${h*0.02}" fill="${pal.bark}"/>
      ${blobs(r, x, cy, cw, ch, 8, pal.leaf, pal.leaf2)}
      <ellipse cx="${x}" cy="${cy - ch*0.34}" rx="${cw*0.3}" ry="${ch*0.14}" fill="${pal.leaf2}"/>`;
  },
  weeping(r, x, gy, h, pal) {
    const trunkH = h * 0.5, cw = h * 0.8, ch = h * 0.5;
    const cy = gy - trunkH - ch * 0.28;
    let fronds = '';
    for (let i = 0; i < 7; i++) {
      const fx = x - cw * 0.42 + (cw * 0.84) * (i / 6) + (r() - 0.5) * 6;
      const drop = ch * (0.75 + r() * 0.55);
      fronds += `<path d="M${fx} ${cy} Q ${fx + (r()-0.4)*14} ${cy + drop*0.6} ${fx + (r()-0.5)*20} ${cy + drop}" stroke="${r() > .5 ? pal.leaf : pal.leaf2}" stroke-width="${h*0.035}" stroke-linecap="round" fill="none" opacity="${0.75 + r()*0.25}"/>`;
    }
    return `
      <path d="M${x - h*0.032} ${gy} C ${x} ${gy - trunkH*0.7}, ${x - h*0.05} ${gy - trunkH*0.9}, ${x + h*0.01} ${gy - trunkH}
               L ${x + h*0.04} ${gy - trunkH*0.94} C ${x + h*0.03} ${gy - trunkH*0.6}, ${x + h*0.05} ${gy - trunkH*0.3}, ${x + h*0.032} ${gy} Z" fill="${pal.bark}"/>
      ${blobs(r, x, cy, cw, ch, 6, pal.leaf, pal.leaf2)}
      ${fronds}`;
  },
  birch(r, x, gy, h, pal) {
    const trunkH = h * 0.52, cw = h * 0.6, ch = h * 0.52;
    const cy = gy - trunkH - ch * 0.34;
    let marks = '';
    for (let i = 0; i < 5; i++) {
      const my = gy - trunkH * (0.15 + i * 0.17);
      marks += `<path d="M${x - h*0.02} ${my} q ${h*0.02} ${h*0.008} ${h*0.04} 0" stroke="#8a8578" stroke-width="${h*0.012}" fill="none"/>`;
    }
    return `
      <path d="M${x - h*0.026} ${gy} L ${x - h*0.016} ${gy - trunkH} L ${x + h*0.016} ${gy - trunkH} L ${x + h*0.026} ${gy} Z" fill="${pal.bark}"/>
      ${marks}
      <path d="M${x} ${gy - trunkH*0.8} L ${x - cw*0.24} ${gy - trunkH - ch*0.1}" stroke="${pal.bark}" stroke-width="${h*0.015}" stroke-linecap="round"/>
      ${blobs(r, x, cy, cw, ch, 6, pal.leaf, pal.leaf2, 0.96)}`;
  },
  orchard(r, x, gy, h, pal) {
    const trunkH = h * 0.34, cw = h * 0.82, ch = h * 0.6;
    const cy = gy - trunkH - ch * 0.4;
    return `
      <path d="M${x - h*0.03} ${gy} L ${x - h*0.012} ${gy - trunkH} L ${x + h*0.012} ${gy - trunkH} L ${x + h*0.03} ${gy} Z" fill="${pal.bark}"/>
      <path d="M${x} ${gy - trunkH*0.9} L ${x - cw*0.3} ${cy + ch*0.2} M${x} ${gy - trunkH*0.9} L ${x + cw*0.28} ${cy + ch*0.24}" stroke="${pal.bark}" stroke-width="${h*0.022}" stroke-linecap="round" fill="none"/>
      ${blobs(r, x, cy, cw, ch, 7, pal.leaf, pal.leaf2)}
      ${fruitDots(r, x, cy, cw, ch, pal.fruit || '#c1440e')}`;
  },
};
SPECIES.oak = SPECIES.broadleaf; SPECIES.maple = SPECIES.broadleaf; SPECIES.plane = SPECIES.broadleaf;
SPECIES.elm = SPECIES.broadleaf; SPECIES.chestnut = SPECIES.broadleaf;
SPECIES.spruce = SPECIES.conifer; SPECIES.cypress = SPECIES.conifer; SPECIES.cedar = SPECIES.conifer;
SPECIES.poplar = SPECIES.columnar; SPECIES.willow = SPECIES.weeping; SPECIES.apple = SPECIES.orchard;

function fruitDots(r, cx, cy, w, h, color) {
  let out = '';
  for (let i = 0; i < 7; i++) {
    out += `<circle cx="${(cx + (r() - 0.5) * w * 0.8).toFixed(1)}" cy="${(cy + (r() - 0.5) * h * 0.7).toFixed(1)}" r="2.6" fill="${color}"/>`;
  }
  return out;
}

export function treeSVG(species, seedStr, x, groundY, height, pal, extraClass = '') {
  const fn = SPECIES[species] || SPECIES.broadleaf;
  const r = rng(hashSeed(seedStr));
  return `<g class="${extraClass}">${fn(r, x, groundY, height, pal)}</g>`;
}

const GREY = { leaf: '#c3c9bb', leaf2: '#d3d8cc', bark: '#a9a396', fruit: '#c9c2b4' };

/* A garden-bed scene: mound, one grown tree, grey saplings */
export function bedScene(firm, idx) {
  const W = 340, H = 200, gy = 168;
  const r = rng(hashSeed(firm.id));
  let flowers = '';
  for (let i = 0; i < 6; i++) {
    const fx = 20 + r() * 300, fy = gy + 6 + r() * 18;
    const col = ['#d98b5f', '#c9971c', '#a7c957', '#b56d8a'][Math.floor(r() * 4)];
    flowers += `<circle cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" r="2" fill="${col}" opacity=".7"/>`;
  }
  const sapX = [244, 280, 312];
  const saps = (firm.saplings || []).slice(0, 3).map((s, i) =>
    `<g opacity="0.55">${treeSVG(firm.species, firm.id + '-sap' + i, sapX[i], gy + 4, 40 + r() * 14, GREY)}</g>`
  ).join('');
  return `
  <svg class="bed-scene" viewBox="0 0 ${W} ${H}" role="img" aria-label="${firm.name} tree">
    <ellipse cx="${W/2}" cy="${H + 40}" rx="${W * 0.75}" ry="90" fill="#dfe7c9"/>
    <ellipse cx="${W * 0.2}" cy="${H + 52}" rx="${W * 0.55}" ry="86" fill="#d6dfbd" opacity=".8"/>
    ${flowers}
    ${treeSVG(firm.species, firm.id, 118, gy + 6, 132, firm.palette, 'bed-tree')}
    ${saps}
    <text x="${sapX[1]}" y="${gy + 26}" text-anchor="middle" font-size="9.5" fill="#8b917f" font-style="italic">coming soon</text>
  </svg>`;
}

/* The hero panorama: sun, clouds, hills */
export function heroSVG() {
  return `
  <svg class="hero-sky" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#cfe6f2"/><stop offset="1" stop-color="#e9f2da"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="300" fill="url(#skyg)"/>
    <circle class="sun-halo" cx="990" cy="74" r="58" fill="#f3d98b" opacity=".55"/>
    <circle cx="990" cy="74" r="34" fill="#f0c75e"/>
    <g class="cloud" opacity=".9">
      <ellipse cx="180" cy="70" rx="62" ry="20" fill="#fff"/>
      <ellipse cx="228" cy="60" rx="42" ry="16" fill="#fff"/>
      <ellipse cx="140" cy="60" rx="34" ry="13" fill="#fff"/>
    </g>
    <g class="cloud c2" opacity=".75">
      <ellipse cx="560" cy="48" rx="52" ry="16" fill="#fff"/>
      <ellipse cx="600" cy="40" rx="34" ry="12" fill="#fff"/>
    </g>
    <g class="cloud c3" opacity=".6">
      <ellipse cx="820" cy="96" rx="44" ry="13" fill="#fff"/>
      <ellipse cx="852" cy="88" rx="28" ry="10" fill="#fff"/>
    </g>
    <path d="M330 92 q 8 -7 16 0 M346 92 q 8 -7 16 0" stroke="#7d8a75" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".7"/>
    <path d="M420 66 q 7 -6 14 0 M434 66 q 7 -6 14 0" stroke="#7d8a75" stroke-width="2" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M0 246 Q 200 196 430 232 T 860 226 T 1200 238 V 300 H 0 Z" fill="#cfdcb2" opacity=".85"/>
    <path d="M0 268 Q 260 224 560 256 T 1200 260 V 300 H 0 Z" fill="#bccf9d"/>
    ${treeSVG('broadleaf', 'hero1', 90, 262, 64, { leaf: '#5f8f57', leaf2: '#7aa871', bark: '#6f4e37' })}
    ${treeSVG('conifer', 'hero2', 1105, 268, 70, { leaf: '#3d6b4a', leaf2: '#517f5e', bark: '#5a4a3a' })}
    ${treeSVG('orchard', 'hero3', 1010, 280, 46, { leaf: '#4e9142', leaf2: '#6fae62', bark: '#7a5c44', fruit: '#c1440e' })}
  </svg>`;
}
