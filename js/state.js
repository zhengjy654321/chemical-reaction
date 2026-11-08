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
