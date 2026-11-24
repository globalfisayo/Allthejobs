// The organisation: business units → plants → production lines. Plants that are not live yet
// show greyed out in onboarding; an admin can load demo data for them to present the roll-out.
// A run stores the plant and line by name (run.info.plant, run.info.line), so renaming here
// keeps old runs readable as long as the old name stays in `aka`.

export const ORG = {
  units: [
    {
      id: 'RO', name: 'Romania', blurb: 'Business unit',
      plants: [
        {
          id: 'PLO', name: 'Ploiești', live: true, aka: ['Ploiesti'],
          lines: [
            { id: 'K3', name: 'K3', full: 'Krones 3 (ErgoBloc)', blurb: 'Krones ErgoBloc · PET', live: true, aka: ['K3 · Krones ErgoBloc'] },
          ],
        },
        {
          id: 'TIM', name: 'Timișoara', live: false, aka: ['Timisoara'],
          lines: [
            { id: 'TIM-P1', name: 'PET 1', full: 'PET line 1', blurb: 'PET bottling' },
            { id: 'TIM-P2', name: 'PET 2', full: 'PET line 2', blurb: 'PET bottling' },
            { id: 'TIM-C1', name: 'Can 1', full: 'Can line 1', blurb: 'Cans' },
          ],
        },
        {
          id: 'PNG', name: 'Poiana Negri', live: false, aka: ['Poiana Negrii'],
          lines: [
            { id: 'PNG-W1', name: 'Water 1', full: 'Water PET line 1', blurb: 'Water · PET' },
            { id: 'PNG-W2', name: 'Water 2', full: 'Water PET line 2', blurb: 'Water · PET' },
          ],
        },
      ],
    },
    // Next in line: shown in colour on the first step of onboarding, not selectable yet.
    { id: 'BG', name: 'Bulgaria', featured: true, plants: [] },
    { id: 'HU', name: 'Hungary', featured: true, plants: [] },
    { id: 'RS', name: 'Serbia', featured: true, plants: [] },
    // The rest of the group, behind "See all business units".
    ...[['AM', 'Armenia'], ['AT', 'Austria'], ['BA', 'Bosnia and Herzegovina'], ['HR', 'Croatia'], ['CY', 'Cyprus'], ['CZ', 'Czech Republic'],
      ['EG', 'Egypt'], ['EE', 'Estonia'], ['GR', 'Greece'], ['IE', 'Ireland'], ['IT', 'Italy'], ['LV', 'Latvia'], ['LT', 'Lithuania'],
      ['MD', 'Moldova'], ['ME', 'Montenegro'], ['NG', 'Nigeria'], ['MK', 'North Macedonia'], ['PL', 'Poland'], ['SK', 'Slovakia'],
      ['SI', 'Slovenia'], ['CH', 'Switzerland'], ['UA', 'Ukraine']].map(([id, name]) => ({ id, name, plants: [] })),
  ],
};
/** A business unit people can pick now: it has a live plant. */
export const unitLive = (u) => u.plants.some(p => p.live);

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const allPlants = () => ORG.units.flatMap(u => u.plants.map(p => ({ ...p, unit: u })));
export const liveUnits = () => ORG.units.filter(u => u.plants.length);
export const unitById = (id) => ORG.units.find(u => u.id === id) || null;
export const plantById = (id) => allPlants().find(p => p.id === id) || null;

/** The plant a run belongs to, from its stored name (accents and spelling variants allowed). */
export function plantOf(name) {
  const n = fold(name);
  if (!n) return null;
  return allPlants().find(p => fold(p.name) === n || (p.aka || []).some(a => fold(a) === n)) || null;
}
/** The line within a plant, from a run's stored line name (short or full). */
export function lineOf(plant, name) {
  const n = fold(name);
  if (!plant || !n) return null;
  return plant.lines.find(l => fold(l.name) === n || fold(l.full) === n || (l.aka || []).some(a => fold(a) === n)) || null;
}
