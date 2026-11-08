// 沉淀规则（B 负责）：溶液中阴阳离子组合在 INSOLUBLE 表里就生成沉淀。
// 骨架版本只生成离子方程式；分子方程式（equation）留给 B 线程补全。
import { clone, addTo } from '../state.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function precipitationRule(beaker, ctx) {
  const { INSOLUBLE, IONS, SUBSTANCES } = ctx.data;
  for (const row of INSOLUBLE) {
    const c = beaker.ions[row.cation];
    const a = beaker.ions[row.anion];
    if (!c || !a) continue;
    const qc = IONS[row.cation].charge;
    const qa = -IONS[row.anion].charge;
    const g = gcd(qc, qa);
    const nc = qa / g; // 阳离子个数
    const na = qc / g; // 阴离子个数
    const extent = Math.min(c / nc, a / na);
    const b = clone(beaker);
    addTo(b.ions, row.cation, -extent * nc);
    addTo(b.ions, row.anion, -extent * na);
    addTo(b.solids, row.product, extent);
    const prod = SUBSTANCES[row.product];
    return {
      beaker: b,
      event: {
        kind: 'precipitation',
        equation: null,
        ionic: {
          reactants: [{ formula: row.cation, n: nc }, { formula: row.anion, n: na }],
          products: [{ formula: prod.formula, n: 1, mark: '↓' }],
          condition: '',
        },
        observations: [`产生${prod.color}沉淀`],
        extent,
      },
    };
  }
  return null;
}
