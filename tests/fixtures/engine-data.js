// 引擎测试用数据：在仓库数据（A 维护）的基础上补齐测试需要、但 A 可能还没加的物质。
// 仓库里已有的条目以仓库为准，这里只补缺。
import { DATA } from '../../js/data.js';

const ion = (id, formula, charge, name, color = '无色', css = null) => ({ id, formula, charge, name, color, css });
const EXTRA_IONS = [
  ion('K^+', 'K', 1, '钾离子'), ion('Ca^2+', 'Ca', 2, '钙离子'), ion('Mg^2+', 'Mg', 2, '镁离子'),
  ion('Al^3+', 'Al', 3, '铝离子'), ion('Zn^2+', 'Zn', 2, '锌离子'),
  ion('Fe^2+', 'Fe', 2, '亚铁离子', '浅绿色', '#86efac'), ion('Fe^3+', 'Fe', 3, '铁离子', '黄色', '#facc15'),
  ion('NH4^+', 'NH4', 1, '铵根离子'), ion('CO3^2-', 'CO3', -2, '碳酸根离子'), ion('HCO3^-', 'HCO3', -1, '碳酸氢根离子'),
];
const s = (id, o) => ({ id, formula: id, shelf: true, soluble: false, note: '', css: null, color: '白色', state: 's', ...o });
const EXTRA = [
  s('Zn', { name: '锌', category: 'metal', color: '银白色' }),
  s('Mg', { name: '镁', category: 'metal', color: '银白色' }),
  s('Al', { name: '铝', category: 'metal', color: '银白色' }),
  s('Na', { name: '钠', category: 'metal', color: '银白色' }),
  s('Ag', { name: '银', category: 'metal', color: '银白色' }),
  s('H2', { name: '氢气', category: 'nonmetal', state: 'g', color: '无色' }),
  s('CO2', { name: '二氧化碳', category: 'oxide', state: 'g', color: '无色' }),
  s('NH3', { name: '氨气', category: 'other', state: 'g', color: '无色', soluble: true }),
  s('HNO3', { name: '稀硝酸', category: 'acid', state: 'l', color: '无色', soluble: true, ions: { 'H^+': 1, 'NO3^-': 1 } }),
  s('Na2CO3', { name: '碳酸钠', category: 'salt', soluble: true, ions: { 'Na^+': 2, 'CO3^2-': 1 } }),
  s('NaHCO3', { name: '碳酸氢钠', category: 'salt', soluble: true, ions: { 'Na^+': 1, 'HCO3^-': 1 } }),
  s('CaCl2', { name: '氯化钙', category: 'salt', soluble: true, ions: { 'Ca^2+': 1, 'Cl^-': 2 } }),
  s('Ca(OH)2', { name: '氢氧化钙', category: 'base', soluble: true, ions: { 'Ca^2+': 1, 'OH^-': 2 } }),
  s('Ba(OH)2', { name: '氢氧化钡', category: 'base', soluble: true, ions: { 'Ba^2+': 1, 'OH^-': 2 } }),
  s('Ca(HCO3)2', { name: '碳酸氢钙', category: 'salt', soluble: true, ions: { 'Ca^2+': 1, 'HCO3^-': 2 }, shelf: false }),
  s('NH4Cl', { name: '氯化铵', category: 'salt', soluble: true, ions: { 'NH4^+': 1, 'Cl^-': 1 } }),
  s('FeCl3', { name: '氯化铁', category: 'salt', color: '棕黄色', soluble: true, ions: { 'Fe^3+': 1, 'Cl^-': 3 } }),
  s('FeSO4', { name: '硫酸亚铁', category: 'salt', color: '浅绿色', soluble: true, ions: { 'Fe^2+': 1, 'SO4^2-': 1 } }),
  s('FeCl2', { name: '氯化亚铁', category: 'salt', color: '浅绿色', soluble: true, ions: { 'Fe^2+': 1, 'Cl^-': 2 }, shelf: false }),
  s('ZnSO4', { name: '硫酸锌', category: 'salt', soluble: true, ions: { 'Zn^2+': 1, 'SO4^2-': 1 }, shelf: false }),
  s('CaCO3', { name: '碳酸钙', category: 'salt' }),
  s('BaCO3', { name: '碳酸钡', category: 'salt', shelf: false }),
  s('Ag2SO4', { name: '硫酸银', category: 'salt', shelf: false }),
  s('CaO', { name: '氧化钙', category: 'oxide' }),
  s('Fe2O3', { name: '氧化铁', category: 'oxide', color: '红棕色' }),
  s('Fe(OH)3', { name: '氢氧化铁', category: 'base', color: '红褐色', shelf: false }),
  s('KClO3', { name: '氯酸钾', category: 'salt', soluble: true, ions: { 'K^+': 1, 'ClO3^-': 1 } }),
  s('KCl', { name: '氯化钾', category: 'salt', soluble: true, ions: { 'K^+': 1, 'Cl^-': 1 } }),
  s('O2', { name: '氧气', category: 'nonmetal', state: 'g', color: '无色' }),
];
const EXTRA_INSOLUBLE = [
  { cation: 'Ca^2+', anion: 'CO3^2-', product: 'CaCO3' },
  { cation: 'Ba^2+', anion: 'CO3^2-', product: 'BaCO3' },
  { cation: 'Fe^3+', anion: 'OH^-', product: 'Fe(OH)3' },
  { cation: 'Ca^2+', anion: 'OH^-', product: 'Ca(OH)2', slight: true },
  { cation: 'Ag^+', anion: 'SO4^2-', product: 'Ag2SO4', slight: true },
];
const EXTRA_REACTIONS = [
  { id: 't-co2-limewater', name: 'CO2 使澄清石灰水变浑浊', match: { CO2: 1, 'Ca^2+': 1, 'OH^-': 2 }, produce: { CaCO3: 1, H2O: 1 },
    condition: 'none', display: { reactants: { CO2: 1, 'Ca(OH)2': 1 }, products: { CaCO3: 1, H2O: 1 } }, observations: ['澄清石灰水变浑浊'] },
  { id: 't-caco3-co2', name: 'CaCO3 溶于含 CO2 的水', match: { CaCO3: 1, CO2: 1, H2O: 1 }, produce: { 'Ca^2+': 1, 'HCO3^-': 2 },
    condition: 'none', display: { reactants: { CaCO3: 1, CO2: 1, H2O: 1 }, products: { 'Ca(HCO3)2': 1 } }, observations: ['沉淀溶解'] },
  { id: 't-kclo3', name: '氯酸钾分解', match: { KClO3: 2 }, produce: { KCl: 2, O2: 3 }, condition: 'heat', catalyst: 'MnO2', observations: ['产生气泡'] },

  { id: 't-h2-burn', name: '氢气燃烧', match: { H2: 2, O2: 1 }, produce: { H2O: 2 }, condition: 'ignite', observations: ['产生淡蓝色火焰'] },
];

const SUBSTANCES = { ...DATA.SUBSTANCES };
for (const x of EXTRA) if (!SUBSTANCES[x.id]) SUBSTANCES[x.id] = x;
const IONS = { ...DATA.IONS };
for (const x of EXTRA_IONS) if (!IONS[x.id]) IONS[x.id] = x;
if (!IONS['ClO3^-']) IONS['ClO3^-'] = ion('ClO3^-', 'ClO3', -1, '氯酸根离子');
const INSOLUBLE = [...DATA.INSOLUBLE];
for (const r of EXTRA_INSOLUBLE) if (!INSOLUBLE.some(x => x.cation === r.cation && x.anion === r.anion)) INSOLUBLE.push(r);
// 特殊反应只用这里的几条：规则测试要测的是引擎规则本身，不让 A 的特殊反应表（优先匹配）盖住。
// A 的数据与引擎合在一起的效果由 rules.test.js 末尾的"真实数据"测试检查。
const REACTIONS = EXTRA_REACTIONS;

export const TDATA = { SUBSTANCES, IONS, INSOLUBLE, REACTIONS };
