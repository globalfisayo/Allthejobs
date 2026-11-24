// Make the hash for a Touch Map login, to paste into js/auth.js (LOGINS).
// Usage: node tools/hash-login.mjs <username> <password>
import { webcrypto } from 'node:crypto';
import { hashLogin } from '../js/auth.js';

const [user, pass] = process.argv.slice(2);
if (!user || !pass) {
  console.error('Usage: node tools/hash-login.mjs <username> <password>');
  process.exit(1);
}
console.log(await hashLogin(user, pass, webcrypto.subtle));
