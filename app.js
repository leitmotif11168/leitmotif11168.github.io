// --- Utility: DOM helpers ---
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const EFFECT_IDS = {
  chatterfang: 'chatterfang',
  manufactor: 'manufactor',
  peregrin: 'peregrin',
  parallel: 'parallel',
  doubling: 'doubling'
};

// Normalize common token names
const CANON = (name) => {
  const n = String(name || '').trim();
  const key = n.toLowerCase();
  if (key === 'food' || key === 'foods') return 'Food';
  if (key === 'clue' || key === 'clues') return 'Clue';
  if (key === 'treasure' || key === 'treasures') return 'Treasure';
  if (key === 'squirrel' || key === 'squirrels') return 'Squirrel';
  return n.length ? n.replace(/\s+/g, ' ').trim() : 'Custom';
};

// Build one token row
function makeRow(defaults = { type: 'Food', count: 1, custom: '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'row';

  wrap.innerHTML = `
    <select class="type">
      <option value="Food">Food</option>
      <option value="Clue">Clue</option>
      <option value="Treasure">Treasure</option>
      <option value="Squirrel">Squirrel</option>
      <option value="Custom">Custom…</option>
    </select>
    <input class="custom hidden" type="text" placeholder="Custom token name" />
    <input class="count" type="number" min="0" step="1" value="1" />
    <button class="btn remove" type="button">Remove</button>
  `;

  const typeSel = $('.type', wrap);
  const customInput = $('.custom', wrap);
  const countInput = $('.count', wrap);

  typeSel.value = defaults.type;
  countInput.value = String(defaults.count);
  if (defaults.type === 'Custom') {
    customInput.classList.remove('hidden');
    customInput.value = defaults.custom || '';
  } else {
    customInput.classList.add('hidden');
  }

  // Wire events
  typeSel.addEventListener('change', () => {
    if (typeSel.value === 'Custom') {
      customInput.classList.remove('hidden');
      customInput.focus();
    } else {
      customInput.classList.add('hidden');
      customInput.value = '';
    }
    compute();
  });
  [customInput, countInput].forEach(inp => {
    inp.addEventListener('input', compute);
    inp.addEventListener('change', compute);
  });
  $('.remove', wrap).addEventListener('click', () => {
    wrap.remove();
    compute();
  });

  return wrap;
}

// Read current UI state
function getState() {
  const active = {
    chatterfang: $(`#${EFFECT_IDS.chatterfang}`).checked,
    manufactor:  $(`#${EFFECT_IDS.manufactor}`).checked,
    peregrin:    $(`#${EFFECT_IDS.peregrin}`).checked,
    parallel:    $(`#${EFFECT_IDS.parallel}`).checked,
    doubling:    $(`#${EFFECT_IDS.doubling}`).checked
  };

  const rows = $$('#rows .row');
  const tokens = [];
  rows.forEach(r => {
    const typeSel = $('.type', r).value;
    const custom = CANON($('.custom', r).value);
    const count = Math.max(0, Math.floor(Number($('.count', r).value || 0)));
    const type = typeSel === 'Custom' ? (custom || 'Custom') : typeSel;
    if (count > 0) tokens.push({ type: CANON(type), count });
  });

  return { active, tokens };
}

// Core calculation (single event)
function calculate({ active, tokens }) {
  // Aggregate starting tokens
  const event = new Map(); // tokenName -> count
  const add = (name, n) => event.set(name, (event.get(name) || 0) + n);
  const set = (name, n) => event.set(name, n);

  tokens.forEach(({ type, count }) => add(type, count));

  // Track a short explanation chain
  const steps = [];
  const totalTokens = () => Array.from(event.values()).reduce((a,b)=>a+b,0);

  // 1) Peregrin Took
  if (active.peregrin && totalTokens() > 0) {
    add('Food', 1);
    steps.push('Peregrin Took adds +1 Food to the event.');
  }

  // 2) Academy Manufactor
  if (active.manufactor) {
    const fct = (event.get('Food') || 0) + (event.get('Clue') || 0) + (event.get('Treasure') || 0);
    if (fct > 0) {
      set('Food', fct);
      set('Clue', fct);
      set('Treasure', fct);
      steps.push(`Academy Manufactor converts the ${fct} Food/Clue/Treasure being created into ${fct} of each.`);
    }
  }

  // 3) Chatterfang
  if (active.chatterfang) {
    const n = totalTokens();
    if (n > 0) {
      add('Squirrel', n);
      steps.push(`Chatterfang adds ${n} Squirrel token${n===1?'':'s'} equal to the total tokens in the event.`);
    }
  }

  // 4) Doublers: Parallel Lives and Doubling Season
  const numDoublers = (active.parallel ? 1 : 0) + (active.doubling ? 1 : 0);
  if (numDoublers > 0) {
    const factor = 2 ** numDoublers;
    for (const [k, v] of Array.from(event.entries())) {
      set(k, v * factor);
    }
    const label = numDoublers === 2 ? 'Parallel Lives + Doubling Season' :
                  active.parallel ? 'Parallel Lives' : 'Doubling Season';
    steps.push(`${label} multiplies all tokens by ×${2 ** numDoublers}.`);
  }

  // Sort result by name for a clean readout
  const result = Array.from(event.entries())
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  return { result, steps };
}

// Render result cards + explanation
function render({ result, steps }) {
  const res = $('#result');
  const ex = $('#explain');
  res.innerHTML = '';
  if (result.length === 0) {
    res.innerHTML = '<p class="hint">No tokens to create. Add a row above.</p>';
    ex.textContent = '';
    return;
  }

  result.forEach(([name, count]) => {
    const card = document.createElement('div');
    card.className = 'badge';
    card.innerHTML = `
      <h3>${name}</h3>
      <div class="count">${count.toLocaleString()}</div>
    `;
    res.appendChild(card);
  });

  ex.innerHTML = steps.length
    ? `<p><strong>How we got here:</strong> ${steps.join(' ')}</p>`
    : '';
}

// Compute based on current state
function compute() {
  const state = getState();
  const { result, steps } = calculate(state);
  render({ result, steps });
}

// --- Init ---
function init() {
  // Seed with one starter row
  const rows = $('#rows');
  rows.appendChild(makeRow({ type: 'Food', count: 1 }));

  // Wire effect toggles
  Object.values(EFFECT_IDS).forEach(id => {
    $(`#${id}`).addEventListener('change', compute);
  });

  // Add/remove/reset
  $('#addRow').addEventListener('click', () => {
    rows.appendChild(makeRow({ type: 'Food', count: 1 }));
    compute();
  });
  $('#reset').addEventListener('click', () => {
    // Clear toggles
    Object.values(EFFECT_IDS).forEach(id => { $(`#${id}`).checked = false; });

    // Clear rows then add one default
    $('#rows').innerHTML = '';
    rows.appendChild(makeRow({ type: 'Food', count: 1 }));

    compute();
  });

  // First render
  compute();
}

// Minimal utility: show/hide class "hidden"
const style = document.createElement('style');
style.textContent = `.hidden{ display:none !important; }`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', init);
