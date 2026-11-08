// 引擎内部共用工具（B 负责）。
import { EPS, addTo, clone } from '../state.js';
import { balance, parseFormula } from '../equation.js';

// 在烧杯中查找某个物质/离子 id 的数量，及其所在的相。
export function amountOf(beaker, id) {
  for (const p of ['ions', 'dissolved', 'liquids', 'solids', 'gases']) {
    if (beaker[p][id] > EPS) return { phase: p, n: beaker[p][id] };
  }
  return { phase: null, n: 0 };
}

// 产物放到哪一相：离子 -> ions；否则按物质常温状态和溶解性。
export function phaseFor(id, data) {
  if (data.IONS[id]) return 'ions';
  const s = data.SUBSTANCES[id];
  if (!s) throw new Error(`未知物质: ${id}`);
  if (s.state === 'g') return 'gases';
  if (id === 'H2O' || s.state === 'l' && !s.soluble) return 'liquids';
  if (s.soluble && !s.ions) return 'dissolved';
  return 'solids';
}

export function formulaOf(id, data) {
  return data.IONS[id] ? id : (data.SUBSTANCES[id]?.formula ?? id);
}

// 把生成物放进烧杯：可溶强电解质拆成离子，其余按 phaseFor 放。
export function addProduct(beaker, id, moles, data) {
  const s = data.SUBSTANCES[id];
  if (s && s.ions && s.soluble) {
    for (const [ion, k] of Object.entries(s.ions)) addTo(beaker.ions, ion, k * moles);
  } else {
    addTo(beaker[phaseFor(id, data)], id, moles);
  }
}

export function markFor(id, data) {
  const s = data.SUBSTANCES[id];
  if (s && s.ions && s.soluble) return '';
  const p = phaseFor(id, data);
  return p === 'gases' ? '↑' : p === 'solids' ? '↓' : '';
}

export const isHeated = (beaker, ctx) => !!(ctx.heated || beaker.heated);

// ---------- 离子与化合物 ----------

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const charge = (id, data) => data.IONS[id]?.charge ?? parseFormula(id).charge;
export const cations = (beaker, data) => Object.keys(beaker.ions).filter(i => charge(i, data) > 0);
export const anions = (beaker, data) => Object.keys(beaker.ions).filter(i => charge(i, data) < 0);

// 写分子方程式用的"配对离子"：溶液中数量最多的某类离子（排除 exclude）。
// 给了 partner 时，优先选和 partner 组成可溶物的离子（Ag⁺ 配 NO₃⁻ 而不是 SO₄²⁻）。
export function counterIon(beaker, data, sign, exclude = [], partner = null) {
  let best = null, bestScore = -Infinity;
  for (const [id, n] of Object.entries(beaker.ions)) {
    if (exclude.includes(id) || Math.sign(charge(id, data)) !== sign) continue;
    const pair = partner && (sign < 0 ? insolubleRow(partner, id, data) : insolubleRow(id, partner, data));
    const score = (pair ? 0 : 1e6) + n;
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return best;
}

const index = new WeakMap();
function byIons(data) {
  let m = index.get(data.SUBSTANCES);
  if (!m) {
    m = new Map();
    for (const s of Object.values(data.SUBSTANCES)) {
      if (!s.ions) continue;
      const key = Object.keys(s.ions).sort().join('|');
      const old = m.get(key);
      if (!old || (old.id !== old.formula && s.id === s.formula)) m.set(key, s);
    }
    index.set(data.SUBSTANCES, m);
  }
  return m;
}

const insolubleRow = (c, a, data) => data.INSOLUBLE.find(r => r.cation === c && r.anion === a);

// 由阴阳离子拼出化合物化学式，如 (Ba^2+, NO3^-) -> Ba(NO3)2。
function buildFormula(c, a, data) {
  const qc = charge(c, data), qa = -charge(a, data);
  const g = gcd(qc, qa);
  const nc = qa / g, na = qc / g;
  const part = (id, n) => {
    const f = data.IONS[id]?.formula ?? id.replace(/\^.*$/, '');
    const poly = (f.match(/[A-Z]/g) || []).length > 1;
    return n === 1 ? f : poly ? `(${f})${n}` : f + n;
  };
  return { formula: part(c, nc) + part(a, na), ions: { [c]: nc, [a]: na } };
}

// 弱电解质/气体"去路"：H⁺ 与弱酸根、NH₄⁺ 与 OH⁻（加热）结合后生成什么。
const WEAK = {
  'OH^-': { H2O: 1 },
  'CO3^2-': { H2O: 1, CO2: 1 },
  'HCO3^-': { H2O: 1, CO2: 1 },
  'SO3^2-': { H2O: 1, SO2: 1 },
  'HSO3^-': { H2O: 1, SO2: 1 },
  'S^2-': { H2S: 1 },
  'HS^-': { H2S: 1 },
  'CH3COO^-': { CH3COOH: 1 },
  'ClO^-': { HClO: 1 },
  'SiO3^2-': { H2SiO3: 1 },
  'F^-': { HF: 1 },
};
export const WEAK_ANIONS = Object.keys(WEAK);

// 阴阳离子相遇后的"去路"：返回生成物 id 列表（不带系数，配平决定），可溶则返回 null。
export function sinkOf(c, a, data, heated) {
  if (c === 'H^+' && WEAK[a]) {
    const ids = Object.keys(WEAK[a]);
    return ids.every(id => data.SUBSTANCES[id]) ? ids : null;
  }
  if (c === 'NH4^+' && a === 'OH^-') {
    return heated && data.SUBSTANCES.NH3 ? ['NH3', 'H2O'] : null;
  }
  const row = insolubleRow(c, a, data);
  if (row && !row.slight) return [row.product];
  return null;
}

// 溶液中的可溶化合物（反应物或生成物），写分子方程式用；在离子方程式里拆成离子。
export function aqTerm(c, a, data) {
  if (c === 'H^+' && a === 'OH^-') return { id: 'H2O', formula: 'H2O' };
  if (c === 'NH4^+' && a === 'OH^-') return { formula: 'NH3·H2O', ions: { 'NH4^+': 1, 'OH^-': 1 } };
  const s = byIons(data).get([c, a].sort().join('|'));
  if (s) return { id: s.id, formula: s.formula, ions: { ...s.ions } };
  return buildFormula(c, a, data);
}

export const molTerm = (id, data) => ({ id, formula: formulaOf(id, data) });
export const ionTerm = id => ({ id, formula: id, ion: true });

// 生成物：先看是否沉淀/弱电解质，否则是溶液中的可溶化合物。
export function productTerms(c, a, data, heated) {
  const s = sinkOf(c, a, data, heated);
  return s ? s.map(id => molTerm(id, data)) : [aqTerm(c, a, data)];
}

// ---------- 通用反应执行 ----------

function mergeTerms(list) {
  const out = [];
  for (const t of list) {
    const old = out.find(o => o.formula === t.formula);
    if (old) old.n += t.n; else out.push({ ...t });
  }
  return out;
}

const phaseOfTerm = (t, data) => (t.ion ? 'ions' : t.ions ? 'aq' : t.solid ? 'solids' : phaseFor(t.id, data));

function marks(terms, from, data) {
  const fromPhases = from.map(t => phaseOfTerm(t, data));
  return terms.map(t => {
    const p = phaseOfTerm(t, data);
    let mark = p === 'gases' ? '↑' : p === 'solids' ? '↓' : '';
    if (mark && fromPhases.includes(p)) mark = '';
    return { formula: t.formula, n: t.n, mark };
  });
}

// 把分子方程式拆成离子方程式：可溶化合物拆成离子，两边相同的抵消，系数约到最简。
function toIonic(reactants, products) {
  const side = terms => {
    const m = new Map();
    for (const t of terms) {
      if (t.ions) for (const [ion, k] of Object.entries(t.ions)) m.set(ion, { ...(m.get(ion) || ionTerm(ion)), n: (m.get(ion)?.n || 0) + k * t.n });
      else m.set(t.formula, { ...(m.get(t.formula) || t), n: (m.get(t.formula)?.n || 0) + t.n });
    }
    return m;
  };
  const l = side(reactants), r = side(products);
  for (const [k, t] of l) {
    if (!r.has(k)) continue;
    const d = Math.min(t.n, r.get(k).n);
    t.n -= d; r.get(k).n -= d;
  }
  const L = [...l.values()].filter(t => t.n > 0), R = [...r.values()].filter(t => t.n > 0);
  const g = [...L, ...R].reduce((x, t) => gcd(x, t.n), 0) || 1;
  return { reactants: L.map(t => ({ ...t, n: t.n / g })), products: R.map(t => ({ ...t, n: t.n / g })) };
}

const hasIonTerm = terms => terms.some(t => t.ion);

/**
 * 执行一个反应：给出反应物、生成物（不带系数），自动配平、写出分子方程式和离子方程式，
 * 按离子方程式在烧杯里计算反应进度并更新烧杯。
 * terms: { id?, formula, ions? (溶液中的可溶化合物), ion? (单个离子) }
 * opts: { kind, condition, observations, cap(extent) -> extent }
 */
export function runReaction(beaker, data, reactants, products, opts) {
  // 课本写法：酸写在后面（NaOH + HCl、CaCO3 + 2HCl）；水和气体写在最后（NaCl + H2O、H2O + CO2↑）。
  const acidLast = t => (t.ions?.['H^+'] ? 1 : 0);
  const tailKey = t => (t.id === 'H2O' ? 1 : t.id && !t.ion && !t.ions && data.SUBSTANCES[t.id]?.state === 'g' ? 2 : 0);
  reactants = mergeTerms(reactants.map(t => ({ ...t, n: 1 }))).sort((x, y) => acidLast(x) - acidLast(y));
  products = mergeTerms(products.map(t => ({ ...t, n: 1 }))).sort((x, y) => tailKey(x) - tailKey(y));
  const coefs = balance(reactants.map(t => t.formula), products.map(t => t.formula));
  if (!coefs) return null;
  reactants.forEach((t, i) => { t.n = coefs[i]; });
  products.forEach((t, i) => { t.n = coefs[reactants.length + i]; });

  const ionic = toIonic(reactants, products);
  if (!ionic.reactants.length) return null;
  if (ionic.reactants.length === 2 && ionic.reactants.every(t => t.ion)) {
    ionic.reactants.sort((x, y) => (y.formula === 'H^+') - (x.formula === 'H^+'));
  }
  const amount = t => (t.ion ? beaker.ions[t.formula] || 0 : amountOf(beaker, t.id).n);
  let extent = Math.min(...ionic.reactants.map(t => amount(t) / t.n));
  if (opts.cap) extent = opts.cap(extent, ionic);
  if (!(extent > EPS) || !Number.isFinite(extent)) return null;

  const b = clone(beaker);
  for (const t of ionic.reactants) {
    const phase = t.ion ? 'ions' : amountOf(beaker, t.id).phase;
    addTo(b[phase], t.ion ? t.formula : t.id, -t.n * extent);
  }
  for (const t of ionic.products) {
    if (t.ion) addTo(b.ions, t.formula, t.n * extent);
    else if (t.solid) addTo(b.solids, t.id, t.n * extent); // 微溶物析出（数据里它带 ions，不能再拆）
    else addProduct(b, t.id, t.n * extent, data);
  }

  const condition = opts.condition || '';
  const molecular = hasIonTerm(reactants) || hasIonTerm(products) ? null : {
    reactants: marks(reactants, [], data).map(t => ({ ...t, mark: '' })),
    products: marks(products, reactants, data),
    condition,
  };
  const anyIon = [...ionic.reactants, ...ionic.products].some(t => t.ion);
  const ionicEq = anyIon ? {
    reactants: ionic.reactants.map(t => ({ formula: t.formula, n: t.n, mark: '' })),
    products: marks(ionic.products, ionic.reactants, data),
    condition,
  } : null;
  return {
    beaker: b,
    event: { kind: opts.kind, equation: molecular, ionic: ionicEq, observations: opts.observations || [], extent },
  };
}

// 两种溶液中的离子相遇（c 与 a 结合）：写成"c 的盐 + a 的盐 = 沉淀/弱电解质 + 新盐"。
export function ionPairReaction(beaker, data, c, a, opts) {
  const heated = !!opts.heated;
  const A = counterIon(beaker, data, -1, [a], c);
  const C = counterIon(beaker, data, 1, [c], a);
  const sink = opts.sink || productTerms(c, a, data, heated);
  if (A && C) {
    return runReaction(beaker, data,
      [aqTerm(c, A, data), aqTerm(C, a, data)],
      [...sink, ...productTerms(C, A, data, heated)], opts);
  }
  return runReaction(beaker, data, [ionTerm(c), ionTerm(a)], sink, opts);
}

// 水的体积（升）。
export const waterL = beaker => ((beaker.liquids.H2O || 0) * 18) / 1000;

// ---------- 现象 ----------

const GAS_NOTE = {
  CO2: '产生气泡（无色无味气体）',
  H2: '产生气泡',
  O2: '产生气泡',
  NH3: '产生有刺激性气味的气体',
  SO2: '产生有刺激性气味的气体',
  H2S: '产生有臭鸡蛋气味的气体',
  Cl2: '产生黄绿色有刺激性气味的气体',
  NO2: '产生红棕色气体',
};

// 溶液颜色：取有颜色的离子里数量最多的一种。
export function solutionColor(beaker, data) {
  let best = null;
  for (const [id, n] of Object.entries(beaker.ions)) {
    const c = data.IONS[id]?.color;
    if (c && c !== '无色' && (!best || n > best.n)) best = { c, n };
  }
  return best ? best.c : '无色';
}

// 根据反应前后的烧杯和事件补充通用现象（沉淀、气体、固体溶解、溶液变色）。
export function describe(before, result, data, extra = []) {
  if (!result) return result;
  const { beaker: after, event } = result;
  const obs = [...extra];
  const eq = event.ionic || event.equation;
  const reactIds = new Set(eq.reactants.map(t => t.formula));
  for (const t of eq.products) {
    const id = Object.keys(data.SUBSTANCES).find(k => data.SUBSTANCES[k].formula === t.formula && !k.includes('_')) || t.formula;
    const s = data.SUBSTANCES[id];
    if (!s || reactIds.has(t.formula)) continue;
    let p;
    try { p = t.mark === '↓' ? 'solids' : phaseFor(id, data); } catch { continue; }
    if (p === 'gases' && !obs.some(o => /气泡|气体/.test(o))) obs.push(GAS_NOTE[id] || `产生${s.color && s.color !== '无色' ? s.color : ''}气体`);
    if (p === 'solids' && !obs.some(o => o.includes(s.name)) && !extra.length) obs.push(`产生${s.color}沉淀`);
  }
  const c0 = solutionColor(before, data), c1 = solutionColor(after, data);
  if (c0 !== c1) obs.push(c0 === '无色' ? `溶液变为${c1}` : c1 === '无色' ? `溶液${c0}褪去` : `溶液由${c0}变为${c1}`);
  if (!obs.length) obs.push('无明显现象');
  event.observations = [...new Set(obs)];
  return result;
}
