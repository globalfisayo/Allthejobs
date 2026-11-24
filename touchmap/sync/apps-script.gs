/**
 * Touch Map · team sync, stored in a Google Sheet your team owns.
 *
 * Set up once (about 5 minutes, easiest on a computer):
 *   1. Create a Google Sheet, e.g. "K3 Touch Map · team log".
 *   2. Extensions → Apps Script. Delete what is there and paste this whole file. Save.
 *   3. Deploy → New deployment → Select type: Web app.
 *        Execute as: Me        Who has access: Anyone
 *      Deploy, allow the permissions, and copy the Web app URL (it ends in /exec).
 *   4. In Touch Map: Setup (gear icon) → Team sync → paste the URL → Connect.
 *      Then "Share join link" to connect every other phone and tablet.
 *
 * The sheet fills four tabs: Touches (a live Observation Log), Runs, Deleted and Settings
 * (the team's touch framework and lists from Setup). Do not edit those tabs by hand:
 * build pivots and charts on other tabs instead.
 * Anyone with the Web app URL can read and add touches, so share it only with the team.
 * For an extra lock, set TEAM_KEY below and type the same key on each device.
 *
 * After changing this script: Deploy → Manage deployments → Edit → Version: New version.
 */
var TEAM_KEY = '';

var TOUCH_COLS = ['Run', 'Zone / equipment', 'Planned / Unplanned', 'Category', 'Type of Touch in Category', 'Touch type',
  'Start timestamp', 'End timestamp', 'Duration (seconds)', 'Count', 'Duration per occurrence (min)', 'Total minutes',
  'Task description', 'Elimination route', 'Person observed', 'Observer', 'Status'];
var RUN_COLS = ['Run', 'Line', 'Plant', 'Window from', 'Window to', 'Formats / SKUs', 'Changeovers', 'CIPs', 'Observers',
  'Operators', 'Shift (h)', 'Break (h)', 'Shifts', 'Reference capacity (op-h)'];
var META_COLS = ['ID', 'Rev', 'Data'];
var DEL_COLS = ['Kind', 'ID', 'Run ID', 'Deleted at', 'Rev'];
var DATE_COLS = { 'Start timestamp': true, 'End timestamp': true };
var SETTINGS_COLS = ['Key', 'Updated', 'Rev', 'Data'];
var CHUNK = 40000;   // a cell holds 50,000 characters; long setups span rows

function doGet() {
  return json_({ ok: true, app: 'touchmap-sync', v: 2 });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'The request was not valid JSON.' }); }
  if (TEAM_KEY && body.key !== TEAM_KEY) return json_({ ok: false, error: 'Wrong team key.' });
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    return json_(sync_(SpreadsheetApp.getActiveSpreadsheet(), body, Date.now()));
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function newer_(a, b) { return String(a || '') > String(b || ''); }

/** One sync: apply the device's changes (newest edit wins), then return everything changed since its last sync. */
function sync_(ss, body, now) {
  var runs = table_(ss, 'Runs', RUN_COLS.concat(META_COLS), 'item');
  var touches = table_(ss, 'Touches', TOUCH_COLS.concat(META_COLS), 'item');
  var dead = table_(ss, 'Deleted', DEL_COLS, 'dead');
  var settings = settings_(ss);
  var maxRev = Math.max(runs.maxRev, touches.maxRev, dead.maxRev, settings.rev);
  var rev = Math.max(now, maxRev + 1);
  var reject = {};

  (body.tombstones || []).forEach(function (tb) {
    if (!tb || !tb.id || (tb.kind !== 'run' && tb.kind !== 'touch')) return;
    var map = tb.kind === 'run' ? runs : touches;
    var cur = map.items[tb.id];
    if (cur && newer_(cur.data.updatedAt, tb.deletedAt)) { reject[tb.id] = true; return; }
    if (cur) { delete map.items[tb.id]; map.changed = true; }
    if (tb.kind === 'run') {
      Object.keys(touches.items).forEach(function (id) {
        var t = touches.items[id].data;
        if (t.runId === tb.id && !newer_(t.updatedAt, tb.deletedAt)) { delete touches.items[id]; touches.changed = true; }
      });
    }
    var d = dead.items[tb.id];
    if (!d || newer_(tb.deletedAt, d.deletedAt)) {
      dead.items[tb.id] = { kind: tb.kind, id: tb.id, runId: tb.runId || '', deletedAt: tb.deletedAt || '', rev: rev };
      dead.changed = true;
    }
  });

  function upsert(map, item, cols) {
    if (!item || !item.id) return;
    var cells = item.cells || [];
    var data = {};
    Object.keys(item).forEach(function (k) { if (k !== 'cells') data[k] = item[k]; });
    var d = dead.items[data.id];
    if (d && !newer_(data.updatedAt, d.deletedAt)) { reject[data.id] = true; return; }
    if (map === touches && dead.items[data.runId] && !newer_(data.updatedAt, dead.items[data.runId].deletedAt)) { reject[data.id] = true; return; }
    var cur = map.items[data.id];
    if (cur && !newer_(data.updatedAt, cur.data.updatedAt)) {
      if (newer_(cur.data.updatedAt, data.updatedAt)) reject[data.id] = true;
      return;
    }
    if (d) { delete dead.items[data.id]; dead.changed = true; }
    var row = cols.map(function (c, i) { return cell_(cells[i], c); });
    map.items[data.id] = { data: data, rev: rev, row: row.concat([data.id, rev, JSON.stringify(data)]) };
    map.changed = true;
  }
  // Setup (touch framework and lists): one shared record, newest wins.
  var settingsRejected = false;
  if (body.settings && body.settings.updatedAt) {
    if (!settings.updatedAt || newer_(body.settings.updatedAt, settings.updatedAt)) {
      settings.updatedAt = body.settings.updatedAt;
      settings.data = JSON.stringify(body.settings.data || {});
      settings.rev = rev;
      settings.changed = true;
    } else if (newer_(settings.updatedAt, body.settings.updatedAt)) {
      settingsRejected = true;
    }
  }

  (body.runs || []).forEach(function (r) { upsert(runs, r, RUN_COLS); });
  (body.touches || []).forEach(function (t) { upsert(touches, t, TOUCH_COLS); });

  // Keep each touch's Run column in step with the run's current name.
  if (runs.changed || touches.changed) {
    Object.keys(touches.items).forEach(function (id) {
      var it = touches.items[id];
      var run = runs.items[it.data.runId];
      if (run && it.row[0] !== run.data.name) { it.row[0] = cell_(run.data.name, 'Run'); touches.changed = true; }
    });
  }

  write_(runs, function (a, b) { return String(a.data.createdAt || '').localeCompare(String(b.data.createdAt || '')); });
  write_(touches, function (a, b) {
    var ra = runs.items[a.data.runId], rb = runs.items[b.data.runId];
    var ka = (ra ? ra.data.createdAt : '') + '|' + (a.data.start || a.data.createdAt || '');
    var kb = (rb ? rb.data.createdAt : '') + '|' + (b.data.start || b.data.createdAt || '');
    return ka.localeCompare(kb);
  });
  write_(dead);
  writeSettings_(settings);

  var since = Number(body.since) || 0;
  var changedAny = runs.changed || touches.changed || dead.changed || settings.changed;
  var out = { ok: true, v: 2, rev: changedAny ? rev : maxRev, runs: [], touches: [], tombstones: [] };
  if (settings.updatedAt && (settings.rev > since || settingsRejected)) {
    try { out.settings = { updatedAt: settings.updatedAt, data: JSON.parse(settings.data) }; } catch (err) { /* unreadable: skip */ }
  }
  Object.keys(runs.items).forEach(function (id) { var it = runs.items[id]; if (it.rev > since || reject[id]) out.runs.push(it.data); });
  Object.keys(touches.items).forEach(function (id) { var it = touches.items[id]; if (it.rev > since || reject[id]) out.touches.push(it.data); });
  Object.keys(dead.items).forEach(function (id) {
    var d = dead.items[id];
    if (d.rev > since || reject[id]) out.tombstones.push({ kind: d.kind, id: d.id, runId: d.runId, deletedAt: d.deletedAt });
  });
  return out;
}

/** Read a tab into { items: id → { data, rev, row } }, creating it or re-mapping its columns if needed. */
function table_(ss, name, head, kind) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var values = sheet.getDataRange().getValues();
  var t = { sheet: sheet, head: head, kind: kind, items: {}, changed: false, maxRev: 0 };
  var top = values.length ? values[0].map(String) : [];
  if (top.join('\u0001') !== head.join('\u0001')) t.changed = true;
  var col = function (c) { return top.indexOf(c); };
  var idI = col('ID'), revI = col('Rev');
  if (idI < 0) return t;
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    var id = String(v[idI] || '');
    if (!id) continue;
    var rev = Number(v[revI]) || 0;
    if (rev > t.maxRev) t.maxRev = rev;
    if (kind === 'dead') {
      t.items[id] = { kind: String(v[col('Kind')] || ''), id: id, runId: String(v[col('Run ID')] || ''), deletedAt: String(v[col('Deleted at')] || ''), rev: rev };
      continue;
    }
    var data;
    try { data = JSON.parse(v[col('Data')]); } catch (err) { continue; }
    if (!data || !data.id) continue;
    var row = head.map(function (c) { var i = col(c); return i < 0 ? '' : v[i]; });
    t.items[id] = { data: data, rev: rev, row: row };
  }
  return t;
}

function settings_(ss) {
  var sheet = ss.getSheetByName('Settings') || ss.insertSheet('Settings');
  var values = sheet.getDataRange().getValues();
  var out = { sheet: sheet, updatedAt: '', data: '', rev: 0, changed: false };
  var parts = [];
  for (var r = 1; r < values.length; r++) {
    var key = String(values[r][0] || '');
    if (key.indexOf('setup') !== 0) continue;
    out.updatedAt = String(values[r][1] || '');
    out.rev = Math.max(out.rev, Number(values[r][2]) || 0);
    parts.push({ i: Number(key.split(':')[1]) || 0, d: String(values[r][3] || '') });
  }
  parts.sort(function (a, b) { return a.i - b.i; });
  out.data = parts.map(function (p) { return p.d; }).join('');
  return out;
}

function writeSettings_(st) {
  if (!st.changed) return;
  var rows = [SETTINGS_COLS];
  for (var i = 0, n = 0; i < Math.max(1, st.data.length); i += CHUNK, n++) {
    rows.push(['setup:' + n, st.updatedAt, st.rev, st.data.slice(i, i + CHUNK)]);
  }
  st.sheet.clearContents();
  st.sheet.getRange(1, 1, rows.length, SETTINGS_COLS.length).setValues(rows);
  st.sheet.getRange(1, 1, 1, SETTINGS_COLS.length).setFontWeight('bold');
  st.sheet.setFrozenRows(1);
}

function write_(t, sortFn) {
  if (!t.changed) return;
  var list = Object.keys(t.items).map(function (id) { return t.items[id]; });
  if (sortFn) list.sort(sortFn);
  var rows = [t.head].concat(list.map(function (it) {
    if (t.kind === 'dead') return [it.kind, it.id, it.runId, it.deletedAt, it.rev];
    return it.row;
  }));
  t.sheet.clearContents();
  t.sheet.getRange(1, 1, rows.length, t.head.length).setValues(rows);
  t.sheet.getRange(1, 1, 1, t.head.length).setFontWeight('bold');
  t.sheet.setFrozenRows(1);
}

function cell_(v, col) {
  if (v === null || v === undefined) return '';
  if (DATE_COLS[col]) {
    if (!v) return '';
    var d = new Date(v);
    return isNaN(d.getTime()) ? '' : d;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  var s = String(v).slice(0, 5000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;   // never let a description become a formula
}
