// 应用入口（C 负责）。持有状态，调用 state.js 和引擎，把结果交给 render。
import { DATA } from './data.js?v=4';
import { createBeaker, addSubstance, pour, filter, collectGas } from './state.js?v=4';
import { react } from './engine/index.js?v=4';
import { render, nameOf, reagentLabel, canBeSolid, amountState, amountReadout } from './render.js?v=4';
import { EXPLOSIONS, loadExplosion, triggerExplosion, maxIntensity, triggerLabel, nozzleIgnite } from './explosions.js?v=4';
import { play as playFx, calm as calmFx, setMuted } from './fx.js?v=4';
import { MODES, DROP_ML, fromPos } from './amount.js';

const STORE_KEY = 'chem-lab-v1';
const root = document.getElementById('app');

function freshApp() {
  return {
    beakers: [createBeaker('b1', '烧杯 1'), createBeaker('b2', '烧杯 2')],
    selected: 'b1',
    counter: 2,
    log: [],
    ui: { reagent: null, form: 'aq', cat: 'all', search: '', pourTo: null, amt: { conc: 1 }, boomOpen: false, armed: null, mute: false },
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
setMuted(app.ui.mute);
let pendingFx = null; // 下一次画完界面后要播放的特效 { id, level, reactionId }

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

// 运行反应并记录；猛烈的反应排队播放特效，等级 3（爆炸）会把烧杯炸碎。
function act(title, i, extra) {
  const events = run(i, extra);
  const level = maxIntensity(events);
  let note = events.length ? '' : '无明显反应现象';
  if (level) {
    const top = events.find(e => (e.intensity || 0) === level);
    const b = app.beakers[i];
    pendingFx = { id: b.id, level, reactionId: top?.reactionId };
    if (level >= 3) {
      app.beakers[i] = { ...b, broken: true, heated: false };
      note = `💥 ${b.label} 被炸碎了！点「清空」可以换一个新的`;
    }
  }
  if (app.ui.armed?.id === app.beakers[i].id && level) app.ui.armed = null;
  logEntry(title, events, note);
}

// 已炸碎的容器不能再用
function broken(i) {
  if (!app.beakers[i]?.broken) return false;
  logEntry(`${app.beakers[i].label} 已经炸碎了`, [], '先点「清空」换一个新的，或者点「移除」');
  draw();
  return true;
}

function addReagent(isDrop) {
  const i = idx(); const r = DATA.SUBSTANCES[app.ui.reagent];
  if (i < 0 || !r || broken(i)) return;
  const solid = app.ui.form === 's' && canBeSolid(r);
  const st = amountState(app, r, solid);
  const vol = isDrop ? DROP_ML : st.value;
  const moles = isDrop
    ? (st.mode === 'aq' ? DROP_ML / 1000 * st.conc : st.moles / st.value * DROP_ML)
    : st.moles;
  const opts = solid ? { form: 's' } : (st.mode === 'aq' || st.mode === 'l') ? { volumeMl: vol } : {};
  try {
    app.beakers[i] = addSubstance(app.beakers[i], r.id, moles, DATA, opts);
  } catch (err) {
    logEntry('加入失败', [], err.message); return draw();
  }
  const conc = st.mode === 'aq' ? ` ${st.conc} mol/L ` : ' ';
  const what = solid ? r.name + '固体' : reagentLabel(r);
  const verb = isDrop ? `滴加 1 滴${conc}${what}` : st.mode === 'g' ? `通入 ${st.value} mL ${what}` : `加入 ${st.value} ${st.m.unit}${conc}${what}`;
  act(`向 ${app.beakers[i].label} ${verb}`, i);
  draw();
}

function newId() { app.counter = (app.counter || app.beakers.length) + 1; return 'b' + app.counter; }

const handlers = {
  select(id) { app.selected = id; draw(); },
  cat(k) { app.ui.cat = k; draw(); },
  search(q) { app.ui.search = q; save(); },
  reagent(id) { app.ui.reagent = id; app.ui.form = 'aq'; draw(); },
  form(f) { app.ui.form = f; draw(); },
  pourTo(id) { app.ui.pourTo = id; save(); },

  // 滑动条拖动时只更新读数，不整页重画（否则会打断拖动）
  amtSlide(pos) {
    const r = DATA.SUBSTANCES[app.ui.reagent]; if (!r) return;
    const solid = app.ui.form === 's' && canBeSolid(r);
    const { mode } = amountState(app, r, solid);
    app.ui.amt = { ...app.ui.amt, [mode]: fromPos(MODES[mode], pos) };
    const st = amountState(app, r, solid);
    const out = root.querySelector('#amtOut'); if (out) out.innerHTML = amountReadout(st);
    const btn = root.querySelector('#amtBtn'); if (btn) btn.textContent = `${st.value} ${st.m.unit}`;
    root.querySelectorAll('[data-act="amtPreset"]').forEach(el => el.classList.toggle('on', Number(el.dataset.arg) === st.value));
    save();
  },
  amtPreset(v) {
    const r = DATA.SUBSTANCES[app.ui.reagent]; if (!r) return;
    const { mode } = amountState(app, r, app.ui.form === 's' && canBeSolid(r));
    app.ui.amt = { ...app.ui.amt, [mode]: Number(v) };
    draw();
  },
  conc(c) { app.ui.amt = { ...app.ui.amt, conc: Number(c) }; draw(); },

  drop() { addReagent(true); },
  addAmount() { addReagent(false); },

  heat() {
    const i = idx(); if (i < 0 || broken(i)) return;
    const on = !app.beakers[i].heated;
    app.beakers[i] = { ...app.beakers[i], heated: on };
    if (on) act(`加热 ${app.beakers[i].label}`, i);
    else logEntry(`停止加热 ${app.beakers[i].label}`);
    draw();
  },

  ignite() {
    const i = idx(); if (i < 0 || broken(i)) return;
    act(`点燃 ${app.beakers[i].label} 中的物质`, i, { ignite: true });
    draw();
  },

  // 导管口点燃：纯净的可燃气体在空气中安静燃烧；混有氧气则爆炸
  nozzle() {
    const i = idx(); if (i < 0 || broken(i)) return;
    const b = app.beakers[i];
    const r = nozzleIgnite(b);
    if (!r.fuels.length) {
      logEntry(`在导管口点燃 ${b.label} 的气体`, [], '容器里没有可燃气体（氢气、一氧化碳、甲烷），点不着');
      return draw();
    }
    const names = r.fuels.map(nameOf).join('、');
    app.beakers[i] = r.beaker;
    act(r.mixed ? `在导管口点燃 ${b.label} 的${names}（混有氧气，气体不纯！）` : `在导管口点燃 ${b.label} 导出的纯净${names}`, i, r.ctx);
    if (!r.mixed) pendingFx = { id: b.id, calm: true, reactionId: r.fuels.includes('CO') ? 'co-o2' : 'h2-o2' };
    if (app.ui.armed?.id === b.id) app.ui.armed = null;
    draw();
  },

  light() {
    const i = idx(); if (i < 0 || broken(i)) return;
    act(`用强光照射 ${app.beakers[i].label}`, i, { light: true });
    draw();
  },

  // 爆炸反应面板
  boomPanel() { app.ui.boomOpen = !app.ui.boomOpen; draw(); },
  mute() { app.ui.mute = !app.ui.mute; setMuted(app.ui.mute); draw(); },
  // 选一个爆炸实验：装好反应物，放到新容器里等待引发
  boomLoad(pid) {
    const p = EXPLOSIONS.find(x => x.id === pid); if (!p) return;
    const id = newId();
    const kind = p.water ? '烧杯' : p.load.every(([, , f]) => f === 'g') ? '集气瓶' : p.load.some(([, , f]) => f === 'g') ? '燃烧瓶' : '试管';
    const b = loadExplosion(p, id, `${kind} ${app.counter}`, DATA);
    app.beakers.push(b);
    app.selected = id;
    app.ui.armed = { id, preset: p.id };
    app.ui.boomOpen = false;
    const what = p.load.map(([sid]) => nameOf(sid)).join('、') || '50 mL 水';
    logEntry(`准备实验：${p.title}`, [], `已在“${b.label}”中装入${what}。点烧杯上的「${triggerLabel(p.trigger)}」引发反应`);
    draw();
    setTimeout(() => root.querySelector(`.beaker[data-arg="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  },
  // 点烧杯上的触发按钮
  fire(id) {
    const i = idx(id); const p = EXPLOSIONS.find(x => x.id === app.ui.armed?.preset);
    if (i < 0 || !p || app.ui.armed.id !== id || broken(i)) return;
    app.selected = id;
    const { beaker, ctx } = triggerExplosion(p, app.beakers[i], DATA);
    app.beakers[i] = beaker;
    const t = p.trigger;
    const title = t.type === 'add' ? `向 ${beaker.label} 中投入一小块${nameOf(t.id)}`
      : t.type === 'light' ? `用强光照射 ${beaker.label}` : t.type === 'nozzle' ? `在导管口点燃 ${beaker.label} 导出的纯净气体` : `${triggerLabel(t)} ${beaker.label} 中的物质`;
    act(title, i, ctx);
    if (ctx.quiet) pendingFx = { id, calm: true, reactionId: p.reaction };
    app.ui.armed = null;
    draw();
  },

  pour(frac) {
    const i = idx(); if (i < 0 || broken(i)) return;
    const sel = root.querySelector('#pourTo');
    const toId = sel?.value || app.ui.pourTo;
    const j = idx(toId);
    if (j < 0 || j === i || broken(j)) return;
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

  // 收集气体：把选中容器里的气体收集到一个新的集气瓶，按气体性质给出收集方法。
  collect() {
    const i = idx(); if (i < 0) return;
    const b = app.beakers[i];
    const id = newId();
    const r = collectGas(b, DATA, id, `集气瓶 ${app.counter}`);
    if (!r) { logEntry(`收集 ${b.label} 的气体`, [], '没有气体可收集（气体刚产生时点「收集气体」）'); return draw(); }
    app.beakers[i] = r.from;
    r.jar.label = `集气瓶 ${app.counter}（${r.gases.map(g => nameOf(g.id)).join('、')}）`;
    app.beakers.splice(i + 1, 0, r.jar);
    const how = r.gases.map(g => `${nameOf(g.id)}用${g.methods[0]}${g.methods.length > 1 ? `（也可用${g.methods.slice(1).join('、')}）` : ''}`).join('；');
    logEntry(`收集 ${b.label} 的气体`, [], `${how}。已收集到“${r.jar.label}”，可以把它倒入别的烧杯，或点燃`);
    draw();
  },

  clear() {
    const i = idx(); if (i < 0) return;
    const b = app.beakers[i];
    app.beakers[i] = createBeaker(b.id, b.label);
    if (app.ui.armed?.id === b.id) app.ui.armed = null;
    logEntry(`${b.broken ? '扫掉碎片，换一个新容器' : '清空 ' + b.label}，装入 50 mL 水`);
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
  if (pendingFx) {
    const fx = pendingFx; pendingFx = null;
    const el = root.querySelector(`.beaker[data-arg="${fx.id}"] .beaker-stage`);
    try { if (fx.calm) calmFx(el, fx.reactionId); else playFx(fx.level, el, fx.reactionId); } catch (err) { console.error(err); }
  }
}
draw();
