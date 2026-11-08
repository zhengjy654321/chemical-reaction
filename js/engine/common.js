// 引擎内部共用工具（B 负责）。
import { EPS, addTo } from '../state.js';

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
