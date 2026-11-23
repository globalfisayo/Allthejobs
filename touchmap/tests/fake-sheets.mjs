// Runs sync/apps-script.gs in Node against an in-memory spreadsheet, so the real
// script is what the tests (and the local mock server) exercise.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const GS = fileURLToPath(new URL('../sync/apps-script.gs', import.meta.url));

function fakeSheet(name) {
  let cells = [];
  return {
    name,
    get cells() { return cells; },
    getDataRange() { return { getValues: () => (cells.length ? cells.map(r => [...r]) : [['']]) }; },
    clearContents() { cells = []; },
    getRange(r, c, nr, nc) {
      return {
        setValues(vals) {
          if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error(`setValues shape mismatch on ${name}`);
          for (let i = 0; i < nr; i++) {
            cells[r - 1 + i] ??= [];
            for (let j = 0; j < nc; j++) {
              const v = vals[i][j];
              // Sheets stores Dates as dates, everything else as given.
              cells[r - 1 + i][c - 1 + j] = v instanceof Date ? new Date(v.getTime()) : v;
            }
          }
        },
        setFontWeight() {},
      };
    },
    setFrozenRows() {},
  };
}

export function loadAppsScript() {
  const sheets = new Map();
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = fakeSheet(n); sheets.set(n, s); return s; },
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    Date, JSON, Math, String, Number, Object, isNaN,
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(GS, 'utf8'), ctx, { filename: 'apps-script.gs' });
  return {
    ss, sheets,
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text),
    get: () => JSON.parse(ctx.doGet().text),
    setKey: (k) => vm.runInContext(`TEAM_KEY = ${JSON.stringify(k)}`, ctx),
  };
}
