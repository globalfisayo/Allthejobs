/* data.js — fetch, cache, and shared state */

const cache = new Map();

function j(url) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(`fetch failed: ${url} (${r.status})`);
      return r.json();
    }).catch(err => { cache.delete(url); throw err; }));
  }
  return cache.get(url);
}

export const getMeta = () => j('data/meta.json');
export const getStructure = sys => j(`data/${sys}/structure.json`);
export const getDetails = (sys, cat) => j(`data/${sys}/d/${cat}.json`);
export const getFirmIndex = () => j('data/firms/index.json');
export const getFirm = id => j(`data/firms/${id}.json`);
export const getTitleIndex = sys => j(`data/${sys}/search.json`);
export const getRolesIndex = () => j('data/firms/roles-index.json');

export async function getUnit(sys, code) {
  const d = await getDetails(sys, code[0]);
  return d.units[code] || null;
}
export async function getGroup(sys, code) {
  const d = await getDetails(sys, code[0]);
  return d.groups[code] || null;
}

/* ---- shared state: active classification system ---- */
export const state = {
  sys: localStorage.getItem('atj-sys') === 'soc' ? 'soc' : 'noc',
};
export function setSys(sys) {
  if (sys === state.sys) return;
  state.sys = sys;
  localStorage.setItem('atj-sys', sys);
  window.dispatchEvent(new CustomEvent('syschange', { detail: sys }));
}

export const SYS = {
  noc: {
    flag: '🇨🇦', short: 'NOC', name: 'NOC 2021 Version 1.0', country: 'Canada',
    agency: 'Statistics Canada / ESDC',
    levels: ['Broad category', 'Major group', 'Sub-major group', 'Minor group', 'Unit group'],
  },
  soc: {
    flag: '🇬🇧', short: 'SOC', name: 'SOC 2020', country: 'United Kingdom',
    agency: 'Office for National Statistics',
    levels: ['Major group', 'Sub-major group', 'Minor group', 'Unit group'],
  },
};

export const TEER = [
  'Management occupations',
  'Usually a university degree (or TEER 2 experience + expertise)',
  '2–3 yr college diploma, 2–5 yr apprenticeship, or supervisory duties',
  '<2 yr college, <2 yr apprenticeship, or 6+ months on-the-job training',
  'Secondary school and/or several weeks of on-the-job training',
  'Short work demonstration; no formal education required',
];

export function levelName(sys, code) {
  const L = SYS[sys].levels;
  return L[code.length - 1] || 'Group';
}

/* Path of ancestor codes for a unit code, e.g. NOC 10021 → ['1','10','100','1002','10021'] */
export function codePath(code) {
  const out = [];
  for (let i = 1; i <= code.length; i++) out.push(code.slice(0, i));
  return out;
}

/* find a node + its ancestors' titles in a structure tree */
export async function pathTitles(sys, code) {
  const { tree } = await getStructure(sys);
  const path = [];
  let nodes = tree;
  for (const c of codePath(code)) {
    const n = (nodes || []).find(x => x.c === c);
    if (!n) break;
    path.push({ c: n.c, t: n.t });
    nodes = n.k;
  }
  return path;
}

export const esc = s => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
