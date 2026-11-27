# Touch Map · K3

A touch-mapping web app for the line, built for iPad and phone. It replaces the
*K3 Touch Mapping Template* workbook's capture-and-analyse loop:

- **Time** each touch with a big stopwatch.
- **Answer** zone, planned/unplanned, category, type of touch, touch type, count,
  duration and an optional task description while the stopwatch runs.
- **See** the template's Analysis sheet rebuild itself as charts.

It works offline after the first visit, so patchy Wi-Fi on the line doesn't matter.

**Live (once GitHub Pages is on):** `https://globalfisayo.github.io/Allthejobs/touchmap/`

## Who can change what

- **Everyone:** logs touches, and edits or deletes the touches they logged themselves. Each
  touch records the device it was logged on. Other people's touches show with a lock and
  open read-only. Everyone sees all the analysis, the Guide and the runs.
- **Admins** (the admin password) also:
  - edit the Guide drawing (Edit diagram) and the touches at a zone (Edit touches);
  - change the touch types, colours, zones and people in Setup;
  - write notes on charts and set the team's chart types, Pareto columns and Analysis tiles
    (anyone can choose their own; theirs stays on their device);
  - delete runs that hold other people's touches;
  - see All plants.

## Signing in and your profile

- **One shared login for the organisation**, and a second password for admins (no personal
  accounts or e-mail yet). Ask your CI lead for them.
- **First sign-in on a device** walks through a short setup, one step at a time:
  1. **Business unit:** Romania.
  2. **Plant:** Ploiești is live. Timișoara and Poiana Negri show greyed out until they go
     live.
  3. **Production line:** K3 at Ploiești, or type another line.
  4. **Your name.**
  Plant and name are required. Each finished step folds into a one-line summary you can
  change.
- **Tagging:** every run and touch is tagged with that plant and line, and with your name as
  the observer.
- **Changing it later:** the initials at the top right open your profile, Admin (for
  admins) and **Log out**. Logging out starts the setup again at the next sign-in, with your
  previous answers filled in. Logged touches stay. Setup → Your profile does the same.
- **Business units:** Romania is live. Bulgaria, Hungary and Serbia show next, in colour.
  *See all business units* lists the rest of the group, greyed out, until they go live. Edit
  them in `js/org.js`.
- **Changing a password:** run `node tools/hash-login.mjs <username> <password>` and put the
  new hash in `js/auth.js`. Only salted hashes are in the code, never the passwords.
- **What the login does and doesn't do:** it keeps casual visitors out of the app. It is not
  a security boundary, because the site is public. The team's data is protected by the
  Google Sheet's own sharing settings.

## Admin: all plants

Admins see a shield next to the gear. It opens one page for the whole business unit.

- **Drill down** Romania → plant → line → observation. Each level shows its children as
  cards, with hours, touches, the planned share, a planned/unplanned split, the number of
  observations and the last observation date.
- **Charts for the current level:**
  - planned vs unplanned by plant, line, observation or zone;
  - where the minutes go (Pareto, donut or table);
  - physical vs information;
  - by zone;
  - a category heat matrix;
  - the trend by day;
  - the top twelve touch types, with how many plants each appears in;
  - every observation;
  - every observer.
- **Filters:** tap any bar, slice or cell to filter the whole page, and tap it again to
  clear it. The period switch narrows to the last 7, 30 or 90 days.
- **CSV export:** downloads every touch in scope, with business unit, plant and line columns.
- **Demo data:** fills Timișoara and Poiana Negri with believable observations, so the
  roll-out can be presented before they go live. If Ploiești has no real data yet, it gets a
  preview too.
  - Each line has its own profile: one fights breakdowns, one is changeover-heavy, and the
    water lines have no syrup room.
  - The numbers are the same every time, are marked *Demo*, stay on that device, never reach
    the team sheet, and **Clear demo** removes them.
- **Where the data comes from:** everything the device holds. Connect the admin's device to
  the same team log (Setup → Team sync) and it shows every plant that syncs there.

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
   | **Same as last** | Copies the previous touch's answers (zone, person, category…) in one tap. |
   | **Clear** | Empties the form, zone and person included. |

   Every new touch starts fresh at **Zone / equipment**: the first question is always where.
   Picking a category before Planned/Unplanned folds the list to that group; the option you
   tapped stays under your finger rather than jumping away.

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

   **Which run it shows:** the run you're logging into by default. Select a run in **Runs**
   (or tap its **Log** button) and the Log shows that run's history instead. The picker at
   the top switches to any run, or to **All runs**. A note says where new touches go, with
   *Log into this run* and *Back*. Edits and deletes apply to the run the touch belongs to.
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

**One copy at a time on each device.** If the app is open twice on one device (two browser
tabs, or the installed app and a tab), the copy you opened last is the one that logs and
syncs. The other shows *Touch Map is open in another tab* with **Use it here**. Two copies
writing to the same storage would otherwise overwrite each other's touches.

**How fast touches arrive.** While the app is open, it syncs straight after you save a touch,
every 15 seconds, and whenever you come back to it. A touch logged on one device normally
shows on the others within about 15 to 20 seconds. The sync pill shows *n waiting* while
anything is still to be sent.

## Observation time

Each run's observed time is worked out from the touches: **first to last touch on each
day**, added up across days. A run spread over two shifts doesn't count the night in
between. You can also set a start and end by hand under *Set the time by hand*.
Optionally, the reference capacity can use it: *Capacity based on → Observed time* gives
operators × observed hours, less the same share of breaks as a full shift.

## Setup (gear icon)

- **Your profile:** name, business unit, plant and line. Change them or sign out here.
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
every device: touch types, zones, people, colours, the line diagram, the shape library,
chart types and chart notes. They
need the **updated sync script** (version 2). If your sheet runs the
first version, paste the new `sync/apps-script.gs` into Apps Script, then **Deploy →
Manage deployments → Edit → Version: New version → Deploy**. The web app URL stays the
same. Until then, Setup changes stay on the device where they were made, and **Export
setup / Import setup** moves them by file.

## The line diagram (Guide → Edit diagram)

The Guide's line map is an editable drawing, so it can follow changes on the line.

- **Shapes:** rectangles (with rounded corners), circles and ellipses, triangles, diamonds
  and hoppers.
- **Room to draw:**
  - The canvas uses the full width of the screen.
  - The properties panel floats over it only while something is selected.
  - The how-to sits behind the **?** in the corner.
  - **Full screen** (the last toolbar button; Esc to leave) hides everything else.
- **Tools:** hover a tool for its name; hover the ⓘ in that tip for what it does.
- **Equipment numbers:** select a zone-linked shape and set its **Number**. A number that's
  already used swaps places with it, and **Renumber all** closes the gaps. The Guide's black
  badges show the numbers (switch the badges to *Touch types* or *This run*).
- **Line drawings:** the picker next to the title has *Save as a new line* (for example
  Ploiești K5) and *Start a blank line*.
  - Saved drawings are shared with the team.
  - The Guide opens the drawing for your own line, and its picker shows any other line.
- **Groups:** select several shapes (drag a box round them), then **Group** (Ctrl/Cmd+G).
  They move, resize and link to a zone as one piece, such as a filler drawn from rings and
  pockets. **Ungroup** splits it again. Double-tap a group to edit its name.
- **Library:** select a group, name it and **Save**. It goes into the shared library, which
  every device on the team log receives through Setup sync. **Library** in the toolbar
  inserts your team's shapes and the 14 K3 machines.
- **Text:** a text tool, and text inside any shape (double-tap it).
- **Lines and arrows:**
  - they **snap to the four dots on a shape and follow it** when it moves;
  - straight, elbow, rounded elbow or **curved** (the curved arrow tool, C);
  - bendable: drag the small square in the middle of a line to add a bend; drag a bend to
    move it;
  - solid, dashed, dotted or **conveyor** (a belt with flow chevrons);
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
- **Reset:** returns to the default K3 line. The default has the detail of the first Guide
  map: the filler's pockets, the blow moulder's cavities, preforms in the hopper, the
  packer's film, pallet layers and the conveyor's flow. Every machine is an editable group.

**Editing touches from the Guide.** Tap a zone, then **Edit touches**:
- add a touch type there;
- move one to another zone;
- reclassify it into another category, which can switch it between planned and unplanned
  (its logged touches move with it);
- take it off the zone;
- hide or delete it.

Every change except reclassifying has Undo, and all of them are shared with the team.

**Icons.** Machines, people, planned/unplanned, categories and touch types have icons on
Capture, the Log, Analysis and the Guide. They come from the free Lucide set (ISC licence).
- **New categories:** get an icon suggested from their name, which you can change in Setup →
  Touch types → Edit category.
- **Zones:** tap a zone's icon in Setup → Zones to change it.

**Capture shows where you are.** The question being answered is outlined in black with a red
dot. Answered ones get a green tick. The ones still to come are greyed, though they still
work if tapped. Once you pick an option, the others fade back. The Person observed choices
use the run's operator names when they're set in Runs.

The Guide always follows the touch types. Each type carries the zones where it happens
(and whether it can happen on any machine), so a type added, renamed or hidden in Setup
shows up, moves or disappears on the map straight away. Set a type's zones in
Setup → Touch types → edit a type.

## Analysis and presenting

The Analysis tab, from the top:

- **Filters** for runs, days, observers, planned/unplanned, categories, zones, touch type
  and person. **Present** (the presenter icon) goes full screen for a meeting room.
- **Three tiles**, by default touches, mapped minutes and the biggest category.
  - Tap **Touches** or **Mapped minutes** to put that measure on the process map *and* the
    Pareto. Each card can still choose its own measure; tapping a tile again brings both
    back in line.
  - Tap a tile that names something (biggest category, busiest machine, biggest type of
    touch, planned share…) to filter the page to it; tap again to clear.
  - The pencil on a tile changes what it shows: touches, mapped minutes, op-hours, biggest
    category, biggest type of touch, busiest machine, planned share, unplanned minutes,
    physical share or minutes per touch. A user's choice stays on their device; an admin's
    becomes the team's default.
- **The process map:** the line drawing, shaded from white (nothing) to Coca-Cola red (the
  most).
  - **Show:** touches, time in minutes, or logged events. **Planned / unplanned** filters
    the whole page.
  - Badges grow a little under the pointer.
  - Tap a machine for its numbers: touches, minutes, events, its share of all minutes, the
    planned/unplanned and physical split, the types taking the most time, and who. **Tap a
    type** under *Where the time goes here* to open its log: each touch's time, person,
    who logged it, minutes, count and the comment typed (a speech-bubble count shows which
    types have comments). The guide's touch list for that machine is folded underneath. In
    the Guide's machine pop-up, the run's logged types open the same way.
  - From there, *Filter Analysis to this machine* or *Log a touch here*.
- **Planned vs unplanned** and **Physical vs information.**
- **By category:**
  - It's a Pareto by default: biggest first, top three marked, with the cumulative share in
    the table. **Rank by** minutes or touches (it follows the tiles until you choose).
  - **Columns**, left to right by default: the code chip (P1 … U8), the icon, the category,
    the type of touch (for a category, its biggest one, "+3" for the others) and the bar.
    Drag a column's name sideways to move it, or tap its × to hide it. Drag the thin line
    at the right edge of a column's name to make it wider or narrower (double-tap the line to
    reset it; *Reset column widths* in the columns panel resets them all). The columns button
    (next to the chart types) lists them all: tick to show or hide, drag the handle or use
    the arrows to reorder, and choose what the bar shows: %, minutes, touches, any one, two
    or all three. The number it is ranked by comes first, in bold. A user's columns stay on
    their device; an admin's become the team's default. The admin page's category Pareto
    has the same columns, rank-by and Categories / All types switch.
  - On a phone the bar moves under the names, full width.
  - Tap *Planned (P)* or *Unplanned (U)* in its legend to filter the page.
  - Tap a category (or a type of touch) to filter the page to it: the page scrolls up to the
    process map, which then shows only that category and says so (*Showing: P7 …*, tap it
    to show everything again).
  - **All types** opens the categories up into every type of touch (P1 Parts change, P1
    Loading recipe and so on); **Categories** folds them back.
- **Advanced charts** (the button at the end of the filters; on a phone, under Present):
  - which lever applies;
  - when in the shift;
  - by zone and by person;
  - where × why;
  - runs compared, when several runs are selected.

**Runs.** The **Runs** button at the top picks one run, several, or all. **Analyse
together** on the Runs tab does the same. With more than one run, a *Runs compared* card
shows each run's planned/unplanned minutes and coverage side by side, for observations
done on different days.

**Chart types.** Every chart has a small switch to change how it is drawn:

| Chart | Options |
|---|---|
| Planned vs unplanned, Physical vs information | Donut, bars, columns, table |
| By category (and its types), By zone | **Pareto**, bars, columns, donut, table |
| When in the shift | Stacked columns, lines, table |
| Runs compared | Bars, columns, lines, table |

An admin's choice is the team's default; anyone else's choice stays on their own device.

**Pareto** is drawn as the Analysis sheet had it: bars biggest first, with the top three
marked. Each bar's details give its rank and the cumulative share. A table underneath lists
the cumulative share row by row. There is no cumulative line on a second axis.

**Notes on charts** (admins). The ✎ on a chart adds text, arrows, lines, shapes, icons, and images
you upload or paste, drawn over the chart. **Full screen** in the notes toolbar gives the
chart the whole screen while you annotate. Notes are positioned relative to the chart, so
they stay in place on a phone or a projector. They print with the page and are shared with
the team.

**Filters.** A filter bar sets day, observer,
planned/unplanned, category, zone, touch type and person. **Every chart is also a
filter:** tap a donut slice, a bar, a quadrant, an hour or a heatmap cell and the whole
page narrows to it. Each chart keeps showing its own alternatives, with the chosen one
highlighted, so you can switch quickly. **Present** hides the app chrome, goes full
screen and enlarges everything for a meeting room screen.

## Tutorials

Six videos of a minute or so each, recorded on a tablet in portrait: Capture, the Log, the
Guide, editing the production line, Analysis, and Setup (touch types and people). The line
editor and Setup ones are for admins.

Nothing pops up page by page. Once, when someone finishes setting up their profile (or an
admin first signs in on a device), a welcome says to watch the tutorials, with **Watch the
tutorials** and **Close**. After that they are always in the profile menu (your initials, top
right) under **Tutorials**. They play without sound; **Sound on** (or the speaker in the
video's controls) brings in quiet music.

The videos stream from `media/tutorials/` and are not kept for offline use (they are about
4 MB each). The music is "Calm Piano 1 (Vaporware)" by The Cynic Project, CC0 (public
domain). To record
them again after a screen changes, see `tools/tutorials/README.md`.

## Times

Times on screen use a 12-hour clock: 4:00 pm, and *4 pm* on the hour axis of *When in the
shift*. Exports (CSV, Excel, the team sheet) keep the 24-hour form (16:00) so the data sorts
and calculates the same everywhere.

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
| `js/setup.js` | Setup: profile, touch framework editor, zones, people, sync, device |
| `js/auth.js`, `tools/hash-login.mjs` | The shared logins (salted hashes) and the tool that makes a hash |
| `js/org.js` | Business units → plants → lines; which plants are live |
| `js/icons-lib.js`, `js/iconmap.js` | Curated Lucide icons (ISC), and which icon goes with each zone, person and category |
| `js/usermenu.js` | The initials menu: profile, Admin, Log out |
| `js/onboard.js` | Sign-in page and the step-by-step profile setup |
| `js/admin.js`, `js/demo-org.js` | Admin: all plants with drill-down; demo data for plants not live yet |
| `js/linemap.js`, `js/zonemap.js` | The Guide map card and zone popups; the default zone for each of the 74 types |
| `js/board.js` | The whiteboard: shapes, groups, connectors with bends, snapping, images, library, undo/redo, export |
| `js/diagram.js` | The default K3 line as grouped machines, the built-in library, and the diagram editor page |
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
