// 应用入口（C 负责）。持有状态，调用 state.js 和引擎，把结果交给 render。
import { DATA } from './data.js';
import { createBeaker, addSubstance, pour, filter } from './state.js';
import { react } from './engine/index.js';
import { render, AMOUNTS, nameOf, reagentLabel } from './render.js';

const STORE_KEY = 'chem-lab-v1';
const root = document.getElementById('app');

function freshApp() {
  return {
    beakers: [createBeaker('b1', '烧杯 1'), createBeaker('b2', '烧杯 2')],
    selected: 'b1',
    counter: 2,
    log: [],
    ui: { reagent: null, cat: 'all', search: '', pourTo: null },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshApp();
    const a = JSON.parse(raw);
    if (!Array.isArray(a.beakers)) return freshApp();
    return { ...freshApp(), ...a, ui: { ...freshApp().ui, ...a.ui } };
  } catch { return freshApp(); }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(app)); } catch { /* 无痕模式等，忽略 */ }
}

let app = load();
if (app.ui.reagent && !DATA.SUBSTANCES[app.ui.reagent]) app.ui.reagent = null;

const idx = id => app.beakers.findIndex(b => b.id === (id ?? app.selected));
const current = () => app.beakers[idx()];

function logEntry(title, events, note) {
  app.log.push({ title, events: events || [], note: note || '' });
  if (app.log.length > 200) app.log.splice(0, app.log.length - 200);
}

// 对第 i 个烧杯运行引擎，返回事件。
function run(i, extra = {}) {
  const b = app.beakers[i];
  try {
    const { beaker, events } = react(b, { data: DATA, heated: !!b.heated, ignite: false, ...extra });
    app.beakers[i] = beaker;
    return events;
  } catch (err) {
    console.error(err);
    return [{ kind: 'error', equation: null, ionic: null, observations: ['引擎出错：' + err.message] }];
  }
}

function act(title, i, extra) {
  const events = run(i, extra);
  logEntry(title, events, events.length ? '' : '无明显反应现象');
}

function newId() { app.counter = (app.counter || app.beakers.length) + 1; return 'b' + app.counter; }

const handlers = {
  select(id) { app.selected = id; draw(); },
  cat(k) { app.ui.cat = k; draw(); },
  search(q) { app.ui.search = q; save(); },
  reagent(id) { app.ui.reagent = id; draw(); },
  pourTo(id) { app.ui.pourTo = id; save(); },

  add(kind) {
    const i = idx(); const r = DATA.SUBSTANCES[app.ui.reagent];
    if (i < 0 || !r) return;
    const [, label, moles] = AMOUNTS.find(a => a[0] === kind) || AMOUNTS[2];
    try {
      app.beakers[i] = addSubstance(app.beakers[i], r.id, moles, DATA);
    } catch (err) {
      logEntry('加入失败', [], err.message); return draw();
    }
    const verb = kind === 'drop' ? '滴加 1 滴' : `加入${label}`;
    act(`向 ${app.beakers[i].label} ${verb}${reagentLabel(r)}`, i);
    draw();
  },

  heat() {
    const i = idx(); if (i < 0) return;
    const on = !app.beakers[i].heated;
    app.beakers[i] = { ...app.beakers[i], heated: on };
    if (on) act(`加热 ${app.beakers[i].label}`, i);
    else logEntry(`停止加热 ${app.beakers[i].label}`);
    draw();
  },

  ignite() {
    const i = idx(); if (i < 0) return;
    act(`点燃 ${app.beakers[i].label} 中的物质`, i, { ignite: true });
    draw();
  },

  pour(frac) {
    const i = idx(); if (i < 0) return;
    const sel = root.querySelector('#pourTo');
    const toId = sel?.value || app.ui.pourTo;
    const j = idx(toId);
    if (j < 0 || j === i) return;
    const f = Number(frac) || 1;
    const r = pour(app.beakers[i], app.beakers[j], f);
    app.beakers[i] = r.from; app.beakers[j] = r.to;
    app.ui.pourTo = toId;
    act(`把 ${app.beakers[i].label} ${f === 1 ? '全部' : '一半'}倒入 ${app.beakers[j].label}`, j);
    draw();
  },

  filter() {
    const i = idx(); if (i < 0) return;
    const b = app.beakers[i];
    const { filtrate, residue } = filter(b);
    const ids = Object.keys(residue);
    if (!ids.length) { logEntry(`过滤 ${b.label}`, [], '没有不溶物，滤纸上没有滤渣'); return draw(); }
    app.beakers[i] = { ...filtrate, label: b.label };
    const res = createBeaker(newId(), `${b.label} 的滤渣`, 0);
    res.solids = { ...residue };
    app.beakers.splice(i + 1, 0, res);
    logEntry(`过滤 ${b.label}`, [], `滤渣：${ids.map(nameOf).join('、')}（已放到“${res.label}”）；滤液留在 ${b.label}`);
    draw();
  },

  clear() {
    const i = idx(); if (i < 0) return;
    const b = app.beakers[i];
    app.beakers[i] = createBeaker(b.id, b.label);
    logEntry(`清空 ${b.label}，重新装入 50 mL 水`);
    draw();
  },

  remove() {
    const i = idx(); if (i < 0) return;
    const [b] = app.beakers.splice(i, 1);
    app.selected = app.beakers[Math.min(i, app.beakers.length - 1)]?.id || null;
    logEntry(`移除 ${b.label}`);
    draw();
  },

  newBeaker(kind) {
    const id = newId();
    const n = app.counter;
    const b = kind === 'empty' ? createBeaker(id, `试管 ${n}`, 0) : createBeaker(id, `烧杯 ${n}`);
    app.beakers.push(b);
    app.selected = id;
    draw();
  },

  clearLog() { app.log = []; draw(); },
  reset() {
    if (!confirm('重置实验台？所有烧杯和记录都会清空。')) return;
    app = freshApp(); draw();
  },
};

function draw() {
  render(app, root, handlers);
  save();
}
draw();
