// 难溶/微溶物表（A 负责）。格式见 CONTRACT.md 3.3。没列出的组合视为可溶。
// 依据：初中/高中课本"部分酸、碱和盐的溶解性表（20℃）"，补充常见硫化物、磷酸盐。
// 会水解或分解的组合（Ag⁺+OH⁻、Al³⁺/Fe³⁺+CO₃²⁻、Al³⁺+S²⁻、Fe³⁺+S²⁻、Cu²⁺+CO₃²⁻ 等）写在 reactions.js。

// ksp：25℃ 溶度积（常见化学手册数据）。引擎用它算离子积 Q 和 Ksp 比较，决定是否沉淀、沉淀多少、谁先沉淀、能否转化。
const row = (cation, anion, product, slight, ksp) => ({ cation, anion, product, ...(slight ? { slight: true } : {}), ...(ksp ? { ksp } : {}) });

export const INSOLUBLE = [
  // 钡
  row('Ba^2+', 'SO4^2-', 'BaSO4', false, 1.1e-10),
  row('Ba^2+', 'CO3^2-', 'BaCO3', false, 2.6e-9),
  row('Ba^2+', 'SO3^2-', 'BaSO3', false, 5.0e-10),
  row('Ba^2+', 'PO4^3-', 'Ba3(PO4)2', false, 3.4e-23),
  // 钙
  row('Ca^2+', 'CO3^2-', 'CaCO3', false, 3.4e-9),
  row('Ca^2+', 'SO3^2-', 'CaSO3', false, 3.1e-7),
  row('Ca^2+', 'SiO3^2-', 'CaSiO3', false, 2.5e-8),
  row('Ca^2+', 'PO4^3-', 'Ca3(PO4)2', false, 2.0e-29),
  row('Ca^2+', 'SO4^2-', 'CaSO4', true, 4.9e-5),
  row('Ca^2+', 'OH^-', 'Ca(OH)2', true, 5.5e-6),
  // 镁
  row('Mg^2+', 'OH^-', 'Mg(OH)2', false, 5.6e-12),
  row('Mg^2+', 'CO3^2-', 'MgCO3', true, 6.8e-6),
  // 铝、锌、铁、铜
  row('Al^3+', 'OH^-', 'Al(OH)3', false, 1.3e-33),
  row('Zn^2+', 'OH^-', 'Zn(OH)2', false, 3.0e-17),
  row('Zn^2+', 'CO3^2-', 'ZnCO3', false, 1.5e-10),
  row('Zn^2+', 'S^2-', 'ZnS', false, 2.5e-22),
  row('Fe^2+', 'OH^-', 'Fe(OH)2', false, 4.9e-17),
  row('Fe^2+', 'CO3^2-', 'FeCO3', false, 3.1e-11),
  row('Fe^2+', 'S^2-', 'FeS', false, 6.3e-18),
  row('Fe^3+', 'OH^-', 'Fe(OH)3', false, 2.8e-39),
  row('Cu^2+', 'OH^-', 'Cu(OH)2', false, 2.2e-20),
  row('Cu^2+', 'S^2-', 'CuS', false, 6.3e-36),
  // 银
  row('Ag^+', 'Cl^-', 'AgCl', false, 1.8e-10),
  row('Ag^+', 'Br^-', 'AgBr', false, 5.4e-13),
  row('Ag^+', 'I^-', 'AgI', false, 8.5e-17),
  row('Ag^+', 'CO3^2-', 'Ag2CO3', false, 8.5e-12),
  row('Ag^+', 'PO4^3-', 'Ag3PO4', false, 8.9e-17),
  row('Ag^+', 'S^2-', 'Ag2S', false, 6.3e-50),
  row('Ag^+', 'SO4^2-', 'Ag2SO4', true, 1.2e-5),
  // 铅
  row('Pb^2+', 'SO4^2-', 'PbSO4', false, 2.5e-8),
  row('Pb^2+', 'I^-', 'PbI2', false, 9.8e-9),
  row('Pb^2+', 'S^2-', 'PbS', false, 8.0e-28),
  row('Pb^2+', 'CO3^2-', 'PbCO3', false, 7.4e-14),
  row('Pb^2+', 'Cl^-', 'PbCl2', true, 1.7e-5),
];
