#!/usr/bin/env python3
"""Generate data/firms/index.json and data/firms/roles-index.json from firm files."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
FIRMS = os.path.join(HERE, '..', 'data', 'firms')

ORDER = [
    ('commercial-bank', 'Deposits, lending, payments and wealth — the high-street chartered bank.'),
    ('software-company', 'A B2B SaaS product company — engineering, product and go-to-market.'),
    ('hospital', 'An acute-care teaching hospital — medicine, surgery, emergency, diagnostics.'),
    ('supermarket', 'A national grocery chain — stores, distribution centres and buying.'),
    ('beverage-bottler', 'Brewing, blending and bottling lines — and the routes to market.'),
    ('automaker', 'Body, paint, powertrain and final assembly — plus the dealer network.'),
    ('airline', 'Flight operations, engineering, ground handling and the network.'),
    ('telecom-operator', 'Fixed and mobile networks — RAN, core, fibre, consumer and enterprise.'),
    ('electric-utility', 'Generation, transmission, distribution and retail — keeping the lights on.'),
    ('oil-gas-producer', 'Subsurface, drilling and production — an upstream E&P company.'),
    ('mining-company', 'A hard-rock mine and mill — geology, operations, processing, tailings.'),
    ('property-developer', 'Land, entitlement, construction and leasing — develop, build, hold.'),
]

index, roles_index = [], []
missing = []
for fid, tagline in ORDER:
    path = os.path.join(FIRMS, f'{fid}.json')
    if not os.path.exists(path):
        missing.append(fid)
        continue
    f = json.load(open(path))
    coded = [r for r in f['roles'] if r.get('kind') != 'governance']
    index.append({
        'id': f['id'], 'name': f['name'], 'industry': f['industry'],
        'tagline': tagline, 'archetype': f.get('archetype', ''),
        'species': f['species'], 'palette': f['palette'],
        'saplings': f.get('saplings', []),
        'roles': len(coded), 'divisions': len({r['division'] for r in f['roles']}),
    })
    for r in f['roles']:
        roles_index.append([r['title'], f['id'], r['id'], r.get('division', ''),
                            r.get('noc') or '', r.get('soc') or ''])

with open(os.path.join(FIRMS, 'index.json'), 'w', encoding='utf-8') as fh:
    json.dump(index, fh, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(FIRMS, 'roles-index.json'), 'w', encoding='utf-8') as fh:
    json.dump(roles_index, fh, ensure_ascii=False, separators=(',', ':'))

print(f'firms indexed: {len(index)}  roles: {len(roles_index)}')
if missing:
    print('MISSING:', ', '.join(missing))
