// Router and shell. Hash routes keep it working from any folder on GitHub Pages.
import { activeRun, timer } from './store.js';
import { renderCapture, stopTicking } from './capture.js';
import { renderLog } from './log.js';
import { renderInsights } from './insights.js';
import { renderRun } from './run.js';
import { renderGuide } from './guide.js';
import { closeModal } from './ui.js';

const ROUTES = {
  capture: (el) => renderCapture(el, { onSaved: paintChrome }),
  log: (el) => renderLog(el, { onChange: paintChrome }),
  analysis: (el) => renderInsights(el),
  run: (el) => renderRun(el, { onChange: paintChrome }),
  guide: (el) => renderGuide(el),
};

const view = document.getElementById('view');

function current() {
  const r = (location.hash || '#capture').slice(1);
  return ROUTES[r] ? r : 'capture';
}

function paintChrome() {
  const run = activeRun();
  document.getElementById('run-name').textContent = run.name;
  const badge = document.getElementById('log-count');
  badge.textContent = run.touches.length ? String(run.touches.length) : '';
  badge.hidden = !run.touches.length;
  const live = document.getElementById('live-dot');
  live.hidden = !timer.running();
  for (const a of document.querySelectorAll('[data-route]')) {
    const on = a.dataset.route === current();
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function route() {
  closeModal();
  stopTicking();
  const r = current();
  document.body.dataset.route = r;
  ROUTES[r](view);
  paintChrome();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => { if (e.key === 'touchmap:v1') location.reload(); });
setInterval(() => { document.getElementById('live-dot').hidden = !timer.running(); }, 1000);

route();

// Warn before closing the tab mid-touch (the timer would survive, but say so).
window.addEventListener('beforeunload', (e) => {
  if (timer.running()) { e.preventDefault(); e.returnValue = ''; }
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

