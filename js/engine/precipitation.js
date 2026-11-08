// 沉淀规则（B 负责）：溶液中阴阳离子组合在 INSOLUBLE 表里就生成沉淀。
// 写出完整分子方程式（如 BaCl2 + H2SO4 = BaSO4↓ + 2HCl）和离子方程式。
import { describe, ionPairReaction, molTerm, sinkOf, cations, anions, waterL, isHeated, WEAK_ANIONS } from './common.js';

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
  for (const row of data.INSOLUBLE) {
    if (!cs.has(row.cation) || !as.has(row.anion)) continue;
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
  return null;
}
