// The signed-in person, top right: initials that open a small menu with the profile,
// Admin (for admins) and Log out. Logging out starts the profile setup again on next sign-in,
// with the previous answers filled in; logged touches stay on the device and in the team log.
import { state, save } from './store.js';
import { session, signOut, isAdmin } from './auth.js';
import { h, clear, icon, confirmBox } from './ui.js';
import { openTutorials } from './tutorials.js';

const initials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

export async function logOut({ ask = true } = {}) {
  if (ask) {
    const ok = await confirmBox({ title: 'Log out?', body: 'Your touches stay on this device and in the team log. Next time, sign in and set up your plant, line and name again.', ok: 'Log out' });
    if (!ok) return;
  }
  signOut();
  if (state.profile) state.profile = { ...state.profile, at: null };
  save();
  location.hash = '#login';
  location.reload();
}

let menuEl = null;
function closeMenu() {
  menuEl?.remove(); menuEl = null;
  document.getElementById('avatar')?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', outside, true);
  document.removeEventListener('keydown', onEsc);
}
function outside(e) { if (menuEl && !menuEl.contains(e.target) && !e.target.closest?.('#avatar')) closeMenu(); }
function onEsc(e) { if (e.key === 'Escape') closeMenu(); }

function openMenu(btn) {
  const p = state.profile || {};
  const admin = isAdmin();
  menuEl = h('div', { class: 'user-menu', role: 'menu', 'aria-label': 'Your account' },
    h('div', { class: 'um-head' },
      h('span', { class: 'um-av', text: initials(p.name) }),
      h('div', {}, h('strong', { text: p.name || (admin ? 'Admin' : 'Signed in') }),
        h('span', { class: 'muted small', text: [p.plantName, p.lineCustom ? p.lineName : p.line].filter(Boolean).join(' · ') || (admin ? 'All plants' : '') }),
        admin ? h('span', { class: 'um-role' }, icon('shield'), 'Admin') : null)),
    h('a', { class: 'um-item', role: 'menuitem', href: '#welcome', onclick: closeMenu }, icon('user'), 'Your profile'),
    admin ? h('a', { class: 'um-item', role: 'menuitem', href: '#admin', onclick: closeMenu }, icon('shield'), 'Admin: all plants') : null,
    h('a', { class: 'um-item', role: 'menuitem', href: '#setup', onclick: closeMenu }, icon('gear'), 'Setup'),
    h('button', { type: 'button', class: 'um-item', role: 'menuitem', onclick: () => { closeMenu(); openTutorials(); } }, icon('graduation-cap'), 'Tutorials'),
    h('button', { type: 'button', class: 'um-item danger', role: 'menuitem', onclick: () => { closeMenu(); logOut(); } }, icon('logout'), 'Log out'));
  document.body.append(menuEl);
  const r = btn.getBoundingClientRect();
  menuEl.style.top = `${r.bottom + 8 + window.scrollY}px`;
  menuEl.style.right = `${Math.max(8, document.documentElement.clientWidth - r.right)}px`;
  btn.setAttribute('aria-expanded', 'true');
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onEsc); }, 0);
  menuEl.querySelector('.um-item')?.focus();
}

/** Keep the initials in the header current. */
export function paintAvatar() {
  const btn = document.getElementById('avatar');
  if (!btn) return;
  btn.hidden = !session();
  const name = state.profile?.name || (isAdmin() ? 'Admin' : '');
  clear(btn, h('span', { text: initials(name) }));
  btn.setAttribute('aria-label', `${name || 'Account'}: profile and log out`);
  btn.title = name ? `${name} · profile and log out` : 'Profile and log out';
  if (!btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => (menuEl ? closeMenu() : openMenu(btn)));
  }
}
