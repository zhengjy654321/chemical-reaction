// 特殊反应规则（B 负责）：按 data/reactions.js 的 REACTIONS 匹配。
import { clone, addTo } from '../state.js';
import { amountOf, addProduct, formulaOf, markFor, aqTerm, molTerm, counterIon, charge, marks } from './common.js';
import { balance } from '../equation.js';

const CONDITION_LABEL = { none: '', heat: '加热', ignite: '点燃', electrolysis: '通电' };

function conditionMet(r, beaker, ctx) {
  if (r.condition === 'heat' && !(ctx.heated || beaker.heated)) return false;
  if (r.condition === 'ignite' && !ctx.ignite) return false;
  if (r.condition === 'electrolysis' && !ctx.electrolysis) return false;
  if (r.catalyst && amountOf(beaker, r.catalyst).n === 0) return false;
  return true;
}

// 课本规则：反应物中有气体时生成物气体不标 ↑；反应物中有固体时生成物固体不标 ↓。
// beaker 给出时，反应物按它在烧杯里的实际状态算（固体 KMnO4 加热时生成的 MnO2 不标 ↓）。
function toTerms(obj, data, from, beaker) {
  const PH = { solids: '↓', gases: '↑' };
  const fromMarks = from ? Object.keys(from).flatMap(id => [markFor(id, data), PH[beaker && amountOf(beaker, id).phase] || '']) : null;
  return Object.entries(obj).map(([id, n]) => {
    let mark = fromMarks ? markFor(id, data) : '';
    if (mark && fromMarks.includes(mark)) mark = '';
    return { formula: formulaOf(id, data), n, mark };
  });
}

// match/produce 里写了离子、又没给 display 时，用溶液里的配对离子拼出分子方程式。
// 一侧的离子恰好能组成一种中性化合物（如 Ca²⁺ + 2OH⁻）就直接合成它，否则各自配上溶液里的配对离子。
function sideTerms(obj, data, A, C) {
  const ions = Object.entries(obj).filter(([id]) => data.IONS[id]);
  const out = Object.keys(obj).filter(id => !data.IONS[id]).map(id => molTerm(id, data));
  const cs = ions.filter(([id]) => charge(id, data) > 0), as = ions.filter(([id]) => charge(id, data) < 0);
  if (cs.length === 1 && as.length === 1 && cs[0][1] * charge(cs[0][0], data) === -as[0][1] * charge(as[0][0], data)) {
    return [...out, aqTerm(cs[0][0], as[0][0], data)];
  }
  for (const [id] of ions) {
    const pair = charge(id, data) > 0 ? A : C;
    if (!pair) return null;
    out.push(charge(id, data) > 0 ? aqTerm(id, A, data) : aqTerm(C, id, data));
  }
  return out;
}

function synthMolecular(r, beaker, data, condition) {
  const used = [...Object.keys(r.match), ...Object.keys(r.produce)];
  const A = counterIon(beaker, data, -1, used);
  const C = counterIon(beaker, data, 1, used);
  const L = sideTerms(r.match, data, A, C), R0 = sideTerms(r.produce, data, A, C);
  if (!L || !R0) return null;
  const tail = t => (t.id === 'H2O' ? 1 : t.id && !t.ions && data.SUBSTANCES[t.id]?.state === 'g' ? 2 : 0);
  R0.sort((x, y) => tail(x) - tail(y));
  const tries = [R0];
  if (A && C) tries.push([...R0, aqTerm(C, A, data)]);
  for (const R of tries) {
    const all = [...L, ...R];
    if (new Set(all.map(t => t.formula)).size !== all.length) continue;
    const k = balance(L.map(t => t.formula), R.map(t => t.formula));
    if (!k) continue;
    const lt = L.map((t, i) => ({ ...t, n: k[i] })), rt = R.map((t, i) => ({ ...t, n: k[L.length + i] }));
    return { reactants: lt.map(t => ({ formula: t.formula, n: t.n, mark: '' })), products: marks(rt, lt, data), condition };
  }
  return null;
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
    const hasIons = [...Object.keys(r.match), ...Object.keys(r.produce)].some(id => data.IONS[id]);
    const equation = r.display
      ? { reactants: toTerms(r.display.reactants, data), products: toTerms(r.display.products, data, r.display.reactants, beaker), condition: cond }
      : hasIons ? synthMolecular(r, beaker, data, cond)
      : { reactants: toTerms(r.match, data), products: toTerms(r.produce, data, r.match, beaker), condition: cond };
    return {
      beaker: b,
      event: {
        kind: 'special',
        equation,
        ionic: hasIons ? { reactants: toTerms(r.match, data), products: toTerms(r.produce, data, r.match, beaker), condition: cond } : null,
        observations: r.observations || [],
        extent,
        reactionId: r.id,
      },
    };
  }
  return null;
}
