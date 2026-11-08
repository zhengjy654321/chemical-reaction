// 物质与离子数据（A 负责）。格式见 CONTRACT.md 第 3 节。
// 骨架只放少量样例，A 线程扩充到约 100 种。

export const IONS = {
  'H^+':    { id: 'H^+',    formula: 'H',   charge: 1,  name: '氢离子',   color: '无色', css: null },
  'Na^+':   { id: 'Na^+',   formula: 'Na',  charge: 1,  name: '钠离子',   color: '无色', css: null },
  'Ag^+':   { id: 'Ag^+',   formula: 'Ag',  charge: 1,  name: '银离子',   color: '无色', css: null },
  'Ba^2+':  { id: 'Ba^2+',  formula: 'Ba',  charge: 2,  name: '钡离子',   color: '无色', css: null },
  'Cu^2+':  { id: 'Cu^2+',  formula: 'Cu',  charge: 2,  name: '铜离子',   color: '蓝色', css: '#3b82f6' },
  'OH^-':   { id: 'OH^-',   formula: 'OH',  charge: -1, name: '氢氧根离子', color: '无色', css: null },
  'Cl^-':   { id: 'Cl^-',   formula: 'Cl',  charge: -1, name: '氯离子',   color: '无色', css: null },
  'NO3^-':  { id: 'NO3^-',  formula: 'NO3', charge: -1, name: '硝酸根离子', color: '无色', css: null },
  'SO4^2-': { id: 'SO4^2-', formula: 'SO4', charge: -2, name: '硫酸根离子', color: '无色', css: null },
};

const s = (id, o) => ({ id, formula: id, shelf: true, soluble: false, note: '', ...o });

export const SUBSTANCES = {
  H2O:    s('H2O',    { name: '水', category: 'oxide', state: 'l', color: '无色', css: null, soluble: true, shelfForm: 'l' }),
  HCl:    s('HCl',    { name: '盐酸', category: 'acid', state: 'g', color: '无色', css: null, soluble: true, ions: { 'H^+': 1, 'Cl^-': 1 }, shelfForm: 'aq' }),
  H2SO4:  s('H2SO4',  { name: '稀硫酸', category: 'acid', state: 'l', color: '无色', css: null, soluble: true, ions: { 'H^+': 2, 'SO4^2-': 1 }, shelfForm: 'aq' }),
  NaOH:   s('NaOH',   { name: '氢氧化钠', category: 'base', state: 's', color: '白色', css: '#ffffff', soluble: true, ions: { 'Na^+': 1, 'OH^-': 1 }, shelfForm: 'aq' }),
  NaCl:   s('NaCl',   { name: '氯化钠', category: 'salt', state: 's', color: '白色', css: '#ffffff', soluble: true, ions: { 'Na^+': 1, 'Cl^-': 1 }, shelfForm: 'aq' }),
  BaCl2:  s('BaCl2',  { name: '氯化钡', category: 'salt', state: 's', color: '白色', css: '#ffffff', soluble: true, ions: { 'Ba^2+': 1, 'Cl^-': 2 }, shelfForm: 'aq' }),
  AgNO3:  s('AgNO3',  { name: '硝酸银', category: 'salt', state: 's', color: '白色', css: '#ffffff', soluble: true, ions: { 'Ag^+': 1, 'NO3^-': 1 }, shelfForm: 'aq' }),
  CuSO4:  s('CuSO4',  { name: '硫酸铜', category: 'salt', state: 's', color: '白色', css: '#f5f5f5', soluble: true, ions: { 'Cu^2+': 1, 'SO4^2-': 1 }, shelfForm: 'aq' }),
  BaSO4:  s('BaSO4',  { name: '硫酸钡', category: 'salt', state: 's', color: '白色', css: '#ffffff', shelf: false }),
  AgCl:   s('AgCl',   { name: '氯化银', category: 'salt', state: 's', color: '白色', css: '#ffffff', shelf: false }),
  'Cu(OH)2': s('Cu(OH)2', { name: '氢氧化铜', category: 'base', state: 's', color: '蓝色', css: '#2563eb', shelf: false }),
  CuO:    s('CuO',    { name: '氧化铜', category: 'oxide', state: 's', color: '黑色', css: '#111111', shelfForm: 's' }),
  H2O2:   s('H2O2',   { name: '过氧化氢溶液', category: 'other', state: 'l', color: '无色', css: null, soluble: true, shelfForm: 'aq' }),
  MnO2:   s('MnO2',   { name: '二氧化锰', category: 'oxide', state: 's', color: '黑色', css: '#1f1f1f', shelfForm: 's' }),
  O2:     s('O2',     { name: '氧气', category: 'nonmetal', state: 'g', color: '无色', css: null, shelf: false }),
  Fe:     s('Fe',     { name: '铁', category: 'metal', state: 's', color: '银白色', css: '#9ca3af', shelfForm: 's' }),
  Cu:     s('Cu',     { name: '铜', category: 'metal', state: 's', color: '红色', css: '#b45309', shelfForm: 's' }),
};
