// Guidance layer over the framework data: the category decision order, the counting
// rules and the reading notes, all worded as in the template's 'How to use' sheet.
import { FRAMEWORK } from './framework-data.js';

export { FRAMEWORK };

export const TOUCH_TYPES = ['Physical', 'Information'];
export const PLANNED = ['Planned', 'Unplanned'];
export const DEFAULT_ROUTE = 'To be decided';

export const CATEGORIES = FRAMEWORK.categories;
export const CAT_BY_CODE = Object.fromEntries(CATEGORIES.map(c => [c.code, c]));

/** The category order: ask in order and stop at the first yes. */
export const DECISION = {
  start: 'q1',
  nodes: {
    q1:  { n: 1,  text: 'Would this touch disappear on a perfect shift, because something went wrong?',
           yes: { go: 'q9' }, no: { go: 'q2' }, hint: 'Yes → unplanned (questions 9 to 15). No → planned (questions 2 to 8).' },
    q2:  { n: 2,  text: 'A safety or standard routine for any planned job (pre-start check, LOTO, work permit, BOS, safety device or emergency check, 5S, dry housekeeping)?',
           yes: { cat: 'P5' }, no: { go: 'q3' } },
    q3:  { n: 3,  text: 'CIP, sanitising, a water flush between products, or a foam / wet hygienic clean done as its own task?',
           yes: { cat: 'P2' }, no: { go: 'q4' } },
    q4:  { n: 4,  text: "Exists only because the SKU or format is changing (format parts, recipe, push-out, the new SKU's material, first-off checks)?",
           yes: { cat: 'P1' }, no: { go: 'q5' } },
    q5:  { n: 5,  text: 'A scheduled quality or food-safety check, or recording its result?',
           yes: { cat: 'P4' }, no: { go: 'q6' } },
    q6:  { n: 6,  text: "A task the AM or PM plan calls for, whatever the machine's condition (CIL, lubrication, time-based part swap, check rounds)?",
           yes: { cat: 'P6' }, no: { go: 'q7' } },
    q7:  { n: 7,  text: 'Replenishing or removing material for the SKU already running?',
           yes: { cat: 'P7' }, no: { go: 'q8' } },
    q8:  { n: 8,  text: 'A setting changed on a machine for a planned or normal reason?',
           yes: { cat: 'P3' }, no: { go: 'q8b' } },
    q8b: { n: 8,  text: 'Any other information, reporting or coordination?',
           yes: { cat: 'P8' }, no: { other: true } },
    q9:  { n: 9,  text: 'A formal quality deviation is open (out-of-spec result, hold, NCR, incident clearance, release), whatever caused it?',
           yes: { cat: 'U5' }, no: { go: 'q10' } },
    q10: { n: 10, text: 'Incoming material (preforms, caps, labels, film, cartons, pallets, glue, ink, syrup, ingredients) missing, late, wrong or out of spec, whoever caused it?',
           yes: { cat: 'U4' }, no: { go: 'q11' } },
    q11: { n: 11, text: 'The cause is outside the K3 line boundary (air, CO2, power, water, steam, IT, downstream warehouse, short-notice plan change)?',
           yes: { cat: 'U6' }, no: { go: 'q12' } },
    q12: { n: 12, text: 'Acting on an equipment abnormality (wear, damage, leak, loose part, misalignment, sensor issue) that has not caused a breakdown or stop?',
           yes: { cat: 'U7' }, no: { go: 'q13' } },
    q13: { n: 13, text: 'The machine stopped by itself and needs maintenance, or the stop lasts longer than the threshold (suggested 10 min, set locally)?',
           yes: { cat: 'U1' }, no: { go: 'q14' } },
    q14: { n: 14, text: 'The machine stopped or the flow broke, and the operator restores it alone within the threshold (jams, fallen or burst bottles, pile-ups, nuisance resets)?',
           yes: { cat: 'U2' }, no: { go: 'q15' } },
    q15: { n: 15, text: 'Product or packs came out wrong (rejects, defects, rework without a hold)?',
           yes: { cat: 'U3' }, no: { other: true } },
  },
};

/** One-line definition of each category: the decision question that leads to it. */
export const CATEGORY_RULE = {
  P1: DECISION.nodes.q4.text, P2: DECISION.nodes.q3.text, P3: DECISION.nodes.q8.text,
  P4: DECISION.nodes.q5.text, P5: DECISION.nodes.q2.text, P6: DECISION.nodes.q6.text,
  P7: DECISION.nodes.q7.text, P8: DECISION.nodes.q8b.text,
  U1: DECISION.nodes.q13.text, U2: DECISION.nodes.q14.text, U3: DECISION.nodes.q15.text,
  U4: DECISION.nodes.q10.text, U5: DECISION.nodes.q9.text, U6: DECISION.nodes.q11.text,
  U7: DECISION.nodes.q12.text,
};

export const OTHER_ADVICE = 'Nothing fits: write Other at the start of the task description and raise it that day.';

export const RULES = [
  ['One row =', 'One touch by one person for one reason. Two people doing the same job = two rows. A change of reason = a new row.'],
  ['Repeated touches', "Do not log 30 identical rows. Log one row, put the number of occurrences in Count and the average duration in Duration per occurrence. Total minutes calculates itself."],
  ['Categorise on the line', 'Fill the category, type of touch and touch type while you are standing there. Do not reconstruct them at your desk.'],
  ['Elimination route', "Leave it as 'To be decided' during observation. It is filled in the elimination workshop, with the team, not by the observer alone."],
  ['Avoid', 'Deleting a row because it looks odd, and never round a duration to make a total work. The gap between what you mapped and the reference frame is the finding, not an error to hide.'],
];

export const HOW_TO_COUNT = 'One person, one place, one reason = 1 touch; a change of reason is a new touch, even without a pause. Two people doing the same job = 2 touches (one row each). Sub-actions inside one task (pick up wipe, spray, wipe) are not separate touches. Repeats: log one row, put the number of occurrences in Count and the average minutes in Duration. Walking and waiting inside a touch are part of its duration. Shorter than 5 seconds: count it, do not time it. Record what did happen, not what the SOP says should happen.';

export const TOUCH_TYPE_RULE = 'Every touch is Physical or Information, never both. Physical = hands act on equipment, material or product (fit, load, clear, clean, sample). Information = reading, writing, keying, setting a value on a screen or communicating, with nothing physical handled. If one task does both in the same place (e.g. take a sample and note the result), it is Physical; a record made later or somewhere else is a separate Information touch.';

export const PARETO_NOTE = 'Each category keeps its 4 or 5 biggest types of touch; the smaller ones are folded into the nearest row, named in its guide. Write the detail (which machine, which defect) in the task description and zone.';

export const READING_COMPARISON = 'The sum of everything you mapped will land below the reference capacity. That is normal and expected: the first honest touch map typically recovers 20 to 25 of ~46 operator-hours. The gap resolves into three things and you must be able to say which: (a) touches you missed, (b) genuine idle or waiting time the current line design creates, (c) time spent outside the line boundary. Investigate the gap and do not attempt to close it by inventing rows.';

export const NOTES = {
  planned: 'Planned touches are attacked by design and automation; unplanned by reliability. Different projects, different budgets.',
  category: 'Read as a Pareto: the top three categories are the project list.',
  touchType: 'Physical touches are attacked by automation; Information touches by digitalisation. What neither removes goes to optimisation (layout, sequencing, presentation).',
  zone: 'Where on the line the work actually is. Read it before proposing layout changes.',
  types: 'The biggest single types of touch across all categories: the most specific project candidates.',
};

/** Observation Log columns A to O, as in the template, so exported rows paste straight in. */
export const LOG_COLUMNS = [
  '#', 'Zone / equipment', 'Planned / Unplanned', 'Category', 'Type of Touch in Category', 'Touch type',
  'Start timestamp', 'End timestamp', 'Duration (seconds)', 'Duration (minutes)', 'Count',
  'Duration per occurrence (min)', 'Total minutes', 'Task description (what they actually did)', 'Elimination route',
];

export const DEFAULT_INFO = {
  line: 'Krones 3 (ErgoBloc)',
  plant: 'Ploiești',
  from: '', to: '',
  skus: '', changeovers: '', cips: '', observers: '',
  operators: 4, shiftHours: 12, breakHours: 0.5, shifts: 1,
};

export function typesFor(code) {
  return CAT_BY_CODE[code]?.types ?? [];
}

export function typeInfo(code, typeName) {
  return typesFor(code).find(t => t.name === typeName) ?? null;
}
