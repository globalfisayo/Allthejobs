# All the Jobs 🌳 — The Garden of Work

**An attempt to map all the jobs in the world**, grouped into their families, grown into the
organograms of archetypal firms, and rooted — with mechanical fidelity — in the two great public
taxonomies of work: Canada's **NOC 2021** and the UK's **SOC 2020**.

**Live site:** https://globalfisayo.github.io/Allthejobs/

> Also hosted in this repo: **[Touch Map · K3](touchmap/)**, an offline touch-mapping
> web app for iPad and phone (stopwatch, K3 category framework, live analysis, Excel export).
> See [`touchmap/README.md`](touchmap/README.md).

## What grows here

- **The Garden** — twelve industry beds, each growing one flagship firm-type as a tree:
  Commercial Bank, Software Company, General Hospital, Supermarket, Beverage Bottler, Automaker,
  Airline, Telecom Operator, Electric Utility, Oil & Gas Producer, Mining Company, Property
  Developer. Grey saplings mark the firm-types still to come.
- **The Trees** — each firm is an organogram rendered as a living tree: the **Board of Directors
  (or Governors)** crowns the apex, the CEO sits at the trunk top, C-suite boughs fan outward,
  departments branch, and every role is a leaf. **Regulators float as clouds** in the sky —
  per industry, per country — tied to the board and the roles they watch by dotted lines.
  A ▦ toggle flips to a traditional Workday-style chart with expand/collapse.
- **The 🇨🇦/🇬🇧 toggle** — flips every code, card and regulator between NOC and SOC. The
  organogram itself barely changes, which is rather the point: a bottler is a bottler on either
  side of the Atlantic; only the sky differs.
- **STAR cards** — every role and every unit group opens a curved card:
  **S**kills (distilled from the official duty verbs, labelled as derived) ·
  **T**asks (official duties, verbatim) ·
  **A**ccountable-for (the role's ownership in this firm + the official lead statement) ·
  **R**equirements (official employment requirements / entry routes).
- **The Atlas** — the complete nested hierarchies:
  NOC 10 → 45 → 89 → 162 → **516 unit groups**, SOC 9 → 26 → 104 → **412 unit groups**.
- **Search** — one box across the 850 garden roles, all 928 unit groups, and **30,000+ real job
  titles** from the official indexes (type "beekeeper").

## Fidelity

The ETL ingests the official files and **fails the build if any level count drifts**:

| System | Source | Levels | Units | Extra riches |
|---|---|---|---|---|
| NOC 2021 V1.0 | Statistics Canada / ESDC | 10 › 45 › 89 › 162 › 516 | 516 ✓ | duties, requirements, TEER, exclusions, 27,935 example titles |
| SOC 2020 | Office for National Statistics | 9 › 26 › 104 › 412 | 412 ✓ | descriptions, entry routes, tasks, 2,091 related titles |

Every one of the **850 firm roles** carries a real NOC unit code *and* a real SOC unit code,
validated against the parsed data (`scripts/validate_firm.py`), plus a reporting line, division
and hand-written accountabilities. Reporting lines are honest archetypes, not laws of nature —
each card says so.

## Architecture

Zero-dependency static site: hand-written HTML/CSS/JS + JSON, hand-drawn SVG. No frameworks,
no build step, no tracking. Data is batched per top-level category and lazy-loaded, so first
paint is a few tens of KB.

```
index.html  css/garden.css  js/*.js     the site
data/noc/   data/soc/                   parsed official taxonomies (batched)
data/firms/                             12 organograms + indexes
scripts/build_data.py                   ETL from official files (stdlib only)
scripts/validate_firm.py                org-chart validator
scripts/lookup.py                       authoring helper: search codes
scripts/build_indexes.py                firm + role indexes
sources/                                the official source files, as downloaded
```

Rebuild everything:

```bash
python3 scripts/build_data.py && python3 scripts/build_indexes.py
for f in data/firms/[a-z]*.json; do case "$f" in */index.json|*/roles-index.json) ;; *) python3 scripts/validate_firm.py "$f" || break;; esac; done
```

Serve locally:

```bash
python3 scripts/devserver.py 8080
```

## What's planted next

1. **Batch 2 — more trees per bed:** the grey saplings (Investment Bank, Hedge Fund, Pharma
   Manufacturer, Rail Operator, …) grow into full organograms — 60 firm-types queued.
2. **Batch 3 — richer cards:** wages, employment counts and outlooks from public labour-market
   data; job-description phrasing indexed from large public employers.
3. **Batch 4 — more skies:** US O*NET/SOC and ISCO-08 crosswalks, with their own regulator clouds.

## Licences & attribution

- Adapted from Statistics Canada, **National Occupational Classification (NOC) 2021 Version 1.0**,
  under the [Statistics Canada Open Licence](https://www.statcan.gc.ca/en/reference/licence).
  This does not constitute an endorsement by Statistics Canada.
- Contains public sector information (ONS, **SOC 2020**) licensed under the
  [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
- Site code: MIT.
