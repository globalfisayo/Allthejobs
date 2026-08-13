/* about.js — the method, the sources, the roadmap */
import { getMeta, getFirmIndex } from './data.js';

export async function renderAbout(el) {
  const [meta, firms] = await Promise.all([getMeta(), getFirmIndex()]);
  const totalRoles = firms.reduce((a, f) => a + f.roles, 0);

  el.innerHTML = `
  <div class="about">
    <h1 class="serif">How this garden grows</h1>
    <p class="lede">An attempt to map all the jobs in the world — grouped into their families,
    grown into the organograms of archetypal firms, and rooted in the two great public taxonomies of work.</p>

    <h2 class="serif">The soil: official classifications</h2>
    <div class="panel">
      <p>Everything here grows from two government systems, ingested in full from their official files:</p>
      <ul>
        <li>🇨🇦 <b>NOC 2021 Version 1.0</b> (Statistics Canada / ESDC) — all
          <b>${meta.noc.counts['1']}</b> broad categories › <b>${meta.noc.counts['2']}</b> major groups ›
          <b>${meta.noc.counts['3']}</b> sub-major groups › <b>${meta.noc.counts['4']}</b> minor groups ›
          <b>${meta.noc.counts['5']}</b> unit groups, with lead statements, main duties, employment
          requirements, TEER levels, exclusions and <b>${meta.noc.exampleTitles.toLocaleString()}</b> example job titles.</li>
        <li>🇬🇧 <b>SOC 2020</b> (Office for National Statistics) — all
          <b>${meta.soc.counts['1']}</b> major groups › <b>${meta.soc.counts['2']}</b> sub-major groups ›
          <b>${meta.soc.counts['3']}</b> minor groups › <b>${meta.soc.counts['4']}</b> unit groups, with
          descriptions, entry routes &amp; qualifications, tasks and related titles.</li>
      </ul>
      <p>Fidelity is checked mechanically: the build fails if any level count drifts from the official structure.
      The 🇨🇦/🇬🇧 toggle re-reads every card and swaps each tree's regulators — the organogram itself barely changes,
      which is rather the point: <em>a bottler is a bottler on either side of the Atlantic; only the sky differs.</em></p>
    </div>

    <h2 class="serif">The trees: twelve archetypal firms</h2>
    <div class="panel">
      <p>Each industry bed grows one flagship firm-type — ${firms.length} so far, holding
      <b>${totalRoles}</b> mapped roles. Every role carries a real NOC unit group <i>and</i> a real SOC unit
      group (validated against the source data), a reporting line, and its own accountabilities.
      The governance layer crowns each tree — a Board of Directors (or Governors, where that is the tradition) —
      and the <b>regulators float as clouds</b>, tied to the board and to the roles they watch by dotted lines.</p>
      <p>Reporting lines are honest archetypes, not laws of nature: many jobs can answer to more than one chair.
      Each card says so.</p>
    </div>

    <h2 class="serif">The cards: STAR</h2>
    <div class="panel">
      <div class="star-legend">
        <div class="row"><span class="star-badge" style="background:#4a8fd4">S</span>
          <span><b>Skills</b> — distilled from the verbs of the official duty lists (labelled as derived).</span></div>
        <div class="row"><span class="star-badge" style="background:var(--green)">T</span>
          <span><b>Tasks</b> — the official main duties (NOC) or task lists (SOC), verbatim.</span></div>
        <div class="row"><span class="star-badge" style="background:var(--gold)">A</span>
          <span><b>Accountable for</b> — the role's ownership in this firm, plus the official lead statement.</span></div>
        <div class="row"><span class="star-badge" style="background:var(--bark)">R</span>
          <span><b>Requirements</b> — official employment requirements (NOC) or entry routes &amp; qualifications (SOC).</span></div>
      </div>
    </div>

    <h2 class="serif">What's planted next</h2>
    <div class="panel">
      <ul>
        <li><b>Batch 2 — more trees per bed:</b> the grey saplings (investment bank, hedge fund, pharma
        manufacturer, rail operator…) grow into full organograms, ${firms.reduce((a, f) => a + f.saplings.length, 0)} firm-types queued.</li>
        <li><b>Batch 3 — richer cards:</b> wage bands, employment counts and outlooks joined from public
        labour-market datasets; job-description phrasing indexed from large public employers.</li>
        <li><b>Batch 4 — more skies:</b> further countries whose classifications crosswalk to these
        (O*NET/SOC-US, ISCO-08), with their own regulator clouds.</li>
      </ul>
    </div>

    <h2 class="serif">Licences &amp; thanks</h2>
    <div class="panel">
      <p>Adapted from Statistics Canada, National Occupational Classification (NOC) 2021 Version 1.0,
      under the <a href="https://www.statcan.gc.ca/en/reference/licence" target="_blank" rel="noopener">Statistics Canada Open Licence</a>.
      This does not constitute an endorsement by Statistics Canada.</p>
      <p>Contains public sector information (ONS, SOC 2020) licensed under the
      <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">Open Government Licence v3.0</a>.</p>
      <p>Built as a static, dependency-free site — the whole garden is JSON and hand-drawn SVG.</p>
    </div>
  </div>`;
}
