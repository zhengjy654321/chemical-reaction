// 金属活动性顺序置换（金属+酸、金属+盐溶液、活泼金属+水）（B 负责）。
// 签名：(beaker, ctx) => null | { beaker, event }，每次只执行一步。见 CONTRACT.md 第 5 节。
import { runReaction, aqTerm, molTerm, ionTerm, counterIon, describe } from './common.js';

// 金属活动性顺序：K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au。
// 每个金属给出它被氧化后的离子；Fe³⁺ 的氧化性介于 Cu²⁺ 和 Hg²⁺ 之间，可被 Cu、Fe 等还原成 Fe²⁺。
export const ACTIVITY = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Sn', 'Pb', 'H', 'Cu', 'Fe3', 'Hg', 'Ag', 'Pt', 'Au'];
export const METAL_ION = {
  K: 'K^+', Ca: 'Ca^2+', Na: 'Na^+', Mg: 'Mg^2+', Al: 'Al^3+', Zn: 'Zn^2+', Fe: 'Fe^2+', Sn: 'Sn^2+',
  Pb: 'Pb^2+', Cu: 'Cu^2+', Hg: 'Hg^2+', Ag: 'Ag^+', Pt: 'Pt^2+', Au: 'Au^3+',
};
const WATER_METALS = new Set(['K', 'Ca', 'Na']);
const rank = x => ACTIVITY.indexOf(x);

// 溶液中的氧化剂离子：活动性越弱（排得越靠后）越先被置换。
function oxidants(beaker, data) {
  const out = [];
  for (const ion of Object.keys(beaker.ions)) {
    if (ion === 'H^+') {
      // 有 NO3⁻ 时是硝酸，与金属反应不生成 H2（由特殊反应表处理）。
      if (!beaker.ions['NO3^-'] && data.SUBSTANCES.H2) out.push({ ion, key: 'H', reduced: molTerm('H2', data) });
    } else if (ion === 'Fe^3+') {
      if (data.IONS['Fe^2+']) out.push({ ion, key: 'Fe3', reducedIon: 'Fe^2+' });
    } else {
      const M = Object.keys(METAL_ION).find(m => METAL_ION[m] === ion);
      if (M && data.SUBSTANCES[M]) out.push({ ion, key: M, reduced: molTerm(M, data) });
    }
  }
  return out.sort((x, y) => rank(y.key) - rank(x.key));
}

function metalsIn(beaker, data) {
  return Object.keys(beaker.solids)
    .filter(id => METAL_ION[id] && data.IONS[METAL_ION[id]] && data.SUBSTANCES[id]?.category === 'metal')
    .sort((x, y) => rank(x) - rank(y));
}

const WATER_OBS = {
  Na: ['钠浮在水面上，熔成闪亮的小球，四处游动，发出嘶嘶声'],
  K: ['钾浮在水面上，熔成小球，四处游动，燃烧并发出紫色火焰'],
  Ca: ['钙沉入水底，表面产生大量气泡，溶液变浑浊'],
};

function metalWater(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.liquids.H2O || !data.SUBSTANCES.H2 || !data.IONS['OH^-']) return null;
  for (const M of metalsIn(beaker, data)) {
    if (!WATER_METALS.has(M)) continue;
    const r = runReaction(beaker, data,
      [molTerm(M, data), molTerm('H2O', data)],
      [aqTerm(METAL_ION[M], 'OH^-', data), molTerm('H2', data)], { kind: 'displacement' });
    if (r) return describe(beaker, r, data, WATER_OBS[M]);
  }
  return null;
}

export function displacementRule(beaker, ctx) {
  const { data } = ctx;
  const w = metalWater(beaker, ctx);
  if (w) return w;
  const metals = metalsIn(beaker, data).filter(m => !WATER_METALS.has(m));
  for (const ox of oxidants(beaker, data)) {
    for (const M of metals) {
      if (rank(M) >= rank(ox.key)) continue;
      const A = counterIon(beaker, data, -1, [], ox.ion);
      const mIon = METAL_ION[M];
      const reac = [molTerm(M, data), A ? aqTerm(ox.ion, A, data) : ionTerm(ox.ion)];
      const prod = [A ? aqTerm(mIon, A, data) : ionTerm(mIon)];
      if (ox.reduced) prod.push(ox.reduced);
      else prod.push(A ? aqTerm(ox.reducedIon, A, data) : ionTerm(ox.reducedIon));
      const r = runReaction(beaker, data, reac, prod, { kind: 'displacement' });
      if (!r) continue;
      const name = data.SUBSTANCES[M].name;
      const extra = ox.key === 'H' ? [`${name}表面产生气泡`]
        : ox.reduced ? [`${name}表面覆盖一层${data.SUBSTANCES[ox.key].color}物质`]
        : [`${name}逐渐溶解`];
      return describe(beaker, r, data, extra);
    }
  }
  return null;
}
