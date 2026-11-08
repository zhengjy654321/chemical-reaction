// 沉淀规则（B 负责）：溶液中阴阳离子组合在 INSOLUBLE 表里就生成沉淀。
// 写出完整分子方程式（如 BaCl2 + H2SO4 = BaSO4↓ + 2HCl）和离子方程式。
import { hasWater } from '../state.js';
import { describe, ionPairReaction, molTerm, runReaction, aqTerm, ionTerm, productTerms, counterIon, charge, sinkOf, cations, anions, waterL, isHeated, WEAK_ANIONS } from './common.js';

// 微溶物在水中最多溶解的量（mol/L），超过才析出。粗略取 Ca(OH)2、CaSO4、Ag2SO4 的量级。
export const SLIGHT_LIMIT = 0.02;

// 酸碱反应（中和、放气）优先：溶液里还有 H⁺ 与弱酸根/OH⁻ 时先交给酸碱规则。
export function acidBasePending(beaker, data) {
  if (!beaker.ions['H^+']) return false;
  return anions(beaker, data).some(a => WEAK_ANIONS.includes(a) && sinkOf('H^+', a, data, false));
}

export function precipitationRule(beaker, ctx) {
  const { data } = ctx;
  if (acidBasePending(beaker, data)) return null;
  const heated = isHeated(beaker, ctx);
  const cs = new Set(cations(beaker, data));
  const as = new Set(anions(beaker, data));
  // 同时有几种沉淀可生成时，最难溶的先析出（AgNO3 滴入含 Cl⁻、I⁻ 的溶液先出 AgI）。
  const rows = data.INSOLUBLE.filter(r => cs.has(r.cation) && as.has(r.anion))
    .map(r => ({ r, s: molarSolubility(r, data) ?? 1e-3 }))
    .sort((x, y) => x.s - y.s).map(x => x.r);
  for (const row of rows) {
    const prod = data.SUBSTANCES[row.product];
    let cap;
    if (row.ksp) {
      // 用溶度积：离子积 Q > Ksp 才沉淀，沉淀到 Q = Ksp 为止。
      if (!hasWater(beaker)) continue;
      cap = (extent, ionic) => kspExtent(beaker, ionic, row, data, extent);
    } else if (row.slight) {
      const limit = SLIGHT_LIMIT * waterL(beaker);
      cap = (extent, ionic) => {
        const k = ionic.products.find(t => t.id === row.product)?.n || 1;
        return extent - limit / k;
      };
    }
    const r = ionPairReaction(beaker, data, row.cation, row.anion, {
      kind: 'precipitation', heated, cap,
      observations: [`产生${prod.color}沉淀`],
      sink: [{ ...molTerm(row.product, data), solid: true }],
    });
    if (!r) continue;
    // 只有这一对离子（例如直接加入过量 Ca(OH)2）：是没溶解完，而不是新生成沉淀。
    const msg = row.slight && !r.event.equation ? `${prod.name}微溶，部分未溶解` : `产生${prod.color}沉淀`;
    return describe(beaker, r, data, [msg]);
  }
  return hydrogenSulfide(beaker, ctx) || conversionRule(beaker, ctx) || dissolveRule(beaker, ctx);
}

// ---------- 溶度积计算 ----------
// 离子积 Q = c(阳)^m · c(阴)^n（c 单位 mol/L，体积取烧杯里水的体积）。
export function ionProduct(beaker, row, data, dc = 0, da = 0) {
  const V = waterL(beaker);
  const { m, n } = stoich(row, data);
  const c = ((beaker.ions[row.cation] || 0) + dc) / V, a = ((beaker.ions[row.anion] || 0) + da) / V;
  return c ** m * a ** n;
}
function stoich(row, data) {
  const qc = charge(row.cation, data), qa = -charge(row.anion, data);
  const g = gcdInt(qc, qa);
  return { m: qa / g, n: qc / g };
}
const COMPLETE = 1e-5; // 课本："离子浓度小于 1e-5 mol/L 视为沉淀完全"

// 简单沉淀（离子方程式只有这一对离子）时，二分求沉淀到 Q = Ksp 的反应进度；
// 带配对离子一起反应的复杂情况（如 Ba(OH)2 + CuSO4）按完全沉淀算。
function kspExtent(beaker, ionic, row, data, max) {
  const tc = ionic.reactants.find(t => t.formula === row.cation);
  const ta = ionic.reactants.find(t => t.formula === row.anion);
  if (!tc || !ta || ionic.reactants.length !== 2) return max;
  if (ionProduct(beaker, row, data) <= row.ksp) return 0;
  const V = waterL(beaker);
  const left = x => Math.min((beaker.ions[row.cation] - tc.n * x) / V, (beaker.ions[row.anion] - ta.n * x) / V);
  let lo = 0, hi = max;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (ionProduct(beaker, row, data, -tc.n * mid, -ta.n * mid) > row.ksp) lo = mid; else hi = mid;
  }
  // 剩下的离子浓度 < 1e-5 mol/L，或不到原来的 0.1%，算沉淀完全（课本对难溶物的处理）
  const frac = Math.min((beaker.ions[row.cation] - tc.n * lo) / beaker.ions[row.cation], (beaker.ions[row.anion] - ta.n * lo) / beaker.ions[row.anion]);
  return left(lo) < COMPLETE || frac < 1e-3 ? max : lo;
}

// 固体沉淀在水里还没达到饱和（Q < Ksp，例如加了水）时溶解一部分或全部。
function dissolveRule(beaker, ctx) {
  const { data } = ctx;
  if (!hasWater(beaker)) return null;
  for (const [id, amt] of Object.entries(beaker.solids)) {
    const row = data.INSOLUBLE.find(r => r.product === id && r.ksp);
    if (!row) continue;
    const { m, n } = stoich(row, data);
    if (ionProduct(beaker, row, data) >= row.ksp) continue;
    let lo = 0, hi = amt;
    if (ionProduct(beaker, row, data, m * amt, n * amt) <= row.ksp) lo = amt;
    else for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (ionProduct(beaker, row, data, m * mid, n * mid) < row.ksp) lo = mid; else hi = mid;
    }
    if (lo < Math.max(1e-5, amt * 0.05)) continue;
    const r = runReaction(beaker, data, [{ ...molTerm(id, data), solid: true }], [ionTerm(row.cation), ionTerm(row.anion)],
      { kind: 'precipitation', cap: () => lo });
    if (r) return describe(beaker, r, data, [lo >= amt - 1e-12 ? `${data.SUBSTANCES[id].name}全部溶解` : `${data.SUBSTANCES[id].name}部分溶解`]);
  }
  return null;
}

// ---------- 沉淀转化 ----------
// 难溶/微溶固体遇到能和它的离子生成"更难溶"物质的离子时，转化成更难溶的沉淀：
// CaSO4 + Na2CO3 = CaCO3 + Na2SO4，AgCl + KI = AgI + KCl，ZnS + CuSO4 = CuS + ZnSO4，
// 3Mg(OH)2 + 2FeCl3 = 2Fe(OH)3 + 3MgCl2。用 INSOLUBLE 表里的溶度积 ksp 算出的溶解度比较，新沉淀至少难溶 3 倍才转化。
const CONVERT_RATIO = 3;

// 摩尔溶解度 s：Ksp = (m·s)^m (n·s)^n。
function molarSolubility(row, data) {
  const ksp = row.ksp;
  if (!ksp) return null;
  const qc = charge(row.cation, data), qa = -charge(row.anion, data);
  const g = gcdInt(qc, qa), m = qa / g, n = qc / g;
  return (ksp / (m ** m * n ** n)) ** (1 / (m + n));
}
const gcdInt = (a, b) => (b ? gcdInt(b, a % b) : a);

// H2S 通入 Cu²⁺、Ag⁺、Pb²⁺ 溶液：生成不溶于酸的硫化物，H2S + CuSO4 = CuS↓ + H2SO4。
const ACID_PROOF_SULFIDE = new Set(['CuS', 'Ag2S', 'PbS', 'HgS']);
function hydrogenSulfide(beaker, ctx) {
  const { data } = ctx;
  if (!(beaker.dissolved.H2S || beaker.gases.H2S)) return null;
  for (const row of data.INSOLUBLE) {
    if (row.anion !== 'S^2-' || !ACID_PROOF_SULFIDE.has(row.product) || !beaker.ions[row.cation]) continue;
    const A = counterIon(beaker, data, -1, ['S^2-'], row.cation);
    const reac = [molTerm('H2S', data), A ? aqTerm(row.cation, A, data) : ionTerm(row.cation)];
    const prod = [{ ...molTerm(row.product, data), solid: true }, A ? aqTerm('H^+', A, data) : ionTerm('H^+')];
    const r = runReaction(beaker, data, reac, prod, { kind: 'precipitation' });
    if (r) return describe(beaker, r, data, [`产生${data.SUBSTANCES[row.product].color}沉淀`]);
  }
  return null;
}

export function conversionRule(beaker, ctx) {
  const { data } = ctx;
  if (acidBasePending(beaker, data)) return null;
  const heated = isHeated(beaker, ctx);
  for (const id of Object.keys(beaker.solids)) {
    const old = data.INSOLUBLE.find(r => r.product === id);
    const s0 = old && molarSolubility(old, data);
    if (!s0) continue;
    // 换阴离子（CaSO4 + CO3²⁻）或换阳离子（ZnS + Cu²⁺）
    const candidates = data.INSOLUBLE.filter(r => r.product !== id && (
      (r.cation === old.cation && beaker.ions[r.anion]) || (r.anion === old.anion && beaker.ions[r.cation])));
    let best = null, bestS = s0 / CONVERT_RATIO;
    for (const r of candidates) {
      const s = molarSolubility(r, data);
      if (s && s < bestS && data.SUBSTANCES[r.product]) { best = r; bestS = s; }
    }
    if (!best) continue;
    const newProd = { ...molTerm(best.product, data), solid: true };
    let reac, prod;
    if (best.cation === old.cation) {
      const C = counterIon(beaker, data, 1, [old.cation], best.anion);
      reac = [molTerm(id, data), C ? aqTerm(C, best.anion, data) : ionTerm(best.anion)];
      prod = [newProd, ...(C ? productTerms(C, old.anion, data, heated) : [ionTerm(old.anion)])];
    } else {
      const A = counterIon(beaker, data, -1, [old.anion], best.cation);
      reac = [molTerm(id, data), A ? aqTerm(best.cation, A, data) : ionTerm(best.cation)];
      prod = [newProd, ...(A ? productTerms(old.cation, A, data, heated) : [ionTerm(old.cation)])];
    }
    const r = runReaction(beaker, data, reac, prod, { kind: 'precipitation' });
    if (!r) continue;
    const a = data.SUBSTANCES[id], b = data.SUBSTANCES[best.product];
    const msg = a.color === b.color ? `${a.name}逐渐转化为更难溶的${b.name}` : `${a.color}沉淀逐渐转化为${b.color}沉淀（${b.name}）`;
    return describe(beaker, r, data, [msg]);
  }
  return null;
}
