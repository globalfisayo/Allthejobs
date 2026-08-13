/* app.js — hash router, header wiring, view dispatch */
import { state, setSys } from './data.js';
import { renderGarden } from './garden.js';
import { renderFirm } from './firmview.js';
import { renderAtlas } from './atlas.js';
import { renderAbout } from './about.js';
import { initSearch } from './search.js';
import { initCard, closeCard } from './card.js';

const view = document.getElementById('view');

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = h.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { parts, params };
}

let currentKey = null;

async function route() {
  const { parts, params } = parseHash();
  const key = parts.join('/');
  const navName = parts[0] === 'atlas' ? 'atlas' : parts[0] === 'about' ? 'about' : 'garden';
  document.querySelectorAll('[data-nav]').forEach(a =>
    a.classList.toggle('active', a.dataset.nav === navName));

  if (key === currentKey && !params.role && !params.code) return;
  const rerender = key !== currentKey;
  currentKey = key;
  closeCard(true);

  if (rerender) {
    view.innerHTML = '';
    window.scrollTo(0, 0);
    try {
      if (parts[0] === 'firm' && parts[1]) await renderFirm(view, parts[1], params);
      else if (parts[0] === 'atlas') await renderAtlas(view, params);
      else if (parts[0] === 'about') await renderAbout(view);
      else await renderGarden(view);
    } catch (err) {
      console.error(err);
      view.innerHTML = `<div style="padding:60px 20px;text-align:center;color:var(--muted)">
        <h2 class="serif" style="color:var(--ink)">This corner of the garden isn't growing yet</h2>
        <p>${String(err.message || err)}</p>
        <p><a href="#/">← back to the garden</a></p></div>`;
    }
  }
}

/* system toggle */
const sysBtns = document.querySelectorAll('#sys-toggle button');
function paintSys() {
  sysBtns.forEach(b => b.classList.toggle('active', b.dataset.sys === state.sys));
}
sysBtns.forEach(b => b.addEventListener('click', () => { setSys(b.dataset.sys); }));
window.addEventListener('syschange', paintSys);
paintSys();

/* mobile bottom nav */
const bn = document.createElement('nav');
bn.className = 'bottomnav';
bn.setAttribute('aria-label', 'Primary mobile');
bn.innerHTML = `
  <a href="#/" data-nav="garden">🌳 Garden</a>
  <a href="#/atlas" data-nav="atlas">📖 Atlas</a>
  <a href="#/about" data-nav="about">🫘 About</a>`;
document.body.appendChild(bn);

initCard();
initSearch();

window.addEventListener('hashchange', route);
route();
