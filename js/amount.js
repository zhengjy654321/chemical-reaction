// 加入量换算（界面用，C 负责）：滑动条数值 ↔ 物质的量。
// 溶液按体积×浓度，浓酸按体积×市售浓度，纯液体按体积×密度÷摩尔质量，固体按克数÷摩尔质量，气体按标况体积÷22.4。
import { parseFormula } from './equation.js';

const AW = {
  H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
  Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078,
  Ti: 47.867, Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904,
  Sr: 87.62, Ag: 107.87, Sn: 118.71, I: 126.9, Ba: 137.33, Pt: 195.08, Au: 196.97, Hg: 200.59, Pb: 207.2,
};

export function molarMass(formula) {
  try {
    const { atoms } = parseFormula(formula);
    let m = 0;
    for (const [el, n] of Object.entries(atoms)) { if (!AW[el]) return null; m += AW[el] * n; }
    return m || null;
  } catch { return null; }
}

// 市售浓酸的物质的量浓度（mol/L）
const CONC = { HCl_conc: 12, H2SO4_conc: 18.4, HNO3_conc: 16 };
// 纯液体密度（g/mL）
const DENSITY = { H2O: 1, C2H5OH: 0.789, Br2: 3.1 };

export const CONCS = [0.1, 0.5, 1, 2];

// 每种模式的滑动条范围（对数刻度）、单位和常用值
export const MODES = {
  aq: { min: 0.1, max: 50, unit: 'mL', def: 5, presets: [1, 5, 10, 20], label: '溶液体积' },
  l:  { min: 0.1, max: 20, unit: 'mL', def: 2, presets: [0.5, 1, 2, 5], label: '液体体积' },
  s:  { min: 0.01, max: 20, unit: 'g', def: 1, presets: [0.1, 0.5, 1, 5], label: '固体质量' },
  g:  { min: 1, max: 500, unit: 'mL', def: 50, presets: [10, 50, 100, 200], label: '气体体积（标况）' },
};

export const DROP_ML = 0.05;

// r: 试剂，solid: 是否选了"固体"形态
export function modeOf(r, solid) {
  if (solid || r.shelfForm === 's') return 's';
  if (r.shelfForm === 'g') return 'g';
  if (r.shelfForm === 'l') return 'l';
  return 'aq';
}

export function molesOf(r, mode, value, conc) {
  if (mode === 'aq') return value / 1000 * conc;
  if (mode === 'g') return value / 22400;
  if (mode === 'l') {
    if (CONC[r.id]) return value / 1000 * CONC[r.id];
    const M = molarMass(r.formula);
    return M ? value * (DENSITY[r.id] ?? 1) / M : value / 50;
  }
  const M = molarMass(r.formula);
  return M ? value / M : value / 100;
}

// 滑动条位置 0..1000 ↔ 数值（对数）
export const toPos = (m, v) => Math.round(Math.log(v / m.min) / Math.log(m.max / m.min) * 1000);
export function fromPos(m, p) {
  const v = m.min * Math.pow(m.max / m.min, p / 1000);
  return roundNice(v);
}
export function roundNice(v) {
  if (v >= 10) return Math.round(v);
  if (v >= 1) return Math.round(v * 10) / 10;
  if (v >= 0.1) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}
export const fmtAmt = n => n >= 0.1 ? n.toFixed(2) + ' mol' : n >= 1e-4 ? (n * 1000).toFixed(n < 0.001 ? 2 : 1) + ' mmol' : (n * 1e6).toFixed(1) + ' μmol';
