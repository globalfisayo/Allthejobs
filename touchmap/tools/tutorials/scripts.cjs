// The six tutorials: what is shown, said and tapped. Run: node scripts.cjs <id>
const { produce, seedDemo, sleep } = require('./lib.cjs');
const TOTAL = 6;
const READ = 2600; // a short caption's reading time

const T = {
  capture: {
    n: 1, title: 'Capture a touch', sub: 'Time it, say where, who and why. About a minute.',
    outro: 'That’s a touch logged.', outroSub: 'Next: the Log, where every touch of the run lives.',
    setup: async (f) => { await seedDemo(f); await f.evaluate(() => { location.hash = '#capture'; }); await sleep(700); },
    async body(v, f, p) {
      await v.cap(1, 'This is <b>Capture</b>. Every touch you see on the line is logged here.');
      await sleep(READ + 600);
      await v.zoom('.dock', 1.5);
      await v.cap(2, 'The moment the operator starts, tap <b>Start touch</b>.');
      await sleep(1200);
      await v.tap('.dock-btns .btn.start');
      await sleep(1400);
      await v.zoom(null);
      await v.cap(3, '<b>Where?</b> Tap the machine or zone.');
      await v.zoom('.q[data-q="zone"]', 1.6);
      await v.tap('.q[data-q="zone"] .chip:has-text("Filler")');
      await sleep(900);
      await v.cap(4, '<b>Who?</b> The person you are watching. Optional.');
      await v.zoom('.q[data-q="who"]', 1.6);
      await v.tap('.q[data-q="who"] .chip:has-text("Ana")');
      await sleep(900);
      await v.cap(5, 'Planned or not? Tap <b>Help me choose</b> and answer yes or no.');
      await v.zoom('.q[data-q="planned"]', 1.6);
      await v.tap('.q[data-q="planned"] .link-btn');
      await sleep(900);
      await v.zoom(null);
      await v.cap(6, '“Would it disappear on a perfect shift?” <b>No</b>: it is planned.');
      await sleep(1600);
      await v.tap('dialog[open] .btn.ghost:has-text("No")');
      await sleep(900);
      await v.cap(7, '“A safety or standard routine?” <b>Yes</b>: category P5.');
      await sleep(1800);
      await v.tap('dialog[open] .btn.primary:has-text("Yes")');
      await sleep(900);
      if (await f.locator('dialog[open] .btn.primary').count()) await v.tap('dialog[open] .btn.primary');
      await sleep(600);
      await v.cap(8, 'Planned and the category are filled in for you.');
      await v.zoom('.q[data-q="category"]', 1.5);
      await sleep(READ);
      await v.cap(9, 'Pick the <b>type of touch</b>. Physical or information comes with it.');
      await v.zoom('.q[data-q="type"]', 1.6);
      await v.tap('.q[data-q="type"] :text("Pre-start & safety device checks")');
      await sleep(1400);
      await v.zoom(null);
      await v.cap(10, 'Same job again? Tap <b>+1</b> for each repeat.');
      await v.zoom('.dock', 1.5);
      await v.tap('.dock-btns .btn.tally');
      await sleep(1600);
      await v.cap(11, 'When it ends, tap <b>Stop</b>…');
      await v.tap('.dock-btns button:has-text("Stop")');
      await sleep(1400);
      await v.cap(12, '…and <b>Save touch</b>. The form clears for the next one.');
      await sleep(1200);
      await v.tap('.dock-btns button:has-text("Save touch")');
      await sleep(1400);
      await v.zoom(null);
      await v.cap(13, 'Saved to the <b>Log</b>, and shared with your team automatically.');
      await v.point('a[data-route="log"]');
      await sleep(READ + 800);
    },
  },

  log: {
    n: 2, title: 'The Log', sub: 'Every touch of the run: fix one, delete one, see whose is whose.',
    outro: 'The Log keeps the run tidy.', outroSub: 'Next: the Guide, the line with every machine numbered.',
    setup: async (f) => { await seedDemo(f, { foreign: true }); await f.evaluate(() => { location.hash = '#log'; }); await sleep(800); },
    async body(v, f, p) {
      await v.cap(1, 'The <b>Log</b> lists every touch of the run, newest first.');
      await sleep(READ + 600);
      await v.cap(2, 'Choose which run to look at here, or all of them.');
      await v.zoom('.run-pick', 1.7);
      await v.point('.run-pick-sel');
      await sleep(READ);
      await v.zoom(null);
      await v.cap(3, 'Filter: the ones that still need details, planned or unplanned.');
      await v.zoom('.filter-row', 1.7);
      await v.tap('.filter-row .chip:has-text("Unplanned")');
      await sleep(1600);
      await v.tap('.filter-row .chip:has-text("All")');
      await sleep(600);
      await v.zoom(null);
      await v.cap(4, 'Touches from another tablet carry a lock: you can look, not change.');
      await v.zoom('.entry.theirs', 1.5);
      await v.tap('.entry.theirs');
      await sleep(READ + 400);
      await p.keyboard.press('Escape'); await sleep(500);
      await v.zoom(null);
      await v.cap(5, 'Tap one of your own touches to fix it.');
      const mine = f.locator('.entry:not(.theirs)').nth(3);
      await v.zoom(mine, 1.5);
      await v.tap(mine);
      await sleep(1200);
      await v.zoom(null);
      await v.cap(6, 'Change any answer, say the count, then <b>Save</b>.');
      const plus = f.locator('dialog[open] button[aria-label*="ncrease"], dialog[open] button[aria-label*="More"], dialog[open] .stepper button:last-child').first();
      if (await plus.count()) { await v.tap(plus); await sleep(700); }
      await sleep(1200);
      await v.tap('dialog[open] .btn.primary:has-text("Save")');
      await sleep(1200);
      await v.cap(7, 'Logged by mistake? Swipe it left to delete…');
      const row = f.locator('.entry:not(.theirs)').nth(1);
      const r = await v.rectOf(row);
      await v.zoom(row, 1.4);
      await v.drag({ x: r.x + r.width - 40, y: r.y + r.height / 2 }, { x: r.x + 60, y: r.y + r.height / 2 }, { steps: 16 });
      await sleep(1200);
      await v.cap(8, '…and <b>Undo</b> brings it back if you change your mind.');
      const undo = f.locator('.toast button:has-text("Undo")');
      if (await undo.count()) { await v.zoom(null); await v.tap(undo); }
      await sleep(1600);
      await v.zoom(null);
      await v.cap(9, 'Everything here feeds <b>Analysis</b> and the team log.');
      await v.point('a[data-route="analysis"]');
      await sleep(READ + 2400);
    },
  },

  guide: {
    n: 3, title: 'The Guide', sub: 'Your line, every machine numbered, and the touches that happen at each.',
    outro: 'The Guide is your map.', outroSub: 'Next: editing the production line (admins).',
    setup: async (f) => { await seedDemo(f); await f.evaluate(() => { location.hash = '#guide'; }); await sleep(900); },
    async body(v, f, p) {
      await v.cap(1, 'The <b>Guide</b> shows your line, with every machine numbered.');
      await v.zoom('.linemap-card', 1.25);
      await sleep(READ + 900);
      await v.cap(2, 'Switch to <b>Touch types</b>: the yellow hands count the touches at each machine.');
      await v.tap('.linemap-card .seg-btn:has-text("Touch types")');
      await sleep(READ + 600);
      await v.cap(3, 'Tap a machine to see what happens there.');
      await v.tap('.linemap-card .bd-zone[data-id="z-fill"]', { force: true });
      await sleep(1300);
      await v.zoom(null);
      await v.cap(4, 'At the top: what was logged here in this run.');
      await v.zoom('dialog[open] .zone-run, dialog[open] .zone-pop', 1.4);
      await sleep(READ + 400);
      await v.zoom(null);
      await v.cap(5, 'Below: every type of touch at this machine, and how to count it.');
      const item = f.locator('dialog[open] .zt').nth(1);
      if (await item.count()) { await v.tap(item); await sleep(READ); } else await sleep(READ);
      await v.cap(6, 'Seeing one now? <b>Log a touch here</b> opens Capture with the machine filled in.');
      const logHere = f.locator('dialog[open] button:has-text("Log a touch here"), dialog[open] a:has-text("Log a touch here")').first();
      if (await logHere.count()) { await v.tap(logHere); await sleep(READ + 600); } else await sleep(READ);
      await v.go('#guide');
      await sleep(400);
      await v.cap(7, 'Under the map: <b>how to use & count</b>, step by step.');
      await v.tap('summary.grp-h >> nth=0');
      await sleep(READ + 600);
      await v.tap('summary.grp-h >> nth=0');
      await v.cap(8, '<b>Which category?</b> Ask the questions in order; the first yes decides.');
      await v.tap('summary.grp-h >> nth=1');
      await sleep(READ + 1200);
      await v.tap('summary.grp-h >> nth=1');
      await v.cap(9, 'And every category with its types, and the rules for counting them.');
      await v.tap('summary.grp-h >> nth=2');
      await sleep(900);
      await v.scrollTo('summary.grp-h >> nth=2', 'start');
      await sleep(READ);
      await v.scroll(0);
      await v.cap(10, 'Not sure while logging? The Guide is one tap away.');
      await v.point('a[data-route="guide"]');
      await sleep(READ + 400);
    },
  },

  line: {
    n: 4, title: 'Edit the production line', sub: 'Draw machines, connect them and save the drawing for your line. For admins.', admin: true, initials: 'A',
    outro: 'Your line, your drawing.', outroSub: 'Next: Analysis, where the minutes go.',
    setup: async (f) => { await f.evaluate(() => { location.hash = '#guide'; }); await sleep(900); },
    async body(v, f, p) {
      await v.cap(1, 'Admins can redraw the line. In the Guide, tap <b>Edit diagram</b>.');
      await v.tap('a:has-text("Edit diagram")');
      await sleep(1600);
      await v.cap(2, 'Tap a machine: its name, zone, number and colours open on the side.');
      await v.tap('.bd-shape[data-id="z-fill"], .bd-zone[data-id="z-fill"]', { force: true });
      await sleep(READ + 400);
      const close = f.locator('.bd-props button[aria-label="Close the panel"]');
      if (await close.count()) await v.tap(close);
      await v.cap(3, 'Add a machine: pick a shape, then drag on the board.');
      await v.tap('button[title="Rectangle (R)"], button[aria-label="Rectangle (R)"]');
      const b = await v.rectOf('.de-board');
      await v.drag({ x: b.x + 150, y: b.y + b.height - 175 }, { x: b.x + 300, y: b.y + b.height - 95 });
      await sleep(900);
      await v.cap(4, 'Name it, and link it to a zone so its touches land on it.');
      const ta = f.locator('.bd-props textarea').first();
      await ta.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await v.type('.bd-props textarea', 'Shrink wrapper 2', { delay: 85 });
      await sleep(600);
      const zs = f.locator('.bd-props select[aria-label="Linked zone"], .bd-props select').last();
      if (await zs.count()) { await zs.evaluate(el => el.scrollIntoView({ block: 'center' })); await v.point(zs); await zs.selectOption({ label: 'Packer / shrink' }).catch(() => {}); }
      await sleep(1400);
      if (await close.count()) await v.tap(close);
      await v.cap(5, 'Connect machines with an arrow: straight, elbow or curved.');
      await v.tap('button[title="Curved arrow (C)"], button[aria-label="Curved arrow (C)"]');
      const pal = await v.rectOf('.bd-zone[data-id="z-pal"], .bd-shape:has-text("Palletiser")', { scroll: false }).catch(() => null);
      const start = pal ? { x: pal.x + pal.width / 2, y: pal.y + pal.height } : { x: b.x + 380, y: b.y + b.height - 260 };
      await v.drag(start, { x: b.x + 300, y: b.y + b.height - 135 }, { steps: 20 });
      await sleep(1200);
      await v.cap(6, 'Made a mistake? <b>Undo</b> is always one tap away.');
      await v.zoom('.bd-toolbar', 1.6);
      await v.point('button[title="Undo (Ctrl/Cmd+Z)"], button[aria-label="Undo (Ctrl/Cmd+Z)"]');
      await sleep(READ - 600);
      await v.zoom(null);
      await v.cap(7, '<b>Full screen</b> gives you the whole tablet to draw on.');
      await v.tap('.bd-fs-btn');
      await sleep(READ + 400);
      await v.tap('.bd-fs-btn');
      await sleep(900);
      await v.cap(8, 'Stuck? The <b>?</b> explains every tool.');
      await v.tap('.bd-help-btn');
      await sleep(READ + 600);
      await v.tap('.bd-help-btn');
      await v.cap(9, 'Each line keeps its own drawing. Pick or save it here…');
      await v.zoom('.de-head', 1.6);
      await v.point('.de-pick, select[aria-label="Line drawing"]');
      await sleep(READ);
      await v.cap(10, '…then tap <b>Done</b>. Everyone on the team sees the new line.');
      await v.tap('.de-head a.btn.primary, a.btn.primary:has-text("Done")');
      await sleep(1400);
      await v.zoom(null);
      await sleep(READ);
    },
  },

  analysis: {
    n: 5, title: 'Analysis', sub: 'Where the time goes, machine by machine, biggest first.',
    outro: 'Now you know where the minutes go.', outroSub: 'Next: Setup, for touch types and people (admins).',
    setup: async (f) => { await seedDemo(f); await f.evaluate(() => { location.hash = '#analysis'; }); await sleep(1000); },
    async body(v, f, p) {
      await v.cap(1, '<b>Analysis</b> fills itself as you log. Three numbers sit at the top.');
      await v.zoom('.an-tiles', 1.5);
      await sleep(READ + 400);
      await v.cap(2, 'Tap <b>Touches</b>: the map and the Pareto switch to touches.');
      await v.tap('.an-tile[data-tile="touches"] .tile-main');
      await sleep(1200);
      await v.zoom(null);
      await v.scrollTo('.pm-card', 'start');
      await sleep(READ);
      await v.scroll(0);
      await v.cap(3, 'The pencil changes what a tile shows: biggest category, busiest machine…');
      await v.zoom('.an-tiles', 1.5);
      await v.tap('.an-tile >> nth=2 >> .tile-edit');
      await sleep(1600);
      await v.zoom(null);
      await v.tap('.tile-picker .tp-opt:has-text("Busiest machine")');
      await sleep(1600);
      await v.cap(4, 'On the map, the redder the machine, the more time it takes.');
      await v.scrollTo('.pm-card', 'start');
      await v.zoom('.pm-card .linemap-scroll', 1.25);
      await sleep(READ);
      await v.cap(5, 'Tap a machine for its story: minutes, split, top types, who.');
      await v.tap('.pm-card .bd-zone[data-id="z-fill"]', { force: true });
      await sleep(900);
      await v.zoom(null);
      await sleep(READ + 600);
      await p.keyboard.press('Escape'); await sleep(600);
      await v.cap(6, '<b>By category</b>: a Pareto, biggest first.');
      await v.scrollTo('.chart-card[data-chart="category"]', 'start');
      await sleep(READ);
      await v.cap(7, 'Drag a column to move it, or <b>×</b> to hide it, say the icons.');
      await v.zoom('.chart-card[data-chart="category"] .rk-head', 1.55);
      await v.tap('.chart-card[data-chart="category"] .rk-hc[data-key="icon"] .rk-hide');
      await sleep(900);
      const code = await v.rectOf('.chart-card[data-chart="category"] .rk-hc[data-key="code"]');
      const cat = await v.rectOf('.chart-card[data-chart="category"] .rk-hc[data-key="category"]');
      await v.drag({ x: code.x + code.width / 2, y: code.y + code.height / 2 }, { x: cat.x + cat.width / 2 + 20, y: cat.y + cat.height / 2 }, { steps: 18 });
      await sleep(1200);
      await v.zoom(null);
      await v.cap(8, 'The <b>columns</b> button: show or hide any column, and pick %, minutes or touches.');
      await v.tap('.chart-card[data-chart="category"] .cols-btn');
      await sleep(900);
      await v.tap('.cols-panel .chip[data-value="minutes"]');
      await sleep(READ);
      await v.tap('.cols-panel .btn:has-text("Use the team")');
      await sleep(700);
      await v.tap('.cols-panel .btn:has-text("Done")');
      await v.cap(9, '<b>All types</b> opens every category up into its types of touch.');
      await v.tap('.chart-card[data-chart="category"] .seg-btn:has-text("All types")');
      await sleep(READ + 200);
      await v.cap(10, 'More in <b>Advanced charts</b>. And <b>Present</b> for the meeting.');
      await v.scroll(0);
      await v.point('.an-head-acts .btn:has-text("Present")');
      await sleep(READ + 600);
    },
  },

  setup: {
    n: 6, title: 'Setup: touch types and people', sub: 'Add a type of touch, give it an icon, add a role. For admins.', admin: true, initials: 'A',
    outro: 'Set up once, shared with everyone.', outroSub: 'Team sync sends your changes to every tablet.',
    setup: async (f) => { await f.evaluate(() => { location.hash = '#setup'; }); await sleep(900); },
    async body(v, f, p) {
      await v.cap(1, 'In <b>Setup</b>, admins shape what everyone logs.');
      await sleep(READ);
      await v.cap(2, '<b>Touch types</b>: each category, with its types of touch.');
      await v.scrollTo('[data-grp="setup-touches"]', 'start');
      await sleep(1200);
      await v.tap('details.fw-cat >> nth=0 >> summary');
      await sleep(1600);
      await v.cap(3, 'Add a new one: <b>Add a touch type</b>…');
      await v.tap('details.fw-cat[open] .fw-actions .btn:has-text("Add a touch type")');
      await sleep(900);
      await v.cap(4, '…give it a name and say how to count it.');
      await v.type('#te-name', 'Robot gripper change', { delay: 80 });
      await v.type('#te-guide', 'One gripper swap is one touch.', { delay: 55 });
      await sleep(600);
      const phys = f.locator('dialog[open] .seg-btn:has-text("Physical")').first();
      if (await phys.count()) { await v.cap(5, 'Physical or information, and where on the line it happens.'); await v.tap(phys); await sleep(1200); }
      await v.tap('dialog[open] .btn.primary:has-text("Save")');
      await sleep(1400);
      const p1 = f.locator('details.fw-cat').first();
      if (!(await p1.evaluate(d => d.open))) await v.tap(p1.locator('summary'));
      await sleep(600);
      await v.cap(6, 'Your new type is there, tagged <b>added</b>, for every tablet.');
      await v.zoom(p1, 1.5);
      await sleep(READ);
      await v.zoom(null);
      await v.cap(7, '<b>Edit category</b>: its name, its guide and its icon.');
      await v.tap('details.fw-cat[open] .fw-actions .btn:has-text("Edit category")');
      await sleep(1200);
      await v.tap('dialog[open] .btn.ghost.small:has-text("Change")');
      await sleep(1000);
      await v.cap(8, 'Pick an icon. One is suggested from the name.');
      await sleep(1400);
      await v.tap('.ip-dialog .ip-btn:not(.on) >> nth=4');
      await sleep(1000);
      await v.tap('dialog[open] .btn.primary:has-text("Save")');
      await sleep(1200);
      await v.cap(9, '<b>People & roles</b>: the roles offered on Capture.');
      await v.scrollTo('[data-grp="setup-people"]', 'start');
      const ppl = f.locator('[data-grp="setup-people"]');
      if (!(await ppl.evaluate(el => el.open))) await v.tap('[data-grp="setup-people"] > summary');
      await sleep(900);
      await v.cap(10, 'Type a new role and tap <b>Add</b>.');
      await v.type('[data-grp="setup-people"] input[aria-label="Add to people"]', 'Line technician', { delay: 80 });
      await v.tap('[data-grp="setup-people"] .add-row .btn');
      await sleep(1400);
      await v.cap(11, '<b>Zones</b> work the same way, each with its own icon.');
      await v.scrollTo('[data-grp="setup-zones"]', 'start');
      const zn = f.locator('[data-grp="setup-zones"]');
      if (!(await zn.evaluate(el => el.open))) await v.tap('[data-grp="setup-zones"] > summary');
      await sleep(READ);
      await v.cap(12, 'With <b>Team sync</b> on, every tablet gets the changes.');
      await v.scrollTo('[data-grp="setup-sync"]', 'start');
      await sleep(READ + 600);
    },
  },
};

module.exports = { T, TOTAL };

if (require.main === module) {
  const id = process.argv[2];
  const t = T[id];
  if (!t) { console.error('which?', Object.keys(T).join(' ')); process.exit(1); }
  produce({ id, total: TOTAL, ...t }).catch(e => { console.error(e); process.exit(1); });
}
