# Touch Map · K3

A touch-mapping web app for the line, built for iPad and phone. It replaces the
*K3 Touch Mapping Template* workbook's capture-and-analyse loop:

- **Time** each touch with a big stopwatch.
- **Answer** zone, planned/unplanned, category, type of touch, touch type, count,
  duration and an optional task description while the stopwatch runs.
- **See** the template's Analysis sheet rebuild itself as charts.

It works offline after the first visit, so patchy Wi-Fi on the line doesn't matter.

**Live (once GitHub Pages is on):** `https://globalfisayo.github.io/Allthejobs/touchmap/`

## On the line

1. Open the link in Safari on the iPad, then **Share → Add to Home Screen**. It opens
   full-screen like an app and keeps working with no signal.
2. **Runs** tab: every observation is kept here as a card showing date, observed time,
   operators, touches and coverage. **New observation** starts the next one and offers
   to finish the current one first.
   - **Fill in the run's details** in its collapsible groups: Observation run,
     **Operators observed** (the names become "Person observed" on Capture),
     Observation time & finish, Reference frame, Export & backup.
   - **Reference capacity** defaults to 4 × 11.5 h = 46 op-hours, or can be based on the
     observed time.
   - Put your name in **Setup (gear) → This device**.
3. **Capture** tab: press **Start touch** when the touch begins, then tap the answers:

   | Control | What it does |
   |---|---|
   | **+1** | Counts a repeat (each part, each fallen bottle) without stopping the clock. |
   | **Next touch** | Saves this touch and starts timing the next one at the same instant. A change of reason is a new touch, even without a pause. |
   | **Stop → Save touch** | Ends the touch. Saving checks that every required answer is filled. |
   | **The timer covers** | *All occurrences* divides the time by Count. *One occurrence* means you timed one and counted the rest. |
   | **Save untimed** | For touches under 5 seconds: count them, don't time them. |
   | **Help me choose** | Walks the framework's 15-question category order and stops at the first yes. |
   | **Same as last** | Copies the previous touch's answers. |

   Picking a type of touch shows its *How to count* guide and pre-selects the guide's
   Physical/Information answer, with a warning if you change it. The stopwatch survives
   a reload or a locked screen, and the screen stays awake while it runs.

   **The stopwatch bar is on every screen.** From the Log, Analysis, Runs, Guide or Setup
   you can start, stop, add a count, go to the **Next** touch or save, then tap the bar to
   answer the questions on Capture. Saving with answers missing opens Capture with them
   highlighted.
4. **Log** tab: **swipe a touch left to delete it** (with Undo) or **right to edit it**,
   or tap it to open the editor. A short swipe springs back, and scrolling up and down
   works as normal. Touches saved with **Next touch** that still need answers are flagged
   *Needs details*.
5. **Analysis** tab: everything on the template's Analysis sheet, interactive, for one
   run, several, or all. See [Analysis and presenting](#analysis-and-presenting).
6. **Finish observation** (Runs → Observation time & finish): fixes the run and opens its
   **summary report**, with:
   - observed time, touches, mapped time, coverage, the gap and the planned share;
   - top categories, types, zones and people, and a day-by-day table;
   - data-quality notes.

   **Print / PDF** produces a clean one-pager.
7. **Guide** tab, for new touch mappers (sections collapse):
   - **The K3 line: tap a zone.** A drawing of the line (preform feed → ErgoBloc block
     with blow moulder, labeller, filler and capper → coder → inspection → conveyors →
     packer → palletiser, plus mixer, CIP, line-side store and control room).
   - **Tap any zone** for the touches that typically happen there, grouped by category,
     each with its *How to count* guide. **Log this touch** opens Capture with zone,
     category, type and touch type already filled.
   - **Every machine** also lists the touches that can happen anywhere: safety, CIL, PM,
     breakdowns and defects.
   - **This run** shades each zone by the minutes logged there and badges it with the
     touch count. Tapping a zone shows what was logged.
   - Also on the tab: the How-to-use rules, the decision order, and every type's counting
     guide, all searchable.

## Team sync: one log across every phone and tablet

Without sync, each device keeps its own log in its browser. A touch logged on an iPhone
won't appear on a Samsung tablet. **Team sync** fixes that. Every device writes to one
**Google Sheet your team owns**, which matches the template's "one shared workbook for the
whole observation team". The sheet doubles as a live Observation Log.

**Set up once per team** (about 5 minutes, easiest on a computer):

1. Create a Google Sheet, e.g. *K3 Touch Map · team log*.
2. In it: **Extensions → Apps Script**. Delete what's there and paste
   [`sync/apps-script.gs`](sync/apps-script.gs). The app's **Copy the script** button
   copies it for you. Save.
3. **Deploy → New deployment → Web app**. Set *Execute as: Me* and *Who has access:
   Anyone*. Deploy, allow the permissions, and copy the Web app URL (it ends in `/exec`).
4. In Touch Map: **Setup (gear) → Team sync**, paste the URL and press **Connect**.
5. Press **Share join link** and send it to every other device. Opening the link asks
   "Join the team log?". One tap and that device is in.

**How it behaves:**

- **Offline-first.** Logging never waits for the network. Changes queue on the device,
  and the pill in the app bar shows *Synced*, *n waiting* or *Offline*.
- **When it syncs:** after each change, when the app comes back to the foreground, when
  the signal returns, and every 30 seconds while the app is open. Other devices' touches
  appear within about half a minute.
- **Edits and deletes travel too.** If two people edit the same touch, the most recent
  edit wins. Undoing a delete brings the touch back on every device.
- **The demo run never leaves the device.**
- **The sheet:**
  - *Touches* holds the template's columns, sorted by run and time.
  - *Runs*, *Deleted* and *Settings* (the team's Setup) are the app's bookkeeping.
  - Don't edit those tabs by hand. Build pivots and charts on new tabs.
- **The pill turns green** with a cloud-tick when everything is synced.
- **Access.** Anyone with the Web app URL can read and add touches, like a shared document
  link, so share it only with the team. For an extra lock, set `TEAM_KEY` in the script and
  type the same key on each device.
- **Workspace accounts.** If your Google account is a work (Google Workspace) account,
  your admin may not allow "Anyone" access. A personal Google account always can.

## Observation time

Each run's observed time is worked out from the touches: **first to last touch on each
day**, added up across days. A run spread over two shifts doesn't count the night in
between. You can also set a start and end by hand under *Set the time by hand*.
Optionally, the reference capacity can use it: *Capacity based on → Observed time* gives
operators × observed hours, less the same share of breaks as a full shift.

## Setup (gear icon)

- **Touch types.** Every planned (P) and unplanned (U) category with its types:
  - add a touch type, with its touch type, its *How to count* text and where it happens;
  - edit or rename a type (logged touches follow the rename);
  - hide a type from Capture (logged touches keep it);
  - add a category (P9, U8 and so on);
  - **Reset to default** returns to the K3 template.

  Added types appear on Capture and on the Guide map.
- **Zones / areas** and **People & roles.** Add a newly installed area here.
- **Colours.** Planned, Unplanned, Physical, Information, and an optional colour per
  equipment zone. Badges, buttons, charts and the Guide diagram follow straight away, and
  badge text switches between white and black to stay readable.
- **Team sync** (below), and **This device**: your observer name, the demo run, and
  export/import of the setup as a file.

The defaults are exactly the template's framework. With Team sync, Setup changes reach
every device: touch types, zones, people, colours, the line diagram, chart types and chart
notes. They
need the **updated sync script** (version 2). If your sheet runs the
first version, paste the new `sync/apps-script.gs` into Apps Script, then **Deploy →
Manage deployments → Edit → Version: New version → Deploy**. The web app URL stays the
same. Until then, Setup changes stay on the device where they were made, and **Export
setup / Import setup** moves them by file.

## The line diagram (Guide → Edit diagram)

The Guide's line map is an editable drawing, so it can follow changes on the line.

- **Shapes:** rectangles (with rounded corners), circles and ellipses, triangles, diamonds
  and hoppers.
- **Text:** a text tool, and text inside any shape (double-tap it).
- **Lines and arrows:**
  - they **snap to the four dots on a shape and follow it** when it moves;
  - straight or elbow;
  - solid, dashed or dotted;
  - arrowheads at either or both ends.
- **Images and icons:** upload or paste images (resized to at most 1200 px); icons from the
  app's set.
- **Styling:** colours for fill, line and text, thickness, opacity, front/back, duplicate,
  align several shapes.
- **Editing:** snap to grid and to other shapes' edges and centres; undo/redo (Ctrl/Cmd+Z);
  pan with the hand tool or two fingers; zoom with a pinch, Ctrl+scroll or the buttons.
  Keyboard shortcuts: V select, R rectangle, O ellipse, T text, L line, A arrow, Delete,
  Ctrl/Cmd+D duplicate.
- **Zone link:** link a shape to a zone and tapping it in the Guide opens that zone's
  touches. *This run* shades linked shapes by minutes logged.
- **Export:** PNG or SVG.
- **Reset:** returns to the default K3 line.

The Guide always follows the touch types. Each type carries the zones where it happens
(and whether it can happen on any machine), so a type added, renamed or hidden in Setup
shows up, moves or disappears on the map straight away. Set a type's zones in
Setup → Touch types → edit a type.

## Analysis and presenting

The Analysis tab rebuilds the template's Analysis sheet and goes further:

- **Headline:** coverage against the reference frame, mapped vs capacity, and the
  unexplained gap.
- **Donuts** for an at-a-glance share: planned vs unplanned, physical vs information, and
  where the minutes go (the top five categories, plus Other).
- **Which lever applies:** a 2 × 2 of Planned/Unplanned × Physical/Information. Each
  quadrant shows its minutes and lever (automate by design, digitalise, fix reliability).
- **When in the shift:** minutes by start hour, stacked planned/unplanned.
- **By category:** a Pareto with the top three called out, or P1 → U7 order.
- **By zone** and **by person**.
- **Where × why:** a zone × category heatmap.
- **Types of touch:** a table you can sort by total minutes, by frequency (automation
  candidates), or by minutes per touch.

**Runs.** The **Runs** button at the top picks one run, several, or all. **Analyse
together** on the Runs tab does the same. With more than one run, a *Runs compared* card
shows each run's planned/unplanned minutes and coverage side by side, for observations
done on different days.

**Chart types.** Every chart has a small switch to change how it is drawn:

| Chart | Options |
|---|---|
| Planned vs unplanned, Physical vs information | Donut, bars, columns, table |
| Where the minutes go, By category, By zone | Bars, columns, **Pareto**, donut, table |
| When in the shift | Stacked columns, **columns + line**, lines, table |
| Runs compared | Bars, columns, lines, table |
| Types of touch | Sortable table, bars, Pareto |

The chosen type is remembered for the team.

**Pareto, an exception to "one axis".** It is the one chart with two scales. Minutes show
as columns on the left axis. The running share shows as a line on its own clearly
labelled 0–100% axis on the right, with an 80% mark. That's the standard Lean Pareto,
used to pick the few categories that make the most minutes. Every other combined chart
uses a single unit.

**Notes on charts.** The ✎ on a chart adds text, arrows, lines, shapes, icons, and images
you upload or paste, drawn over the chart. Notes are positioned relative to the chart, so
they stay in place on a phone or a projector. They print with the page and are shared with
the team.

**Filters.** A filter bar sets day, observer,
planned/unplanned, category, zone, touch type and person. **Every chart is also a
filter:** tap a donut slice, a bar, a quadrant, an hour or a heatmap cell and the whole
page narrows to it. Each chart keeps showing its own alternatives, with the chosen one
highlighted, so you can switch quickly. **Present** hides the app chrome, goes full
screen and enlarges everything for a meeting room screen.

## Getting files out

Files are for the K3 workbook, other tools and off-device backups:

| Export | Use it for |
|---|---|
| **Download .xlsx** | Sheets *Observation Log*, *Run Info* and *Analysis*. Log columns A–O match the template exactly, with category names identical to its drop-downs, so rows paste straight into the K3 workbook and its SUMIFs pick them up. Extra columns P–T: person observed, observer, status, logged-at, ID. |
| **Backup .json** | Merging devices without Team sync. Each observer exports one; one person imports them all with **Import / merge**. Touches are matched by ID, the newer edit wins, and nothing is deleted. |
| **CSV** | Other tools. Prefer .xlsx for Excel, because Excel in a decimal-comma locale misreads CSV numbers. |

On iPad, **Share…** sends a file to AirDrop, Mail, Teams or Files.

Without Team sync, export at the end of every shift: clearing the browser's website data
deletes the touches on that device. With Team sync, the Google Sheet holds the shared copy.

## Not yet included

- **Elimination route.** Each touch already carries `To be decided`, and every export
  includes the column. Assigning routes and the *By elimination route* block will be
  added for the workshop.

## The framework

`js/framework-data.js` is the template's **Lists** sheet:

- 15 zones and 10 people;
- the 15 categories (P1–P8, U1–U7);
- 74 types of touch, each with its default touch type and counting guide.

`js/framework.js` holds the decision order and the How-to-use wording. Edit those two
files to change the framework. Zones and people can also be edited in
**Setup → Zones / areas** (shared with the team), and touch types under **Setup → Touch types**.

Two adjustments were made to the source:

- Category names follow the Observation Log drop-downs where the Detailed block words
  them differently. For example, *P7: Material replenishment (same SKU)* rather than
  *Material Supply & Return*.
- *Line speed & packer* had no guide text in the sheet, so it shares the next row's
  guide (speed and packer settings).

Which touches happen at which zone is authored from the guide texts, because the framework
itself doesn't say. The default is in `js/zonemap.js`, and each type carries its zones from
there. Change them in Setup without code. A test fails if any of the 74 types is left
unplaced or misspelled.

## Development

No build step and no dependencies: plain HTML, CSS and ES modules.

```bash
python3 -m http.server 8080          # from the repo root, then open http://localhost:8080/touchmap/
cd touchmap && npm test               # model, analysis, export and sync-script tests (Node 18+)
node tests/mock-sync-server.mjs 8790  # local stand-in for the Apps Script; connect to http://127.0.0.1:8790/exec
```

| Path | What it holds |
|---|---|
| `js/stopwatch.js`, `js/minibar.js` | One shared stopwatch; the bar on every screen |
| `js/runs.js`, `js/report.js` | Runs history and details; the summary report |
| `js/setup.js` | Setup: touch framework editor, zones, people, sync, device |
| `js/linemap.js`, `js/zonemap.js` | The Guide map card and zone popups; the default zone for each of the 74 types |
| `js/board.js` | The whiteboard: shapes, connectors, snapping, images, undo/redo, export |
| `js/diagram.js` | The default K3 line as shapes, and the diagram editor page |
| `js/charts.js`, `js/annotate.js` | Chart renderers behind the type switch; notes drawn over charts |
| `js/colors.js` | Team colours applied as CSS variables |
| `js/swipe.js` | Swipe left/right on log rows |
| `js/sync.js`, `js/sync-ui.js` | Team sync: change queue and merge, Run card, join link |
| `sync/apps-script.gs` | The Google Sheets side of Team sync, pasted into Apps Script |
| `tests/fake-sheets.mjs`, `tests/mock-sync-server.mjs` | Run the real `.gs` against an in-memory sheet, and serve it locally for browser tests |
| `index.html`, `css/app.css` | Shell and styles |
| `js/app.js` | Router |
| `js/capture.js`, `js/form.js` | Stopwatch dock and context form |
| `js/log.js`, `js/insights.js`, `js/guide.js` | Log, Analysis and Guide |
| `js/model.js`, `js/analysis.js`, `js/export.js` | Pure logic, covered by the tests |
| `js/xlsx.js` | Small .xlsx writer, no library |
| `js/store.js` | localStorage persistence and the stopwatch state |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen app |

When you change a file, bump `VERSION` in `sw.js`. Installed copies refresh on the next
launch after they've been online.

Brand colours only (Coca-Cola red `#F40009`, white and black); no logos or trademarks.
Chart colours are checked for colour-blind separation:

- Planned `#1E63B8` and Unplanned `#F40009`;
- Physical `#6250D6` and Information `#159A6A`;
- magnitude: a single red ramp.
