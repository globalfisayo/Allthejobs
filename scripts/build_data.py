#!/usr/bin/env python3
"""
Build the Garden's data from official sources — no third-party deps.

Inputs (in ../sources):
  noc2021-structure.csv  Statistics Canada, NOC 2021 Version 1.0 — classification structure
  noc2021-elements.csv   Statistics Canada, NOC 2021 Version 1.0 — elements
  soc2020-vol1.xlsx      ONS, SOC 2020 Volume 1 — structure and descriptions of unit groups

Outputs (in ../data):
  noc/structure.json       nested 10 > 45 > 89 > 162 > 516, codes+titles (+TEER on units)
  noc/d/{0..9}.json        per broad category: group definitions + unit details
  noc/search.json          compact [title, unitCode] over all 27k+ example titles
  soc/structure.json       nested 9 > 26 > 104 > 412
  soc/d/{1..9}.json        per major group: group descriptions + unit details
  soc/search.json          compact [title, unitCode] over related job titles
  meta.json                counts + provenance
"""
import csv, json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'sources')
OUT = os.path.join(HERE, '..', 'data')

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def clean(s):
    if s is None:
        return ''
    s = s.replace(' ', ' ').replace('\r\n', '\n').replace('\r', '\n')
    s = re.sub(r'[ \t]+', ' ', s)
    return s.strip()


# ---------------------------------------------------------------- NOC
def build_noc():
    nodes = {}   # code -> {c,t,d,level}
    order = []
    with open(os.path.join(SRC, 'noc2021-structure.csv'), encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            code = clean(row['Code - NOC 2021 V1.0'])
            nodes[code] = {
                'c': code,
                't': clean(row['Class title']),
                'd': clean(row['Class definition']),
                'level': int(row['Level']),
            }
            order.append(code)

    # elements
    el = {}
    with open(os.path.join(SRC, 'noc2021-elements.csv'), encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            code = clean(row['Code - NOC 2021 V1.0'])
            typ = clean(row['Element Type Label English'])
            desc = clean(row['Element Description English'])
            if not desc:
                continue
            el.setdefault(code, {}).setdefault(typ, []).append(desc)

    # nest: level 1 (1-digit) > 2 > 3 > 4 > 5 (5-digit)
    def parent_code(code):
        if len(code) == 1:
            return None
        return code[:-1]

    tree = []
    kids = {}
    for code in order:
        n = nodes[code]
        p = parent_code(code)
        entry = {'c': code, 't': n['t']}
        if n['level'] == 5:
            entry['teer'] = int(code[1])
        kids.setdefault(p, []).append(entry)
    for code in order:
        n = nodes[code]
        entry = None
    # attach children
    index = {}
    for p, ks in kids.items():
        for k in ks:
            index[k['c']] = k
    for p, ks in kids.items():
        if p is None:
            tree = ks
        else:
            index[p]['k'] = ks

    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for code in order:
        counts[nodes[code]['level']] += 1

    # details per broad category
    os.makedirs(os.path.join(OUT, 'noc', 'd'), exist_ok=True)
    search = []
    for cat in sorted({c[0] for c in order}):
        groups = {}
        units = {}
        for code in order:
            if code[0] != cat:
                continue
            n = nodes[code]
            if n['level'] < 5:
                groups[code] = {'t': n['t'], 'd': n['d']}
            else:
                e = el.get(code, {})
                units[code] = {
                    't': n['t'],
                    'lead': n['d'],
                    'duties': e.get('Main duties', []),
                    'reqs': e.get('Employment requirements', []),
                    'egs': e.get('Illustrative example(s)', []),
                    'ex': e.get('All examples', []),
                    'excl': e.get('Exclusion(s)', []),
                    'incl': e.get('Inclusion(s)', []),
                    'addl': e.get('Additional information', []),
                }
                for title in e.get('All examples', []):
                    search.append([title, code])
        with open(os.path.join(OUT, 'noc', 'd', f'{cat}.json'), 'w', encoding='utf-8') as f:
            json.dump({'groups': groups, 'units': units}, f, ensure_ascii=False, separators=(',', ':'))

    with open(os.path.join(OUT, 'noc', 'structure.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 'NOC 2021 Version 1.0', 'tree': tree}, f, ensure_ascii=False, separators=(',', ':'))
    search.sort(key=lambda x: x[0].lower())
    with open(os.path.join(OUT, 'noc', 'search.json'), 'w', encoding='utf-8') as f:
        json.dump(search, f, ensure_ascii=False, separators=(',', ':'))

    return counts, len(search)


# ---------------------------------------------------------------- SOC
def read_xlsx_rows(path, sheet='xl/worksheets/sheet1.xml'):
    z = zipfile.ZipFile(path)
    ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    shared = []
    for si in ss_root.findall(M + 'si'):
        shared.append(''.join(t.text or '' for t in si.iter(M + 't')))
    root = ET.fromstring(z.read(sheet))
    rows = []
    for row in root.iter(M + 'row'):
        cells = {}
        for c in row.findall(M + 'c'):
            ref = c.get('r')
            col = re.match(r'([A-Z]+)', ref).group(1)
            t = c.get('t')
            v = c.find(M + 'v')
            if t == 'inlineStr':
                is_el = c.find(M + 'is')
                val = ''.join(x.text or '' for x in is_el.iter(M + 't')) if is_el is not None else ''
            elif v is None:
                val = ''
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text or ''
            cells[col] = val
        rows.append(cells)
    return rows


def tilde_list(s):
    """ONS packs lists as ~item\n\n~item — split, clean, drop blanks/placeholders."""
    out = []
    for part in re.split(r'~', s or ''):
        p = clean(part).strip('\n ')
        p = re.sub(r'\s*\n+\s*', ' ', p)
        if p and p.lower() not in ('<blank>', 'n/a'):
            out.append(p)
    return out


def build_soc():
    rows = read_xlsx_rows(os.path.join(SRC, 'soc2020-vol1.xlsx'))
    header = rows[0]
    tree = []
    stack = {}  # level -> node
    counts = {1: 0, 2: 0, 3: 0, 4: 0}
    details = {}  # major -> {'groups': {}, 'units': {}}
    search = []

    def blank(v):
        v = clean(v or '')
        return '' if v.lower() in ('', '<blank>') else v

    for r in rows[1:]:
        maj, sub, mino, unit = (blank(r.get(c)) for c in 'ABCD')
        title = blank(r.get('E'))
        desc = clean(blank(r.get('G')))
        entry = clean(blank(r.get('H')))
        tasks = blank(r.get('I'))
        related = blank(r.get('J'))
        if not any([maj, sub, mino, unit]):
            continue
        if maj:
            node = {'c': maj, 't': title, 'k': []}
            tree.append(node)
            stack[1] = node
            counts[1] += 1
            details.setdefault(maj, {'groups': {}, 'units': {}})
            details[maj]['groups'][maj] = {'t': title, 'd': desc}
        elif sub:
            node = {'c': sub, 't': title, 'k': []}
            stack[1]['k'].append(node)
            stack[2] = node
            counts[2] += 1
            details[sub[0]]['groups'][sub] = {'t': title, 'd': desc}
        elif mino:
            node = {'c': mino, 't': title, 'k': []}
            stack[2]['k'].append(node)
            stack[3] = node
            counts[3] += 1
            details[mino[0]]['groups'][mino] = {'t': title, 'd': desc}
        elif unit:
            node = {'c': unit, 't': title}
            stack[3]['k'].append(node)
            counts[4] += 1
            rel = tilde_list(related)
            details[unit[0]]['units'][unit] = {
                't': title,
                'lead': desc,
                'entry': entry,
                'tasks': tilde_list(tasks),
                'related': rel,
            }
            for t in rel:
                search.append([t, unit])

    os.makedirs(os.path.join(OUT, 'soc', 'd'), exist_ok=True)
    for maj, d in details.items():
        with open(os.path.join(OUT, 'soc', 'd', f'{maj}.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'soc', 'structure.json'), 'w', encoding='utf-8') as f:
        json.dump({'v': 'SOC 2020', 'tree': tree}, f, ensure_ascii=False, separators=(',', ':'))
    search.sort(key=lambda x: x[0].lower())
    with open(os.path.join(OUT, 'soc', 'search.json'), 'w', encoding='utf-8') as f:
        json.dump(search, f, ensure_ascii=False, separators=(',', ':'))
    return counts, len(search)


def main():
    os.makedirs(OUT, exist_ok=True)
    noc_counts, noc_titles = build_noc()
    soc_counts, soc_titles = build_soc()
    meta = {
        'noc': {
            'version': 'NOC 2021 Version 1.0',
            'source': 'Statistics Canada',
            'levels': ['Broad occupational category', 'Major group', 'Sub-major group', 'Minor group', 'Unit group'],
            'counts': noc_counts,
            'exampleTitles': noc_titles,
            'licence': 'Statistics Canada Open Licence',
        },
        'soc': {
            'version': 'SOC 2020',
            'source': 'Office for National Statistics (UK)',
            'levels': ['Major group', 'Sub-major group', 'Minor group', 'Unit group'],
            'counts': soc_counts,
            'relatedTitles': soc_titles,
            'licence': 'Open Government Licence v3.0',
        },
    }
    with open(os.path.join(OUT, 'meta.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print('NOC levels 1..5:', noc_counts, '| example titles:', noc_titles)
    print('SOC levels 1..4:', soc_counts, '| related titles:', soc_titles)
    exp_noc = {1: 10, 2: 45, 3: 89, 4: 162, 5: 516}
    exp_soc = {1: 9, 2: 26, 3: 104, 4: 412}
    ok = noc_counts == exp_noc and soc_counts == exp_soc
    print('FIDELITY CHECK:', 'PASS' if ok else f'MISMATCH (expected NOC {exp_noc}, SOC {exp_soc})')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
