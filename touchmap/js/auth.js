// Sign-in for the organisation: one shared login for everyone, one for admins, no personal
// accounts or e-mail yet. The site is public, so only salted hashes live here, never the
// passwords. To change a password, run `node tools/hash-login.mjs <username> <password>` and
// paste the new hash below.
//
// This keeps casual visitors out of the app; it is not a security boundary. Anyone with the
// URL can read the code, and the team's data lives in the team's Google Sheet, whose own
// access settings are what protect it.

const KEY = 'touchmap:session';
const SALT = 'touchmap-cch-v1';
const ITERATIONS = 120000;
const SESSION_DAYS = 90;

/** Which role a username + password gives. Same username, two passwords. */
const LOGINS = [
  { role: 'admin', hash: '73057dad7d1f4a3acc7058ee23e8157998cb42a35fb274188427657edf68d446' },
  { role: 'user', hash: '9ffe077a319e216d445a6daacf4db954f486de5357e8a7c92d48d519194fce95' },
];

export async function hashLogin(username, password, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('This browser cannot check the password here. Open the app from its https:// address.');
  const enc = new TextEncoder();
  const key = await subtle.importKey('raw', enc.encode(`${String(username).trim().toLowerCase()}:${password}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(SALT), iterations: ITERATIONS }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Check a login. Resolves to 'admin', 'user' or null. */
export async function checkLogin(username, password) {
  if (!username || !password) return null;
  const hash = await hashLogin(username, password);
  return LOGINS.find(l => l.hash === hash)?.role || null;
}

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

/** The signed-in session on this device, or null. */
export function session() {
  const s = read();
  if (!s || (s.role !== 'user' && s.role !== 'admin')) return null;
  if (!s.at || Date.now() - s.at > SESSION_DAYS * 864e5) return null;
  return s;
}
export const isAdmin = () => session()?.role === 'admin';

export async function signIn(username, password) {
  const role = await checkLogin(username, password);
  if (!role) return null;
  try { localStorage.setItem(KEY, JSON.stringify({ role, at: Date.now() })); } catch { /* private mode: this tab only */ }
  return role;
}

export function signOut() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
