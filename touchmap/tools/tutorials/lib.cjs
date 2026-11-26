// Recording studio: the app runs in a tablet frame (studio.html); a CDP screencast is piped to
// ffmpeg at a constant frame rate. Helpers move a finger, tap, type, zoom and caption.
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');
const BASE = process.env.TM_BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.TUT_OUT || require('path').join(require('os').tmpdir(), 'touchmap-tutorials');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function openStudio({ admin = false, name = 'Alex Popa' } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.route(BASE + '__studio.html', r => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(__dirname + '/studio.html') }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '__studio.html');
  await page.evaluate((u) => { document.getElementById('app').src = u; }, BASE);
  await sleep(800);
  const frame = await (await page.$('#app')).contentFrame();
  await frame.waitForSelector('#login-user');
  await frame.fill('#login-user', 'CCH'); await frame.fill('#login-pass', admin ? process.env.TM_ADMIN_PASS : process.env.TM_USER_PASS); await frame.click('.gate-go');
  if (admin) {
    await frame.waitForFunction(() => document.body.dataset.route === 'admin');
  } else {
    await frame.waitForSelector('.ob-step');
    for (let i = 0; i < 3; i++) await frame.click('.ob-step.open .ob-foot .btn');
    await frame.fill('#ob-name', name); await frame.click('.ob-step.open .btn.primary');
    await frame.waitForFunction(() => document.body.dataset.route === 'capture');
  }
  return { browser, ctx, page, frame, errors };
}

/** Load the demo run (and optionally a touch from another device) without showing it. */
async function seedDemo(frame, { foreign = false } = {}) {
  await frame.evaluate(() => { location.hash = '#setup'; });
  await sleep(400);
  await frame.click('[data-grp="setup-device"] > summary');
  await frame.click('text=Load a demo run');
  await sleep(300);
  if (foreign) {
    await frame.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('touchmap:v1'));
      const run = s.runs[s.activeRunId];
      const base = run.touches.slice(-3);
      base.forEach((t, i) => run.touches.push({ ...t, id: 'tablet2-' + i, device: 'tablet-2', observer: 'Maria (tablet 2)', start: t.start, description: 'Logged on another tablet' }));
      localStorage.setItem('touchmap:v1', JSON.stringify(s));
    });
    await frame.evaluate(() => location.reload());
    await sleep(900);
  }
  await frame.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; });
}

function recorder(page, file, fps = 30) {
  let cdp, ff, last = null, t0 = null, next = 0, frames = 0, done;
  return {
    async start() {
      cdp = await page.context().newCDPSession(page);
      ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
      done = new Promise(r => ff.on('close', r));
      cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
        const buf = Buffer.from(data, 'base64');
        const ts = metadata.timestamp;
        if (t0 == null) { t0 = ts; last = buf; return; }
        const t = ts - t0;
        while (next <= t) { ff.stdin.write(last); frames++; next += 1 / fps; }
        last = buf;
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1440, everyNthFrame: 1 });
      await sleep(300);
    },
    elapsed() { return t0 == null ? 0 : Date.now() / 1000 - t0; },
    async stop() {
      await cdp.send('Page.stopScreencast');
      const t = Date.now() / 1000 - t0;
      while (next <= t) { ff.stdin.write(last); frames++; next += 1 / fps; }
      ff.stdin.end();
      await done;
      return { frames, seconds: frames / fps };
    },
  };
}

/** The script's verbs. */
function verbs(page, frame) {
  const S = (fn, ...a) => page.evaluate(({ fn, a }) => window.studio[fn](...a), { fn, a });
  const rectOf = async (sel, { scroll = true } = {}) => {
    const loc = typeof sel === 'string' ? frame.locator(sel).first() : sel;
    if (scroll) {
      const off = await loc.evaluate(el => { const r = el.getBoundingClientRect(); return r.top < 70 || r.bottom > innerHeight - 90; });
      if (off) { await loc.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(750); }
    }
    return loc.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  };
  const v = {
    sleep,
    cap: (n, html) => S('cap', n, html),
    rectOf,
    async point(sel, { dx = 0.5, dy = 0.5 } = {}) { const r = await rectOf(sel); await S('fingerTo', r.x + r.width * dx, r.y + r.height * dy); await sleep(650); return r; },
    async tap(sel, { dx = 0.5, dy = 0.5, after = 450, force = false } = {}) {
      const loc = typeof sel === 'string' ? frame.locator(sel).first() : sel;
      const r = await rectOf(loc);
      await S('fingerTo', r.x + r.width * dx, r.y + r.height * dy); await sleep(650);
      await S('tapFx');
      await sleep(120);
      if (force) {
        const q = await page.evaluate(([x, y]) => window.studio.toPage(x, y), [r.x + r.width * dx, r.y + r.height * dy]);
        await page.mouse.click(q.x, q.y);
      } else await loc.click({ position: { x: r.width * dx, y: r.height * dy }, timeout: 8000 });
      await sleep(after);
    },
    async type(sel, text, { delay = 75 } = {}) { await v.tap(sel, { after: 200 }); await frame.locator(sel).first().pressSequentially(text, { delay }); await sleep(300); },
    fingerHide: () => S('fingerHide'),
    async zoom(sel, maxZ = 1.9) { if (!sel) { await S('zoom', null); await sleep(1050); return; } const r = typeof sel === 'object' && 'x' in sel ? sel : await rectOf(sel); await S('zoom', r, maxZ); await sleep(1050); },
    async ring(sel) { if (!sel) return S('ring', null); const r = await rectOf(sel); return S('ring', r); },
    /** Drag from one app point to another, finger and mouse together. */
    async drag(a, b, { steps = 18, hold = 150 } = {}) {
      await S('fingerTo', a.x, a.y); await sleep(650);
      const pa = await page.evaluate(([x, y]) => window.studio.toPage(x, y), [a.x, a.y]);
      await page.mouse.move(pa.x, pa.y); await S('tapFx'); await page.mouse.down(); await sleep(hold);
      for (let i = 1; i <= steps; i++) {
        const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
        const p = await page.evaluate(([x, y]) => window.studio.toPage(x, y), [x, y]);
        await page.mouse.move(p.x, p.y);
        await page.evaluate(([x, y]) => { const f = document.getElementById('finger'); f.style.transition = 'none'; window.studio.fingerTo(x, y); }, [x, y]);
        await sleep(28);
      }
      await page.mouse.up();
      await page.evaluate(() => { document.getElementById('finger').style.transition = ''; });
      await sleep(400);
    },
    /** Tap at an app point (not an element). */
    async tapAt(p, { after = 400 } = {}) {
      await S('fingerTo', p.x, p.y); await sleep(650); await S('tapFx');
      const q = await page.evaluate(([x, y]) => window.studio.toPage(x, y), [p.x, p.y]);
      await page.mouse.click(q.x, q.y); await sleep(after);
    },
    async scroll(y) { await frame.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y); await sleep(800); },
    async scrollTo(sel, block = 'start') { await frame.locator(sel).first().evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'smooth' }), block); await sleep(850); },
    async go(hash) { await frame.evaluate((h) => { location.hash = h; }, hash); await sleep(700); },
  };
  return v;
}

/** Intro → body → outro, recorded; then the music and a poster are added. */
async function produce({ id, n, total, title, sub, outro, outroSub, initials = 'AP', admin = false, foreign = false, setup, body }) {
  const studio = await openStudio({ admin });
  const { page, frame, browser, errors } = studio;
  await page.evaluate(() => { try { localStorage.setItem('touchmap:tutorials', 'off'); } catch {} });
  if (setup) await setup(frame, studio);
  await page.evaluate(({ k, t, s }) => { window.studio.setIntro(k, t, s); window.studio.showIntro(); }, { k: `Touch Map · Tutorial ${n} of ${total}`, t: title, s: sub });
  await sleep(300);
  const raw = `${OUT}/${id}.raw.mp4`;
  fs.mkdirSync(OUT, { recursive: true });
  const rec = recorder(page, raw);
  await rec.start();
  await sleep(2600);
  await page.evaluate(() => window.studio.hideIntro());
  await sleep(900);
  const v = verbs(page, frame);
  await body(v, frame, page);
  await v.cap(0, null); await v.fingerHide(); await v.zoom(null);
  await page.evaluate(({ t, s, i }) => window.studio.showOutro(t, s, i), { t: outro || 'That’s it.', s: outroSub || '', i: initials });
  await sleep(3600);
  const r = await rec.stop();
  await browser.close();
  console.log(id, 'raw', r.seconds.toFixed(1), 's', errors.length ? 'ERRORS ' + errors.join(' | ') : '');
  return { raw, seconds: r.seconds };
}

module.exports = { openStudio, seedDemo, recorder, verbs, produce, sleep, BASE };
