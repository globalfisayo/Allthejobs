// Short tutorial videos, one per page, all under Tutorials in the profile menu. Nothing pops up
// page by page: once, when someone finishes setting up (or an admin first signs in), a welcome
// points to the tutorials and can simply be closed.
// The videos stream from media/tutorials/ (not cached for offline use: they are large).
import { state, save, isPassiveCopy } from './store.js';
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
function mark(id, key) {
  const r = record();
  r[id] = { ...(r[id] || {}), [key]: r[id]?.[key] || new Date().toISOString() };
  save();
}
/** The welcome is skipped under test automation, unless a test asks for it. */
function popupsOn() {
  let pref = null;
  try { pref = localStorage.getItem('touchmap:tutorials'); } catch { /* storage blocked */ }
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  return !navigator.webdriver;
}

/* ---------- the welcome, once per device ---------- */
let pending = null;
/** Ask for the welcome after setting up; true when it will show (so no other welcome is needed). */
export function requestWelcome(profile = null) {
  if (record().welcome?.seen || !popupsOn() || isPassiveCopy()) return false;
  pending = { profile };
  return true;
}
/** Called after a page is drawn: shows the welcome if one was asked for. */
export function maybeWelcome() {
  if (!pending) return;
  const { profile } = pending;
  pending = null;
  setTimeout(() => {
    if (document.getElementById('modal')?.open) return;
    mark('welcome', 'seen');
    openWelcome(profile);
  }, 500);
}
function openWelcome(p) {
  const list = TUTORIALS.filter(t => !t.admin || isAdmin());
  const where = p ? [p.plantName, p.lineCustom ? p.lineName : p.line].filter(Boolean).join(' · ') : '';
  const box = h('div', { class: 'confirm welcome-tour' },
    h('div', { class: 'wiz-top' },
      h('span', { class: 'wt-ico' }, icon('graduation-cap')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('h2', { text: p?.name ? `Welcome, ${p.name}` : 'Welcome to Touch Map' }),
    where ? h('p', { class: 'muted', text: `You’re mapping ${where}.` }) : null,
    h('p', { class: 'wt-lead', text: `Watch the tutorials to see how to use the app: ${list.length} short videos, about a minute each.` }),
    h('ul', { class: 'wt-list' }, list.map(t => h('li', {}, icon(t.ico), h('span', { text: t.title })))),
    h('p', { class: 'muted small wt-later' }, icon('info'), 'They are always there: tap your initials, top right, then Tutorials.'),
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => closeModal() }, 'Close'),
      h('button', { type: 'button', class: 'btn primary', onclick: () => openTutorials() }, icon('circle-play'), 'Watch the tutorials')));
  openModal(box, { label: 'Welcome' });
}

function player(t, { onBack = null, onNext = null } = {}) {
  // muted to start (the music is optional): Sound on, or the speaker in the controls, turns it on
  const video = h('video', { class: 'tut-video', controls: true, playsinline: true, muted: true, preload: 'metadata', poster: tutorialPoster(t), 'aria-label': `Tutorial video: ${t.title}` },
    h('source', { src: tutorialSrc(t), type: 'video/mp4' }));
  video.muted = true; video.defaultMuted = true;
  const sound = h('button', { type: 'button', class: 'btn ghost tut-sound', onclick: () => { video.muted = !video.muted; } });
  const paintSound = () => {
    clear(sound, icon(video.muted ? 'volume-x' : 'volume-2'), video.muted ? 'Sound off' : 'Sound on');
    sound.setAttribute('aria-pressed', String(!video.muted));
    sound.title = video.muted ? 'Turn the music on' : 'Turn the music off';
  };
  video.addEventListener('volumechange', paintSound);
  paintSound();
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
    h('div', { class: 'row-end' },
      next && onNext ? h('button', { type: 'button', class: 'btn ghost', onclick: () => onNext(next) }, `Next: ${next.title}`, icon('chevronRight')) : null,
      sound,
      h('button', { type: 'button', class: 'btn primary', onclick: () => { video.play()?.catch(() => {}); } }, icon('circle-play'), 'Play')));
}

const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

/** Every tutorial, from the profile menu. */
export function openTutorials() {
  const box = h('div', { class: 'confirm tut-modal' });
  const show = (t) => clear(box, player(t, { onBack: list, onNext: show }));
  const list = () => clear(box,
    h('div', { class: 'wiz-top' }, h('h2', {}, icon('graduation-cap'), ' Tutorials'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => closeModal() }, icon('close'))),
    h('p', { class: 'muted small', text: 'A minute or so each, on a tablet like yours. They play without sound; tap Sound on for some quiet music.' }),
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
