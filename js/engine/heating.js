// 通用加热规则（受热分解的兜底）（B 负责）。特殊反应表里写了的（如 Cu(OH)2）先由特殊规则处理。
// 签名：(beaker, ctx) => null | { beaker, event }，每次只执行一步。见 CONTRACT.md 第 5 节。
import { runReaction, molTerm, productTerms, counterIon, isHeated, describe, charge } from './common.js';

// 难溶氢氧化物受热分解成氧化物和水：2Fe(OH)3 =加热= Fe2O3 + 3H2O。
function hydroxides(beaker, ctx) {
  const { data } = ctx;
  for (const id of Object.keys(beaker.solids)) {
    const row = data.INSOLUBLE.find(r => r.product === id && r.anion === 'OH^-' && !r.slight);
    if (!row) continue;
    const M = data.IONS[row.cation].formula;
    const q = charge(row.cation, data);
    const oxide = q % 2 === 0 ? `${M}${q / 2 === 1 ? '' : q / 2}O` : `${M}2O${q === 1 ? '' : q}`;
    const ox = Object.values(data.SUBSTANCES).find(s => s.formula === oxide);
    if (!ox) continue;
    const r = runReaction(beaker, data, [molTerm(id, data)], [molTerm(ox.id, data), molTerm('H2O', data)],
      { kind: 'heating', condition: '加热' });
    if (r) return describe(beaker, r, data, [`${data.SUBSTANCES[id].color}固体逐渐变为${ox.color}`]);
  }
  return null;
}

// 碳酸氢盐溶液受热：Ca(HCO3)2 =加热= CaCO3↓ + H2O + CO2↑。
function bicarbonate(beaker, ctx) {
  const { data } = ctx;
  if (!beaker.ions['HCO3^-'] || !data.IONS['CO3^2-'] || !data.SUBSTANCES.CO2) return null;
  const C = counterIon(beaker, data, 1, ['H^+']);
  if (!C) return null;
  const r = runReaction(beaker, data,
    [productTerms(C, 'HCO3^-', data, true)[0]],
    [...productTerms(C, 'CO3^2-', data, true), molTerm('H2O', data), molTerm('CO2', data)],
    { kind: 'heating', condition: '加热' });
  return describe(beaker, r, data);
}

export function heatingRule(beaker, ctx) {
  if (!isHeated(beaker, ctx)) return null;
  return hydroxides(beaker, ctx) || bicarbonate(beaker, ctx);
}
