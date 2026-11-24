// Router and shell. Hash routes keep it working from any folder on GitHub Pages.
import { activeRun, timer } from './store.js';
import { renderCapture } from './capture.js';
import { renderLog } from './log.js';
import { renderInsights } from './insights.js';
import { renderRuns } from './runs.js';
import { renderReport } from './report.js';
import { renderGuide } from './guide.js';
import { renderSetup } from './setup.js';
import { closeModal } from './ui.js';
import { startSync, onSync } from './sync.js';
import { paintSyncPill, handleJoin } from './sync-ui.js';
import { onWatch } from './stopwatch.js';
import { initMinibar, showMinibar } from './minibar.js';

// Each view renders into the main element; one that keeps timers or listeners returns a cleanup.
const ROUTES = {
  capture: (el) => renderCapture(el),
  log: (el) => renderLog(el, { onChange: paintChrome }),
  analysis: (el) => renderInsights(el),
  run: (el) => renderRuns(el, { onChange: paintChrome }),
  report: (el) => renderReport(el),
  guide: (el) => renderGuide(el),
  setup: (el) => renderSetup(el, { onChange: paintChrome }),
};
// Tabs a route belongs under, for the highlight.
const TAB_OF = { report: 'run' };

const view = document.getElementById('view');
let cleanup = null;

function current() {
  const r = (location.hash || '#capture').slice(1).split(/[?&=]/)[0];
  return ROUTES[r] ? r : 'capture';
}

function paintChrome() {
  const run = activeRun();
  document.getElementById('run-name').textContent = run.name;
  const badge = document.getElementById('log-count');
  badge.textContent = run.touches.length ? String(run.touches.length) : '';
  badge.hidden = !run.touches.length;
  paintSyncPill();
  document.getElementById('live-dot').hidden = !timer.running();
  const r = current();
  const tab = TAB_OF[r] || r;
  for (const a of document.querySelectorAll('[data-route]')) {
    const on = a.dataset.route === tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

function route() {
  if (location.hash.startsWith('#join=')) {
    const params = new URLSearchParams(location.hash.slice(1));
    handleJoin(params).then(() => paintChrome());
    return renderRoute();
  }
  closeModal();
  renderRoute();
}

function renderRoute({ keepScroll = false } = {}) {
  const y = window.scrollY;
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const r = current();
  document.body.dataset.route = r;
  cleanup = ROUTES[r](view) || null;
  showMinibar(r !== 'capture');
  paintChrome();
  window.scrollTo(0, keepScroll ? y : 0);
}

// When another device's touches arrive, refresh the views that show them (not Capture, Runs or
// Setup while someone is typing there).
onSync((changed) => {
  paintChrome();
  if (!changed) return;
  const r = current();
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  const modal = document.getElementById('modal').open;
  if (r === 'log' || r === 'analysis' || r === 'report' || ((r === 'run' || r === 'setup') && !typing && !modal)) renderRoute({ keepScroll: true });
});

// Saving or undoing from the stopwatch bar changes the log and the counts.
onWatch((evt) => {
  paintChrome();
  if ((evt === 'saved' || evt === 'undo' || evt === 'changed') && ['log', 'run', 'analysis'].includes(current()) && !document.getElementById('modal').open) {
    renderRoute({ keepScroll: true });
  }
});

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => { if (e.key === 'touchmap:v1') location.reload(); });
setInterval(() => { document.getElementById('live-dot').hidden = !timer.running(); }, 1000);

initMinibar();
route();
startSync();

// Warn before closing the tab mid-touch (the timer would survive, but say so).
window.addEventListener('beforeunload', (e) => {
  if (timer.running()) { e.preventDefault(); e.returnValue = ''; }
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
