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
2. **Run** tab: fill in Run Info and the reference frame (operators, shift length, break,
   shifts covered). This sets the reference capacity (4 × 11.5 h = 46 op-hours by default),
   and every mapped total is compared against it. Put your name in *Observer on this device*.
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
4. **Log** tab: tap a touch to edit or delete it. Touches saved with **Next touch** that
   still need answers are flagged *Needs details*.
5. **Analysis** tab: covers everything on the template's Analysis sheet:
   - headline coverage against the reference frame;
   - planned vs unplanned;
   - by category, as a Pareto with the top three called out;
   - by touch type;
   - by zone.

   It adds the top types of touch and person observed, filters by day and observer when
   there is more than one, and has a table behind every chart.
6. **Guide** tab: the How-to-use rules, the decision order, and every type's counting
   guide, all searchable.

## Getting data out, and merging a team

Touches are stored **in the browser on each device** (localStorage). Nothing is sent
anywhere. Each observer's device holds its own log, so:

| Export | Use it for |
|---|---|
| **Download .xlsx** | Sheets *Observation Log*, *Run Info* and *Analysis*. Log columns A–O match the template exactly, with category names identical to its drop-downs, so rows paste straight into the K3 workbook and its SUMIFs pick them up. Extra columns P–T: person observed, observer, status, logged-at, ID. |
| **Backup .json** | Merging the team. Each observer exports one; one person imports them all with **Import / merge**. Touches are matched by ID, the newer edit wins, and nothing is deleted. |
| **CSV** | Other tools. Prefer .xlsx for Excel, because Excel in a decimal-comma locale misreads CSV numbers. |

On iPad, **Share…** sends a file to AirDrop, Mail, Teams or Files. Export at the end of
every shift: clearing Safari's website data deletes the touches on that device.

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
files to change the framework. Zones and people can also be edited per device in
**Run → Lists**.

Two adjustments were made to the source:

- Category names follow the Observation Log drop-downs where the Detailed block words
  them differently. For example, *P7: Material replenishment (same SKU)* rather than
  *Material Supply & Return*.
- *Line speed & packer* had no guide text in the sheet, so it shares the next row's
  guide (speed and packer settings).

## Development

No build step and no dependencies: plain HTML, CSS and ES modules.

```bash
python3 -m http.server 8080          # from the repo root, then open http://localhost:8080/touchmap/
cd touchmap && npm test               # model, analysis, decision tree and export tests (Node 18+)
```

| Path | What it holds |
|---|---|
| `index.html`, `css/app.css` | Shell and styles |
| `js/app.js` | Router |
| `js/capture.js`, `js/form.js` | Stopwatch dock and context form |
| `js/log.js`, `js/insights.js`, `js/run.js`, `js/guide.js` | The other tabs |
| `js/model.js`, `js/analysis.js`, `js/export.js` | Pure logic, covered by the tests |
| `js/xlsx.js` | Small .xlsx writer, no library |
| `js/store.js` | localStorage persistence and the stopwatch state |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and home-screen app |

When you change a file, bump `VERSION` in `sw.js`. Installed copies refresh on the next
launch after they've been online.

Brand colours only (Coca-Cola red `#F40009`, white and black); no logos or trademarks.
Chart colours: Planned `#1E63B8` and Unplanned `#F40009`, checked for colour-blind
separation.
