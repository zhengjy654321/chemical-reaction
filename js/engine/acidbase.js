// 酸碱中和、生成气体（H⁺+CO₃²⁻、NH₄⁺+OH⁻ 加热等）、酸溶解碱性氧化物/难溶碱/碳酸盐（B 负责）。
// 签名：(beaker, ctx) => null | { beaker, event }，每次只执行一步。见 CONTRACT.md 第 5 节。
import { parseFormula } from '../equation.js';
import {
  ionPairReaction, runReaction, aqTerm, molTerm, ionTerm, productTerms, sinkOf, counterIon,
  anions, isHeated, describe, WEAK_ANIONS, charge,
} from './common.js';

// 不溶于稀酸的硫化物。
const ACID_PROOF = new Set(['CuS', 'Ag2S', 'PbS', 'HgS']);
// 能与水反应生成可溶碱的氧化物。
const WATER_OXIDES = new Set(['Na', 'K', 'Ca', 'Ba']);

// 固体由哪种阳离子和阴离子组成：难溶盐/碱查 INSOLUBLE，可溶盐查 ions，金属氧化物按化学式推价态。
export function solidIons(id, data) {
  const row = data.INSOLUBLE.find(r => r.product === id);
  if (row) return { c: row.cation, a: row.anion };
  const s = data.SUBSTANCES[id];
  if (!s) return null;
  if (s.ions) {
    const ks = Object.keys(s.ions);
    if (ks.length === 2) {
      const c = ks.find(k => charge(k, data) > 0), a = ks.find(k => charge(k, data) < 0);
      if (c && a) return { c, a };
    }
    return null;
  }
  const { atoms } = parseFormula(s.formula);
  const els = Object.keys(atoms);
  if (els.length === 2 && atoms.O && s.category === 'oxide') {
    const M = els.find(e => e !== 'O');
    const q = (2 * atoms.O) / atoms[M];
    const ion = Object.values(data.IONS).find(i => i.formula === M && i.charge === q);
    if (ion) return { c: ion.id, a: null, oxide: M };
  }
  return null;
}

const acidAnion = (beaker, data) => counterIon(beaker, data, -1, WEAK_ANIONS);

function neutralize(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.ions['H^+'] || !beaker.ions['OH^-']) return null;
  return describe(beaker, ionPairReaction(beaker, data, 'H^+', 'OH^-', { kind: 'neutralization', heated: isHeated(beaker, ctx) }), data);
}

function weakAcid(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.ions['H^+']) return null;
  for (const a of anions(beaker, data)) {
    if (a === 'OH^-' || !WEAK_ANIONS.includes(a)) continue;
    const sink = sinkOf('H^+', a, data, false);
    if (!sink) continue;
    const kind = sink.some(id => data.SUBSTANCES[id].state === 'g') ? 'gas' : 'neutralization';
    const r = ionPairReaction(beaker, data, 'H^+', a, { kind, heated: isHeated(beaker, ctx) });
    if (r) return describe(beaker, r, data);
  }
  return null;
}

// 酸溶解固体：金属氧化物、难溶碱、碳酸盐等（BaSO4、AgCl 等不溶于酸的不反应）。
function dissolveSolid(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.ions['H^+']) return null;
  const heated = isHeated(beaker, ctx);
  const A = acidAnion(beaker, data);
  const acid = A ? aqTerm('H^+', A, data) : ionTerm('H^+');
  for (const id of Object.keys(beaker.solids)) {
    if (ACID_PROOF.has(id)) continue;
    const si = solidIons(id, data);
    if (!si) continue;
    let tail;
    if (si.oxide) tail = [molTerm('H2O', data)];
    else if (WEAK_ANIONS.includes(si.a)) tail = (sinkOf('H^+', si.a, data, heated) || []).map(x => molTerm(x, data));
    else continue;
    if (!tail.length) continue;
    const salt = A ? productTerms(si.c, A, data, heated) : [ionTerm(si.c)];
    const gas = tail.some(t => data.SUBSTANCES[t.id]?.state === 'g');
    const r = runReaction(beaker, data, [molTerm(id, data), acid], [...salt, ...tail], { kind: gas ? 'gas' : 'neutralization' });
    if (r) return describe(beaker, r, data, [`${data.SUBSTANCES[id].name}逐渐溶解`]);
  }
  return null;
}

// 氨气/氨水分子与酸：NH3 + HCl = NH4Cl。
function ammonia(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.ions['H^+'] || !data.IONS['NH4^+']) return null;
  for (const id of ['NH3', 'NH3·H2O']) {
    if (!data.SUBSTANCES[id] || data.SUBSTANCES[id].ions) continue;
    if (!(beaker.dissolved[id] || beaker.gases[id])) continue;
    const A = acidAnion(beaker, data);
    const reac = [molTerm(id, data), A ? aqTerm('H^+', A, data) : ionTerm('H^+')];
    const prod = [A ? aqTerm('NH4^+', A, data) : ionTerm('NH4^+')];
    if (id === 'NH3·H2O') prod.push(molTerm('H2O', data));
    const r = runReaction(beaker, data, reac, prod, { kind: 'neutralization' });
    if (r) return describe(beaker, r, data, beaker.gases[id] ? ['产生大量白烟'] : []);
  }
  return null;
}

// 铵盐与碱共热放出氨气。
function ammonium(beaker, ctx) {
  const { data } = ctx;
  if (!isHeated(beaker, ctx) || !beaker.ions['NH4^+'] || !beaker.ions['OH^-']) return null;
  const r = ionPairReaction(beaker, data, 'NH4^+', 'OH^-', { kind: 'gas', heated: true, condition: '加热' });
  return describe(beaker, r, data, ['产生有刺激性气味的气体，能使湿润的红色石蕊试纸变蓝']);
}

// 活泼金属氧化物与水：CaO + H2O = Ca(OH)2。
function oxideWater(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.liquids.H2O || !data.IONS['OH^-']) return null;
  for (const id of Object.keys(beaker.solids)) {
    const si = solidIons(id, data);
    if (!si?.oxide || !WATER_OXIDES.has(si.oxide)) continue;
    const r = runReaction(beaker, data, [molTerm(id, data), molTerm('H2O', data)], [aqTerm(si.c, 'OH^-', data)], { kind: 'neutralization' });
    if (r) return describe(beaker, r, data, ['放出大量的热']);
  }
  return null;
}

export function acidBaseRule(beaker, ctx) {
  return neutralize(beaker, ctx) || weakAcid(beaker, ctx) || dissolveSolid(beaker, ctx)
    || ammonia(beaker, ctx) || ammonium(beaker, ctx) || oxideWater(beaker, ctx);
}
