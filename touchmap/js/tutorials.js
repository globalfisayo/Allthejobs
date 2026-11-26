// Short tutorial videos, one per page. Each pops up the first time this device opens that page
// (admin pages for admins only); all of them are in the profile menu under Tutorials.
// The videos stream from media/tutorials/ (not cached for offline use: they are large).
import { state, save, timer, isPassiveCopy } from './store.js';
import { isAdmin } from './auth.js';
import { h, clear, icon, openModal, closeModal } from './ui.js';

export const TUTORIALS = [
  { id: 'capture', route: 'capture', title: 'Capture a touch', ico: 'timer', secs: 69,
    blurb: 'Start the stopwatch, say where, who and why, and save: the category is worked out for you.' },
  { id: 'log', route: 'log', title: 'The Log', ico: 'list', secs: 60,
    blurb: 'Every touch of the run: open one to fix it, swipe to delete, and see whose touch is whose.' },
  { id: 'guide', route: 'guide', title: 'The Guide', ico: 'book-open', secs: 61,
    blurb: 'The line with every machine numbered: tap one to see the touches that happen there.' },
  { id: 'line', route: 'diagram', title: 'Edit the production line', ico: 'pencil', secs: 64, admin: true,
    blurb: 'Draw machines, connect them, number them and save the drawing for your line (admins).' },
  { id: 'analysis', route: 'analysis', title: 'Analysis', ico: 'chart', secs: 74,
    blurb: 'Tap a number to put it on the map, tap a machine for its story, and set the Pareto’s columns.' },
  { id: 'setup', route: 'setup', title: 'Setup: touch types and people', ico: 'gear', secs: 67, admin: true,
    blurb: 'Add a type of touch, give it an icon, and add the people roles you observe (admins).' },
];
export const tutorialSrc = (t) => `media/tutorials/${t.id}.mp4`;
export const tutorialPoster = (t) => `media/tutorials/${t.id}.jpg`;
const tutorialThumb = (t) => `media/tutorials/${t.id}-thumb.jpg`;

const record = () => (state.tutorials && typeof state.tutorials === 'object' ? state.tutorials : (state.tutorials = {}));
const seen = (id) => !!record()[id]?.seen;
function mark(id, key) {
  const r = record();
  r[id] = { ...(r[id] || {}), [key]: r[id]?.[key] || new Date().toISOString() };
  save();
}
/** Pop-ups are skipped under test automation, unless a test asks for them. */
function popupsOn() {
  let pref = null;
  try { pref = localStorage.getItem('touchmap:tutorials'); } catch { /* storage blocked */ }
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  return !navigator.webdriver;
}

/** The first visit to a page on this device: offer its tutorial once. */
export function maybeTutorial(route) {
  const t = TUTORIALS.find(x => x.route === route);
  if (!t || seen(t.id) || (t.admin && !isAdmin()) || isPassiveCopy() || !popupsOn()) return;
  let tries = 0;
  const show = () => {
    if (document.body.dataset.route !== route || document.getElementById('modal')?.open || document.body.classList.contains('present') || timer.running()) return;
    // let a message (say the welcome after setting up) finish first
    const msg = document.getElementById('toast');
    if (msg && !msg.hidden && tries++ < 12) { setTimeout(show, 500); return; }
    mark(t.id, 'seen');
    openTutorial(t.id, { first: true });
  };
  setTimeout(show, 900);
}

function player(t, { first = false, onBack = null, onNext = null } = {}) {
  const video = h('video', { class: 'tut-video', controls: true, playsinline: true, preload: 'metadata', poster: tutorialPoster(t), 'aria-label': `Tutorial video: ${t.title}` },
    h('source', { src: tutorialSrc(t), type: 'video/mp4' }));
  video.addEventListener('play', () => mark(t.id, 'watched'), { once: true });
  video.addEventListener('error', () => video.replaceWith(h('p', { class: 'tut-missing' }, icon('cloudOff'), 'This video needs a connection. Try again when the tablet is online.')), true);
  const n = TUTORIALS.indexOf(t);
  const next = TUTORIALS.slice(n + 1).find(x => !x.admin || isAdmin());
  return h('div', { class: 'tut-player' },
    h('div', { class: 'wiz-top' },
      h('h2', {}, icon(t.ico), ` ${t.title}`),
      h('div', { class: 'row-gap' },
        onBack ? h('button', { type: 'button', class: 'btn ghost small', onclick: onBack }, icon('list'), 'All tutorials') : null,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close')))),
    h('div', { class: 'tut-frame' }, video),
    h('p', { class: 'tut-blurb', text: t.blurb }),
    first ? h('p', { class: 'muted small tut-later' }, icon('graduation-cap'), 'Shown once. Watch it again any time: tap your initials, top right, then Tutorials.') : null,
    h('div', { class: 'row-end' },
      first ? h('button', { type: 'button', class: 'btn ghost', onclick: () => { for (const x of TUTORIALS) mark(x.id, 'seen'); closeModal(); } }, 'Don’t show tutorials') : null,
      first ? h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Later') : null,
      !first && next && onNext ? h('button', { type: 'button', class: 'btn ghost', onclick: () => onNext(next) }, `Next: ${next.title}`, icon('chevronRight')) : null,
      h('button', { type: 'button', class: 'btn primary', onclick: () => { video.play()?.catch(() => {}); } }, icon('circle-play'), 'Play')));
}

/** One tutorial in a dialog. */
export function openTutorial(id, { first = false } = {}) {
  const t = TUTORIALS.find(x => x.id === id);
  if (!t) return;
  const box = h('div', { class: 'confirm tut-modal' });
  const show = (x, f = false) => clear(box, player(x, { first: f, onNext: (y) => show(y) }));
  show(t, first);
  openModal(box, { label: `Tutorial: ${t.title}` });
}

const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** Every tutorial, from the profile menu. */
export function openTutorials() {
  const box = h('div', { class: 'confirm tut-modal' });
  const show = (t) => clear(box, player(t, { onBack: list, onNext: show }));
  const list = () => clear(box,
    h('div', { class: 'wiz-top' }, h('h2', {}, icon('graduation-cap'), ' Tutorials'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('p', { class: 'muted small', text: 'A minute or so each, on a tablet like yours. Music on: turn the sound up.' }),
    h('ul', { class: 'tut-list' }, TUTORIALS.map((t, i) => {
      const r = record()[t.id] || {};
      return h('li', {}, h('button', { type: 'button', class: 'tut-item', 'data-tut': t.id, onclick: () => show(t) },
        h('span', { class: 'tut-thumb' }, h('img', { src: tutorialThumb(t), alt: '', loading: 'lazy' }), h('span', { class: 'tut-play' }, icon('circle-play'))),
        h('span', { class: 'tut-txt' },
          h('span', { class: 'tut-n muted small', text: `${i + 1} of ${TUTORIALS.length}${t.secs ? ' · ' + dur(t.secs) : ''}${t.admin ? ' · admins' : ''}` }),
          h('strong', { text: t.title }),
          h('span', { class: 'muted small', text: t.blurb })),
        r.watched ? h('span', { class: 'tut-done', title: 'Watched' }, icon('check')) : null));
    })));
  list();
  openModal(box, { label: 'Tutorials' });
}
