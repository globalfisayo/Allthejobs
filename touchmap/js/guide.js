// Guide: the 'How to use' sheet and the Detailed Categories block, browsable on the line.
import { CATEGORIES, CATEGORY_RULE, DECISION, RULES, HOW_TO_COUNT, TOUCH_TYPE_RULE, PARETO_NOTE, OTHER_ADVICE } from './framework.js';
import { h, clear, icon } from './ui.js';

export function renderGuide(root) {
  const order = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q8b', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15'];
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Find a type of touch… e.g. star wheel, Brix, jam', 'aria-label': 'Search the category guide' });
  const catsEl = h('div', { class: 'guide-cats' });

  function paintCats() {
    const q = search.value.trim().toLowerCase();
    clear(catsEl, CATEGORIES.map(c => {
      const types = c.types.filter(t => !q || (c.name + ' ' + t.name + ' ' + t.guide).toLowerCase().includes(q));
      if (q && !types.length) return null;
      return h('details', { class: 'gcat', open: !!q },
        h('summary', {}, h('span', { class: 'code ' + (c.planned ? 'code-p' : 'code-u'), text: c.code }), h('span', { class: 'gcat-name', text: c.short }), h('span', { class: 'muted', text: ` ${c.types.length} types` })),
        h('p', { class: 'rule' }, h('strong', { text: 'When: ' }), CATEGORY_RULE[c.code]),
        h('dl', { class: 'gtypes' }, types.map(t => [
          h('dt', {}, h('span', { text: t.name }), h('span', { class: 'tt-tag', text: t.touchType })),
          h('dd', { text: t.guide }),
        ])));
    }));
  }
  search.addEventListener('input', paintCats);

  clear(root, h('section', { class: 'guidev' },
    h('div', { class: 'view-head' }, h('div', {},
      h('h1', { class: 'view-title', text: 'Guide' }),
      h('p', { class: 'view-sub', text: 'K3 Touch Definition & Category Framework, v0.1. Read before you start; check on the line when unsure.' }))),

    h('div', { class: 'grid-2' },
      h('section', { class: 'card' },
        h('h2', { class: 'card-h', text: 'How to use' }),
        h('dl', { class: 'rules' }, RULES.map(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })])),
        h('h3', { text: 'How to count' }), h('p', { text: HOW_TO_COUNT }),
        h('h3', { text: 'Touch type' }), h('p', { text: TOUCH_TYPE_RULE }),
        h('h3', { text: 'Using the stopwatch' }),
        h('ul', { class: 'tips' },
          h('li', {}, h('strong', { text: 'Start touch' }), ' when the touch begins. Answer the questions while it runs.'),
          h('li', {}, h('strong', { text: '+1' }), ' counts each repeat (each part, each fallen bottle) without stopping the clock.'),
          h('li', {}, h('strong', { text: 'Next touch' }), ' saves this touch and starts timing the next one at the same instant: a change of reason is a new touch, even without a pause.'),
          h('li', {}, h('strong', { text: 'The timer covers' }), ': “all occurrences” divides the time by Count; “one occurrence” means you timed one of them and counted the rest.'),
          h('li', {}, 'Shorter than 5 seconds: count it, do not time it. Use ', h('strong', { text: 'Save untimed' }), '.'),
          h('li', {}, 'The screen stays awake while timing, and the stopwatch survives a reload or a locked screen.'))),

      h('section', { class: 'card' },
        h('h2', { class: 'card-h', text: 'Which category: the reason decides' }),
        h('p', { class: 'muted', text: 'Ask in order and stop at the first yes. On Capture, “Help me choose” walks you through it.' }),
        h('ol', { class: 'decision' }, order.map(id => {
          const n = DECISION.nodes[id];
          const to = n.yes.cat ? n.yes.cat : (id === 'q1' ? 'go to 9' : '');
          return h('li', { class: id === 'q8b' ? 'cont' : '', value: n.n },
            h('span', { text: n.text }),
            to ? h('span', { class: 'code ' + (to.startsWith('U') ? 'code-u' : to.startsWith('P') ? 'code-p' : 'code-x'), text: to }) : null);
        })),
        h('p', { class: 'warn-line' }, icon('info'), OTHER_ADVICE),
        h('p', { class: 'muted', text: PARETO_NOTE }))),

    h('section', { class: 'card' },
      h('h2', { class: 'card-h', text: 'Detailed categories and how to count each type' }),
      search,
      catsEl)));

  paintCats();
}
