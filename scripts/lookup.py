#!/usr/bin/env python3
"""Search NOC/SOC unit groups by keyword, or show a code. For authoring org charts.

  python3 scripts/lookup.py find "financial manager"
  python3 scripts/lookup.py noc 10021
  python3 scripts/lookup.py soc 1131
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')


def units(sys_name):
    out = {}
    ddir = os.path.join(DATA, sys_name, 'd')
    for fn in os.listdir(ddir):
        d = json.load(open(os.path.join(ddir, fn)))
        out.update(d['units'])
    return out


def main():
    cmd = sys.argv[1]
    if cmd == 'find':
        q = sys.argv[2].lower()
        terms = q.split()
        for name in ('noc', 'soc'):
            for code, u in sorted(units(name).items()):
                hay = (u['t'] + ' ' + ' '.join(u.get('ex', []) + u.get('related', []))).lower()
                if all(t in hay for t in terms):
                    print(f"{name.upper()} {code}  {u['t']}")
    else:
        u = units(cmd).get(sys.argv[2])
        if not u:
            print('NOT FOUND'); return
        print(u['t'])
        print(' lead:', u['lead'][:200])
        for k in ('duties', 'tasks', 'reqs'):
            for x in u.get(k, [])[:6]:
                print(f'  {k[0]}. {x[:110]}')


if __name__ == '__main__':
    main()
