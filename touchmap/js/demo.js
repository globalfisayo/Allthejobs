// A plausible 12-hour shift on a PET line, for trying the app and its analysis.
import { finalise, blankTouch } from './model.js';
import { typeInfo } from './framework.js';

// [minutes from shift start, zone, category, type, count, minutes per occurrence, who, description]
export const ROWS = [
  [5, 'Control room / office', 'P8', 'Handover, meetings & planned calls', 4, 9, 'Shift leader', 'Shift handover at the board, each operator gives their machine status'],
  [18, 'Filler', 'P5', 'Pre-start & safety device checks', 1, 11, 'Op 2', 'Start-of-shift round: light curtains, e-stops, eyewash'],
  [32, 'Preform feed', 'P7', 'Preform loading', 22, 2.4, 'Op 1', 'Tips octabin into hopper, fetches next with pallet jack'],
  [41, 'Conveyors', 'U2', 'Fallen bottles', 46, 0.3, 'Op 3', 'Fallen bottles at the transfer after the labeller'],
  [55, 'Mixer / carbo', 'P4', 'Brix / CO2 sampling & test', 12, 3.2, 'Op 2', 'Takes bottle at filler outlet, tests Brix and CO2 in the lab corner'],
  [62, 'Control room / office', 'P4', 'Recording QC results & readings', 12, 1.4, 'Op 2', 'Keys the Brix results into the QC sheet at the PC'],
  [75, 'Labeller', 'P7', 'Label & film reel change', 9, 3.5, 'Op 3', 'Label reel change with splice'],
  [90, 'Capper', 'P7', 'Closure / cap loading', 10, 1.6, 'Op 1', 'Box of caps into the cap hopper'],
  [104, 'Blow moulder', 'U7', 'Workaround on a running defect', 7, 1.8, 'Op 1', 'Pushes preforms past worn guide at the oven infeed'],
  [118, 'Packer / shrink', 'U2', 'Jam or pile-up cleared', 14, 1.5, 'Op 4', 'Pack pile-up at the shrink tunnel infeed'],
  [140, 'Palletiser', 'P7', 'Other packaging, consumables & waste', 6, 4, 'Op 4', 'Empty pallets and slip-sheets staged'],
  [160, 'Filler', 'U1', 'Mechanical failure or major jam', 2, 26, 'Mechanic', 'Filling valve stuck open, mechanic called'],
  [165, 'Filler', 'U1', 'Breakdown calls & records', 2, 3, 'Op 2', 'Calls maintenance, writes the stop reason'],
  [200, 'Inspection / rejects', 'U3', 'Rejection handling', 8, 2.2, 'Op 3', 'Empties reject table after the fill-level inspector'],
  [215, 'Coder', 'P3', 'labeller & coder settings', 2, 2, 'Op 3', 'Changes the date code content for the new batch'],
  [240, 'Control room / office', 'P8', 'Re-typing numbers (Excel, e-mail, chat)', 9, 2.5, 'Shift leader', 'Copies counter values from the HMI into Excel, then e-mail'],
  [300, 'Labeller', 'P1', 'Parts change', 8, 4.5, 'Op 3', 'Changeover to 0.5 L: star wheels, centring bells, guide rails'],
  [302, 'Blow moulder', 'P1', 'Parts change', 10, 3.8, 'Mechanic', 'Blow moulds swapped for 0.5 L'],
  [340, 'Filler', 'P1', 'Loading recipe', 4, 2, 'Op 2', 'Recipe loaded on filler, blow moulder, labeller and packer'],
  [350, 'Mixer / carbo', 'P1', 'Adjusting Brix', 2, 3, 'Op 2', 'Brix correction during changeover, then re-check'],
  [360, 'Line-side store', 'P1', 'New SKU material swap & line clearance', 4, 9, 'Op 1', 'Clears 2 L preforms and caps, stages 0.5 L material'],
  [372, 'Filler', 'P4', 'Production startup checks', 4, 3, 'Op 2', 'Fill level, torque, label and code checks before release'],
  [420, 'CIP / utilities', 'P2', 'CIP start, checks & records', 5, 4, 'Op 2', 'Selects programme, checks conductivity, signs the CIP log'],
  [425, 'Filler', 'P2', 'CIP set-up & strip-down', 2, 18, 'Op 2', 'Fits CIP cups and swing bend, removes after'],
  [470, 'CIP / utilities', 'P2', 'Chemical top-up / container change', 1, 12, 'Op 4', 'Caustic container change, walk to chemical store'],
  [500, 'Conveyors', 'U2', 'Nuisance trip reset', 18, 0.4, 'Op 4', 'Photo-eye trip at accumulation table, reset at the panel'],
  [540, 'Blow moulder', 'U5', 'Re-sample, re-test & re-validation', 2, 7, 'Quality / lab', 'Base clearance out of spec, re-sample after adjustment'],
  [560, 'Blow moulder', 'U5', 'Corrections after OOS', 2, 4, 'Op 1', 'Oven profile corrected after the out-of-spec result'],
  [600, 'Preform feed', 'U4', 'Preform problem', 1, 22, 'Op 1', 'Wrong preform lot staged, pulls it and takes it to quarantine'],
  [610, 'Line-side store', 'U4', 'Chasing or reporting a material problem', 3, 4, 'Shift leader', 'Calls warehouse to chase the right preform lot'],
  [640, 'Palletiser', 'U6', 'Downstream blockage (warehouse / forklift)', 3, 6, 'Op 4', 'Moves finished pallets aside, no forklift available'],
  [660, 'Filler', 'P6', 'CIL route (clean, inspect, lubricate)', 1, 24, 'Op 2', 'Filler CIL route, checklist to sign-off'],
  [680, 'Labeller', 'U7', 'Misalignment or sensor fixed', 3, 3, 'Op 3', 'Re-aims the label sensor, cleans the camera'],
  [700, 'Control room / office', 'P8', 'Shift / production report', 1, 16, 'Shift leader', 'Fills the shift report in MES'],
  [705, 'Control room / office', 'P8', 'System bookings & traceability', 3, 4, 'Op 4', 'Books finished pallets and material lots in SAP'],
];

export function demoTouches(shiftStart = (() => { const d = new Date(); d.setHours(6, 0, 0, 0); if (d > new Date()) d.setDate(d.getDate() - 1); return d; })(), deviceId = '') {
  return ROWS.map(([offset, zone, category, type, count, per, who, description]) => {
    const start = new Date(shiftStart.getTime() + offset * 60000);
    const info = typeInfo(category, type);
    const timed = Math.round(count * per * 60);
    const t = {
      ...blankTouch(),
      zone, who, category, type, touchType: info?.touchType || 'Physical',
      planned: category.startsWith('P') ? 'Planned' : 'Unplanned',
      count, countMode: 'all', timedSec: timed, durManual: false,
      start: start.toISOString(), end: new Date(start.getTime() + timed * 1000).toISOString(),
      description: 'Demo · ' + description, observer: 'Demo', ...(deviceId ? { device: deviceId } : {}),
    };
    return finalise(t, { now: start });
  });
}
