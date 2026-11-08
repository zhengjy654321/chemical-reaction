// 烧杯状态的纯函数操作（B 负责）。约定见 CONTRACT.md 第 4 节。

export const EPS = 1e-9;
// 少于这么多水（mol，约 1 mL）视为"没有水"：固体不溶解，生成的可溶物也留作固体（如干试管里加热 KClO3 得到 KCl 固体）。
export const WATER_MIN = 0.05;
export const hasWater = b => (b.liquids.H2O || 0) >= WATER_MIN;
const PHASES = ['ions', 'dissolved', 'liquids', 'solids', 'gases'];

export function createBeaker(id, label, waterMl = 50) {
  const b = { id, label, heated: false, ions: {}, dissolved: {}, liquids: {}, solids: {}, gases: {} };
  if (waterMl > 0) b.liquids.H2O = waterMl / 18;
  return b;
}

export function clone(beaker) {
  const b = { ...beaker };
  for (const p of PHASES) b[p] = { ...beaker[p] };
  if (beaker.escaping) b.escaping = { ...beaker.escaping };
  return b;
}

export function addTo(obj, id, moles) {
  const v = (obj[id] || 0) + moles;
  if (v < EPS) delete obj[id]; else obj[id] = v;
}

// options.form === 's'，或烧杯里没有水时，固体试剂保持固态（不溶解电离），以便加热分解。
export function addSubstance(beaker, substanceId, moles, data, options = {}) {
  const b = clone(beaker);
  const sub = data.SUBSTANCES[substanceId];
  if (!sub) throw new Error(`未知物质: ${substanceId}`);
  // options.volumeMl：以溶液形式加入时这份溶液的体积，按水计入烧杯（离子浓度 = 物质的量 / 水的体积）。
  if (options.volumeMl > 0 && options.form !== 's' && sub.state !== 'g') addTo(b.liquids, 'H2O', options.volumeMl / 18);
  const keepSolid = sub.state === 's' && (options.form === 's' || !hasWater(b));
  if (keepSolid) {
    addTo(b.solids, substanceId, moles);
  } else if (sub.ions) {
    for (const [ion, n] of Object.entries(sub.ions)) addTo(b.ions, ion, n * moles);
  } else if (sub.soluble && substanceId !== 'H2O') {
    addTo(b.dissolved, substanceId, moles);
  } else if (sub.state === 'l') {
    addTo(b.liquids, substanceId, moles);
  } else if (sub.state === 'g') {
    addTo(b.gases, substanceId, moles);
  } else {
    addTo(b.solids, substanceId, moles);
  }
  return b;
}

export function pour(from, to, fraction = 1) {
  const f = clone(from);
  const t = clone(to);
  for (const p of ['ions', 'dissolved', 'liquids', 'solids']) {
    for (const [id, n] of Object.entries(from[p])) {
      addTo(f[p], id, -n * fraction);
      addTo(t[p], id, n * fraction);
    }
  }
  // 气体：集气瓶等容器里存着的气体（不是刚生成、正在逸出的）也能倒（通）进另一个容器。
  for (const [id, n0] of Object.entries(from.gases)) {
    const n = n0 - (from.escaping?.[id] || 0);
    if (n <= EPS) continue;
    addTo(f.gases, id, -n * fraction);
    addTo(t.gases, id, n * fraction);
  }
  return { from: f, to: t };
}

export function filter(beaker) {
  const filtrate = clone(beaker);
  const residue = { ...beaker.solids };
  filtrate.solids = {};
  return { filtrate, residue };
}

export function isEmpty(beaker) {
  return PHASES.every(p => Object.keys(beaker[p]).length === 0);
}

// ---------- 收集气体 ----------
const ATOMIC_MASS = { H: 1, He: 4, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40, K: 39, Ca: 40, Br: 80, I: 127 };
const AIR = 29;
// 与空气中的氧气反应、只能用排水法的气体；与水反应或易溶于水、不能用排水法的气体。
const AIR_REACTIVE = new Set(['NO']);
const WATER_REACTIVE = new Set(['NO2', 'Cl2', 'SO2', 'HCl', 'NH3', 'H2S']);

export function molarMass(formula) {
  let m = 0;
  const re = /([A-Z][a-z]?)(\d*)/g;
  for (const [, el, n] of String(formula).replace(/_\w+$/, '').matchAll(re)) m += (ATOMIC_MASS[el] || 0) * (n ? Number(n) : 1);
  return m;
}

// 气体的收集方法：难溶于水、不与水反应的用排水法；密度比空气大的可用向上排空气法，小的用向下排空气法；
// 和空气密度接近（CO、N2）或与空气反应（NO）的只能用排水法。返回可用方法列表，第一项为推荐。
export function collectMethods(id, data) {
  const s = data.SUBSTANCES[id];
  const f = s?.formula ?? id;
  const M = molarMass(f);
  const out = [];
  if (!WATER_REACTIVE.has(f) && !s?.soluble) out.push('排水法');
  if (!AIR_REACTIVE.has(f) && Math.abs(M - AIR) >= 2) out.push(M > AIR ? '向上排空气法' : '向下排空气法');
  if (!out.length) out.push(M > AIR ? '向上排空气法' : '向下排空气法');
  return out;
}

// 把烧杯里的气体（刚生成的和没反应完的）收集到一个新的集气瓶（没有水的容器）里。
// 返回 { from, jar, gases: [{ id, n, methods }] }；烧杯里没有气体时返回 null。
export function collectGas(beaker, data, jarId = 'jar', jarLabel = '集气瓶') {
  const ids = Object.keys(beaker.gases).filter(id => beaker.gases[id] > EPS);
  if (!ids.length) return null;
  const from = clone(beaker);
  const jar = createBeaker(jarId, jarLabel, 0);
  const gases = [];
  for (const id of ids) {
    const n = beaker.gases[id];
    jar.gases[id] = n;
    gases.push({ id, n, methods: collectMethods(id, data) });
    delete from.gases[id];
  }
  delete from.escaping;
  return { from, jar, gases };
}
