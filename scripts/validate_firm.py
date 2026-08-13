#!/usr/bin/env python3
"""Validate a firm org-chart JSON against the parsed NOC/SOC data.

  python3 scripts/validate_firm.py data/firms/commercial-bank.json

Checks: JSON parses; required fields; one governance root; every role's
`reports` resolves; no cycles; every non-governance role has valid NOC (5-digit,
exists) and SOC (4-digit, exists) codes; regulators present for ca+uk;
each dotted ref resolves to `reg:<n>` or a role id. Prints title of each
mapped code so a human can eyeball semantic fit. Exits 1 on any error.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')


def load_units(name):
    out = {}
    ddir = os.path.join(DATA, name, 'd')
    for fn in os.listdir(ddir):
        out.update(json.load(open(os.path.join(ddir, fn)))['units'])
    return out


def main(path):
    errs, warns = [], []
    firm = json.load(open(path))
    noc, soc = load_units('noc'), load_units('soc')

    for f in ('id', 'name', 'industry', 'archetype', 'species', 'governance', 'regulators', 'saplings', 'roles'):
        if f not in firm:
            errs.append(f'missing top-level field: {f}')
    roles = firm.get('roles', [])
    ids = [r['id'] for r in roles]
    if len(ids) != len(set(ids)):
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        errs.append(f'duplicate role ids: {dupes}')
    byid = {r['id']: r for r in roles}

    roots = [r for r in roles if r.get('reports') is None]
    if len(roots) != 1:
        errs.append(f'expected exactly 1 root (governance board), found {len(roots)}: {[r["id"] for r in roots]}')
    elif roots[0].get('kind') != 'governance':
        errs.append(f'root {roots[0]["id"]} must have kind:"governance"')

    reg_names = set()
    for country in ('ca', 'uk'):
        regs = firm.get('regulators', {}).get(country, [])
        if not (2 <= len(regs) <= 6):
            warns.append(f'regulators.{country}: {len(regs)} entries (expect 2-6)')
        for rg in regs:
            for f in ('n', 'full', 'what'):
                if not rg.get(f):
                    errs.append(f'regulator {rg} missing {f}')
            reg_names.add(rg.get('n'))
            for t in rg.get('touch', []):
                if t not in byid:
                    errs.append(f'regulator {rg.get("n")}: touch "{t}" not a role id')

    for r in roles:
        rid = r.get('id', '?')
        for f in ('id', 'title', 'division'):
            if not r.get(f):
                errs.append(f'role {rid}: missing {f}')
        rep = r.get('reports')
        if rep is not None and rep not in byid:
            errs.append(f'role {rid}: reports "{rep}" not found')
        # cycle check
        seen, cur = set(), rid
        while cur is not None:
            if cur in seen:
                errs.append(f'reporting cycle at {cur}'); break
            seen.add(cur)
            cur = byid.get(cur, {}).get('reports')
        if r.get('kind') == 'governance':
            continue
        nc, sc = r.get('noc'), r.get('soc')
        if not nc or nc not in noc:
            errs.append(f'role {rid}: bad NOC code {nc!r}')
        if not sc or sc not in soc:
            errs.append(f'role {rid}: bad SOC code {sc!r}')
        if nc in noc and sc in soc:
            print(f'  {rid:28s} NOC {nc} {noc[nc]["t"][:38]:40s} SOC {sc} {soc[sc]["t"][:38]}')
        for d in r.get('dotted', []):
            if d.startswith('reg:'):
                if d[4:] not in reg_names:
                    errs.append(f'role {rid}: dotted regulator {d} not in regulators list')
            elif d not in byid:
                errs.append(f'role {rid}: dotted ref {d} not found')
        if not r.get('acc'):
            warns.append(f'role {rid}: no acc[] accountabilities')

    n = len([r for r in roles if r.get('kind') != 'governance'])
    print(f'\n{firm.get("id")}: {len(roles)} nodes ({n} coded roles)')
    for w in warns:
        print('  WARN:', w)
    for e in errs:
        print('  ERROR:', e)
    print('VALIDATION:', 'PASS' if not errs else 'FAIL')
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main(sys.argv[1])
