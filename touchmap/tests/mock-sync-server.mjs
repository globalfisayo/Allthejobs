// Local stand-in for the Apps Script web app (same script, in-memory sheet), for browser tests.
// Usage: node tests/mock-sync-server.mjs 8790   → sync URL http://127.0.0.1:8790/exec
import http from 'node:http';
import { loadAppsScript } from './fake-sheets.mjs';

const port = Number(process.argv[2] || 8790);
const gs = loadAppsScript();
http.createServer((req, res) => {
  const send = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };
  if (req.method === 'GET' && req.url.startsWith('/sheet')) return send(Object.fromEntries([...gs.sheets].map(([k, s]) => [k, s.cells])));
  if (req.method === 'GET') return send(gs.get());
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => { try { send(gs.post(JSON.parse(body))); } catch (e) { send({ ok: false, error: e.message }); } });
}).listen(port, '127.0.0.1', () => console.log(`mock sync on http://127.0.0.1:${port}/exec`));
