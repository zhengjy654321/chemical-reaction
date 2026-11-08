// 特殊反应规则（B 负责）：按 data/reactions.js 的 REACTIONS 匹配。
import { clone, addTo } from '../state.js';
import { amountOf, addProduct, formulaOf, markFor } from './common.js';

const CONDITION_LABEL = { none: '', heat: '加热', ignite: '点燃', electrolysis: '通电' };

function conditionMet(r, beaker, ctx) {
  if (r.condition === 'heat' && !(ctx.heated || beaker.heated)) return false;
  if (r.condition === 'ignite' && !ctx.ignite) return false;
  if (r.condition === 'electrolysis' && !ctx.electrolysis) return false;
  if (r.catalyst && amountOf(beaker, r.catalyst).n === 0) return false;
  return true;
}

// 课本规则：反应物中有气体时生成物气体不标 ↑；反应物中有固体时生成物固体不标 ↓。
function toTerms(obj, data, from) {
  const fromMarks = from ? Object.keys(from).map(id => markFor(id, data)) : null;
  return Object.entries(obj).map(([id, n]) => {
    let mark = fromMarks ? markFor(id, data) : '';
    if (mark && fromMarks.includes(mark)) mark = '';
    return { formula: formulaOf(id, data), n, mark };
  });
}

export function specialRule(beaker, ctx) {
  const { data } = ctx;
  const list = [...data.REACTIONS].sort((x, y) => (y.priority || 0) - (x.priority || 0));
  for (const r of list) {
    if (!conditionMet(r, beaker, ctx)) continue;
    let extent = Infinity;
    for (const [id, n] of Object.entries(r.match)) extent = Math.min(extent, amountOf(beaker, id).n / n);
    if (!(extent > 0) || extent === Infinity) continue;
    const b = clone(beaker);
    for (const [id, n] of Object.entries(r.match)) addTo(b[amountOf(beaker, id).phase], id, -n * extent);
    for (const [id, n] of Object.entries(r.produce)) addProduct(b, id, n * extent, data);
    const label = r.conditionText || CONDITION_LABEL[r.condition] || '';
    const cond = r.catalyst ? data.SUBSTANCES[r.catalyst].formula + (label ? `、${label}` : '') : label;
    const src = r.display || { reactants: r.match, products: r.produce };
    const hasIons = Object.keys(r.match).some(id => data.IONS[id]);
    return {
      beaker: b,
      event: {
        kind: 'special',
        equation: { reactants: toTerms(src.reactants, data), products: toTerms(src.products, data, src.reactants), condition: cond },
        ionic: hasIons ? { reactants: toTerms(r.match, data), products: toTerms(r.produce, data, r.match), condition: cond } : null,
        observations: r.observations || [],
        extent,
        reactionId: r.id,
      },
    };
  }
  return null;
}
