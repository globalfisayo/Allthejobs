// Where each touch type typically happens on the K3 line (the Guide map's default placement).
// Pure data: framework.js copies it onto the default types as `zones` / `everywhere`.

export const ON_EVERY_MACHINE = [
  ['P5', 'Pre-start & safety device checks'], ['P5', 'LOTO for planned work'], ['P5', 'Work permit'],
  ['P6', 'CIL route (clean, inspect, lubricate)'], ['P6', 'Planned PM job'], ['P6', 'AM readings & records'],
  ['U1', 'Mechanical failure or major jam'], ['U1', 'Electrical, pneumatic or drive failure'], ['U1', 'Control / PLC / HMI fault'],
  ['U1', 'LOTO & restart after repair'], ['U1', 'Breakdown calls & records'],
  ['U2', 'Nuisance trip reset'], ['U2', 'Recording the stop reason'],
  ['U6', 'Air, CO2, power or cooling drop'],
  ['U7', 'Defect tag, reporting & monitoring'], ['U7', 'Workaround on a running defect'], ['U7', 'Setting change for a defect'],
  ['U7', 'Early fix: worn part, leak or loose part'], ['U7', 'Misalignment or sensor fixed'],
];

export const ZONE_INFO = {
  'Line-side store': {
    machine: false,
    blurb: 'Staged material next to the line: preforms, caps, labels, film, cartons, pallets, glue and ink.',
    types: [['P7', 'Calling for material'], ['P7', 'Material Return'], ['P7', 'Other packaging, consumables & waste'],
      ['P1', 'New SKU material swap & line clearance'], ['U4', 'Chasing or reporting a material problem'],
      ['U5', 'Hold, sorting & rework of held stock'], ['U6', 'Downstream blockage (warehouse / forklift)']],
  },
  'Preform feed': {
    machine: true,
    blurb: 'Preforms tipped from boxes into the hopper; the elevator and infeed rail carry them to the blow moulder.',
    types: [['P7', 'Preform loading'], ['P7', 'Calling for material'], ['P7', 'Material Return'],
      ['P1', 'New SKU material swap & line clearance'], ['U4', 'Preform problem'],
      ['U4', 'Chasing or reporting a material problem'], ['U2', 'Jam or pile-up cleared']],
  },
  'Blow moulder': {
    machine: true,
    blurb: 'Heats the preforms in the oven and stretch-blows them into bottles in the moulds.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P3', 'Blow moulder settings'],
      ['P4', 'Container & pack checks'], ['P4', 'Production startup checks'], ['U2', 'Blown / burst bottles'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Process correction after a defect'], ['U3', 'Defect removal by hand'],
      ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Corrections after OOS']],
  },
  Labeller: {
    machine: true,
    blurb: 'Labels the empty bottles inside the block, between the blow moulder and the filler.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P1', 'New SKU material swap & line clearance'],
      ['P3', 'labeller & coder settings'], ['P7', 'Label & film reel change'], ['U4', 'Label, film & packaging problem'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Defect removal by hand']],
  },
  Filler: {
    machine: true,
    blurb: 'Fills the bottles with product from the mixer; the hygienic heart of the block.',
    types: [['P1', 'Parts change'], ['P1', 'Loading recipe'], ['P3', 'Filler, mixer capper set-points'],
      ['P2', 'CIP set-up & strip-down'], ['P2', 'Foam / wet cleaning (COP)'], ['P4', 'Container & pack checks'],
      ['P4', 'Production startup checks'], ['U2', 'Blown / burst bottles'], ['U3', 'Process correction after a defect'],
      ['U5', 'Corrections after OOS'], ['U5', 'Glass / foreign-body incident clearance']],
  },
  Capper: {
    machine: true,
    blurb: 'Screws the closures on straight after filling, fed from the cap hopper.',
    types: [['P1', 'Parts change'], ['P7', 'Closure / cap loading'], ['P3', 'Filler, mixer capper set-points'],
      ['P4', 'Container & pack checks'], ['P2', 'Foam / wet cleaning (COP)'], ['U4', 'Closure / cap problem'],
      ['U2', 'Jam or pile-up cleared']],
  },
  'Mixer / carbo': {
    machine: true,
    blurb: 'Mixes syrup and treated water to the recipe Brix and carbonates it before the filler.',
    types: [['P1', 'Adjusting Brix'], ['P1', 'Loading recipe'], ['P3', 'Filler, mixer capper set-points'],
      ['P4', 'Brix / CO2 sampling & test'], ['P2', 'CIP start, checks & records'], ['U4', 'Syrup / ingredient problem'],
      ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Corrections after OOS']],
  },
  'CIP / utilities': {
    machine: true,
    blurb: 'Cleaning-in-place skid and the supplies the line draws on: compressed air, CO2, water, steam, power.',
    types: [['P2', 'CIP start, checks & records'], ['P2', 'CIP set-up & strip-down'], ['P2', 'Chemical top-up / container change'],
      ['P2', 'Post-CIP rinse & swab sampling'], ['P4', 'Recording QC results & readings'], ['U6', 'Air, CO2, power or cooling drop'],
      ['U6', 'Water, steam or IT unavailable'], ['U6', 'Reporting an outside problem']],
  },
  Coder: {
    machine: true,
    blurb: 'Prints the date and batch code on each bottle after capping.',
    types: [['P3', 'labeller & coder settings'], ['P7', 'Other packaging, consumables & waste'],
      ['P4', 'Container & pack checks'], ['U3', 'Defect removal by hand']],
  },
  'Inspection / rejects': {
    machine: true,
    blurb: 'Fill-level, closure and code inspectors push faulty bottles to the reject table.',
    types: [['P4', 'Inspector function test (test bottles)'], ['U3', 'Rejection handling'], ['U3', 'Recording rejects / scrap'],
      ['U3', 'Defect removal by hand'], ['U5', 'Re-sample, re-test & re-validation'], ['U5', 'Hold, sorting & rework of held stock']],
  },
  Conveyors: {
    machine: true,
    blurb: 'Bottle and pack conveyors linking the machines, with accumulation tables in between.',
    types: [['U2', 'Fallen bottles'], ['U2', 'Jam or pile-up cleared'], ['P3', 'Line speed & packer'],
      ['P4', 'Hygiene & foreign-body rounds'], ['U5', 'Glass / foreign-body incident clearance']],
  },
  'Packer / shrink': {
    machine: true,
    blurb: 'Groups bottles into packs, wraps them in film and shrinks the film in the tunnel.',
    types: [['P1', 'Parts change'], ['P3', 'Line speed & packer'], ['P7', 'Label & film reel change'],
      ['P7', 'Other packaging, consumables & waste'], ['U4', 'Label, film & packaging problem'],
      ['U2', 'Jam or pile-up cleared'], ['U3', 'Defect removal by hand']],
  },
  Palletiser: {
    machine: true,
    blurb: 'Builds the packs into layers on a pallet, with slip-sheets, ready for stretch wrapping.',
    types: [['P3', 'Palletizer Setting'], ['P1', 'Loading recipe'], ['P7', 'Other packaging, consumables & waste'],
      ['U3', 'Sorting, rework & pallet rework (no hold)'], ['U6', 'Downstream blockage (warehouse / forklift)'],
      ['P8', 'System bookings & traceability'], ['U5', 'Hold, sorting & rework of held stock']],
  },
  'Control room / office': {
    machine: false,
    blurb: 'Desk, PC and boards: reports, bookings, meetings, look-ups and records made away from the machine.',
    types: [['P8', 'Shift / production report'], ['P8', 'System bookings & traceability'], ['P8', 'Re-typing numbers (Excel, e-mail, chat)'],
      ['P8', 'Handover, meetings & planned calls'], ['P8', 'Plan & SOP look-ups'], ['P4', 'Recording QC results & readings'],
      ['P5', 'Work permit'], ['P6', 'AM readings & records'], ['U1', 'Breakdown calls & records'], ['U3', 'Recording rejects / scrap'],
      ['U4', 'Chasing or reporting a material problem'], ['U5', 'Deviation records, investigation & QA calls'],
      ['U6', 'Short-notice plan change'], ['U6', 'Reporting an outside problem'], ['U7', 'Defect tag, reporting & monitoring']],
  },
  Other: {
    machine: false,
    blurb: 'Anywhere else on the line: walkways, floors, between machines. Name the place in the task description.',
    types: [['P5', 'BOS / safety observation'], ['P5', '5S & dry housekeeping'], ['P4', 'Hygiene & foreign-body rounds'],
      ['U5', 'Glass / foreign-body incident clearance'], ['P8', 'Handover, meetings & planned calls'], ['U6', 'Short-notice plan change']],
  },
};

