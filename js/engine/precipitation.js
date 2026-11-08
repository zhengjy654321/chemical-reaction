// 沉淀规则（B 负责）：溶液中阴阳离子组合在 INSOLUBLE 表里就生成沉淀。
// 写出完整分子方程式（如 BaCl2 + H2SO4 = BaSO4↓ + 2HCl）和离子方程式。
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
    if (row.slight) {
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
  return hydrogenSulfide(beaker, ctx) || conversionRule(beaker, ctx);
}

// ---------- 沉淀转化 ----------
// 难溶/微溶固体遇到能和它的离子生成"更难溶"物质的离子时，转化成更难溶的沉淀：
// CaSO4 + Na2CO3 = CaCO3 + Na2SO4，AgCl + KI = AgI + KCl，ZnS + CuSO4 = CuS + ZnSO4，
// 3Mg(OH)2 + 2FeCl3 = 2Fe(OH)3 + 3MgCl2。用溶度积算出的溶解度比较，新沉淀至少难溶 3 倍才转化。
export const KSP = {
  CaSO4: 4.9e-5, 'Ca(OH)2': 5.5e-6, CaCO3: 3.4e-9, CaSO3: 3.1e-7, 'Ca3(PO4)2': 2.0e-29,
  BaSO4: 1.1e-10, BaCO3: 2.6e-9, BaSO3: 5.0e-10, 'Ba3(PO4)2': 3.4e-23,
  'Mg(OH)2': 5.6e-12, MgCO3: 6.8e-6,
  'Al(OH)3': 1.3e-33, 'Zn(OH)2': 3.0e-17, ZnCO3: 1.5e-10, ZnS: 2.5e-22,
  'Fe(OH)2': 4.9e-17, FeCO3: 3.1e-11, FeS: 6.3e-18, 'Fe(OH)3': 2.8e-39,
  'Cu(OH)2': 2.2e-20, CuS: 6.3e-36,
  AgCl: 1.8e-10, AgBr: 5.4e-13, AgI: 8.5e-17, Ag2CO3: 8.5e-12, Ag3PO4: 8.9e-17, Ag2S: 6.3e-50, Ag2SO4: 1.2e-5,
  PbSO4: 2.5e-8, PbI2: 9.8e-9, PbS: 8.0e-28, PbCO3: 7.4e-14, PbCl2: 1.7e-5,
};
const CONVERT_RATIO = 3;

// 摩尔溶解度 s：Ksp = (m·s)^m (n·s)^n。
function molarSolubility(row, data) {
  const ksp = KSP[row.product];
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
