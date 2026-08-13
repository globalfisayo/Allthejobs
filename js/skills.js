/* skills.js — distil skill themes from official duty/task texts.
   The classifications publish duties, not skills; these chips are derived
   by matching the verbs and vocabulary of the official texts. */

const RULES = [
  [/\b(plan|direct|organiz|organis|establish policies|set priorit)/i, 'Planning & direction'],
  [/\b(supervis|co-?ordinate (the )?(staff|work(ers)?|team)|oversee (staff|team)|manage (staff|team|personnel))/i, 'People leadership'],
  [/\b(analy[sz]|assess|evaluat|examin|interpret)/i, 'Analysis & judgement'],
  [/\b(negotiat)/i, 'Negotiation'],
  [/\b(advis|consult|recommend|counsel)/i, 'Advisory & counsel'],
  [/\b(design|develop|devis|create|formulate)/i, 'Design & development'],
  [/\b(programming|software|coding|debug|source code)/i, 'Software craft'],
  [/\b(test|inspect|verify|quality|audit)/i, 'Quality & assurance'],
  [/\b(operate (machin|equipment|vehicle|plant|process)|drive|pilot)/i, 'Operating & driving'],
  [/\b(maintain|repair|overhaul|troubleshoot|service equipment|install)/i, 'Maintenance & repair'],
  [/\b(document|record|prepare (report|statement|document)|maintain (record|file)|file)/i, 'Documentation & records'],
  [/\b(present|communicat|liais|correspond|respond to (inquir|enquir)|brief)/i, 'Communication'],
  [/\b(sell|sales|promot|market|solicit|persuad)/i, 'Commercial instinct'],
  [/\b(recruit|hire|train|mentor|teach|instruct|coach)/i, 'Developing others'],
  [/\b(budget|financial|cost|forecast|estimat|pric)/i, 'Financial acumen'],
  [/\b(research|study|investigat|experiment)/i, 'Research & inquiry'],
  [/\b(comply|compliance|regulat|legislat|standard|licen[cs])/i, 'Regulatory literacy'],
  [/\b(safe|hazard|protective|emergency)/i, 'Safety mindset'],
  [/\b(patient|clinical|diagnos|treat|therap|care plan|medical)/i, 'Clinical care'],
  [/\b(schedule|allocat|dispatch|logistics|co-?ordinate activit)/i, 'Coordination & scheduling'],
  [/\b(data|statistic|model|database|metric)/i, 'Data literacy'],
  [/\b(customer|client|guest|public|service)/i, 'Service orientation'],
  [/\b(purchas|procure|source|supplier|vendor|contract)/i, 'Procurement & contracting'],
  [/\b(clean|sanit|steriliz|hygien)/i, 'Hygiene & sanitation'],
  [/\b(measure|calibrat|precision|specification|technical drawing|blueprint)/i, 'Technical precision'],
  [/\b(lead|manag).{0,24}(project|program)/i, 'Project management'],
  [/\b(monitor|observ|track|surveill)/i, 'Monitoring & vigilance'],
  [/\b(write|edit|draft|publish|content)/i, 'Writing & editing'],
];

export function deriveSkills(texts, max = 8) {
  const scores = new Map();
  const body = (texts || []).join(' ');
  for (const [re, label] of RULES) {
    const m = body.match(new RegExp(re.source, 'gi'));
    if (m) scores.set(label, (scores.get(label) || 0) + m.length);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([label]) => label);
}
