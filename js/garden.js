/* garden.js — the home view: hero sky, twelve beds, teasers */
import { getFirmIndex, getMeta, esc } from './data.js';
import { heroSVG, bedScene } from './trees.js';

export async function renderGarden(el) {
  const [firms, meta] = await Promise.all([getFirmIndex(), getMeta()]);
  const totalRoles = firms.reduce((a, f) => a + f.roles, 0);

  el.innerHTML = `
  <div class="garden">
    <section class="garden-hero" aria-label="The garden">
      ${heroSVG()}
      <div class="hero-copy">
        <h1>Every job under the sun</h1>
        <p>A living garden of work — twelve firms grown as trees, every branch a team,
           every leaf a job, every root in the official classifications.</p>
        <div class="hero-stats">
          <span class="stat-pill">🇨🇦 <strong>${meta.noc.counts['5']}</strong> NOC unit groups</span>
          <span class="stat-pill">🇬🇧 <strong>${meta.soc.counts['4']}</strong> SOC unit groups</span>
          <span class="stat-pill">🌳 <strong>${firms.length}</strong> firm trees · <strong>${totalRoles}</strong> mapped roles</span>
          <span class="stat-pill">🔎 <strong>${(meta.noc.exampleTitles + meta.soc.relatedTitles).toLocaleString()}</strong> searchable job titles</span>
        </div>
      </div>
    </section>

    <section class="beds" aria-label="Industry beds">
      ${firms.map((f, i) => `
        <button class="bed" data-firm="${f.id}" aria-label="Open ${esc(f.name)} — ${f.roles} roles">
          ${bedScene(f, i)}
          <span class="bed-info">
            <span class="bed-industry">${esc(f.industry)}</span>
            <span class="bed-name serif">${esc(f.name)}</span>
            <span class="bed-tagline">${esc(f.tagline)}</span>
            <span class="bed-meta">
              <span class="bed-count">${f.roles} roles</span>
              <span class="bed-saplings">🌱 ${f.saplings.length} firm-types to come</span>
              <span class="bed-cta">Explore →</span>
            </span>
          </span>
        </button>`).join('')}
    </section>

    <section class="garden-lower">
      <button class="teaser" data-go="#/atlas">
        <h2>The Atlas 📖</h2>
        <p>The complete field guide: every occupation in NOC 2021 (${meta.noc.counts['1']} → ${meta.noc.counts['2']} → ${meta.noc.counts['3']} → ${meta.noc.counts['4']} → ${meta.noc.counts['5']})
        and SOC 2020 (${meta.soc.counts['1']} → ${meta.soc.counts['2']} → ${meta.soc.counts['3']} → ${meta.soc.counts['4']}), properly nested, each opening a full STAR card.</p>
        <span class="go">Browse the full taxonomy →</span>
      </button>
      <button class="teaser alt" data-go="#/about">
        <h2>How this garden grows 🫘</h2>
        <p>The method: official sources, the STAR card model, how the trees are drawn,
        and what's planted next — more firm-types in every bed.</p>
        <span class="go">Read the method →</span>
      </button>
    </section>

    <footer class="attribution">
      <p>🇨🇦 Adapted from Statistics Canada, National Occupational Classification (NOC) 2021 Version 1.0.
      This does not constitute an endorsement by Statistics Canada.
      &nbsp;·&nbsp; 🇬🇧 Contains public sector information licensed under the
      <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener">Open Government Licence v3.0</a>
      (ONS, Standard Occupational Classification 2020).
      &nbsp;·&nbsp; Organograms are archetypes: reporting lines are typical, not universal.</p>
    </footer>
  </div>`;

  el.querySelectorAll('.bed').forEach(b =>
    b.addEventListener('click', () => { location.hash = `#/firm/${b.dataset.firm}`; }));
  el.querySelectorAll('.teaser').forEach(t =>
    t.addEventListener('click', () => { location.hash = t.dataset.go; }));
}
