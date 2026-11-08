// 难溶/微溶物表（A 负责）。格式见 CONTRACT.md 3.3。没列出的组合视为可溶。
// 依据：初中/高中课本"部分酸、碱和盐的溶解性表（20℃）"，补充常见硫化物、磷酸盐。
// 会水解或分解的组合（Ag⁺+OH⁻、Al³⁺/Fe³⁺+CO₃²⁻、Al³⁺+S²⁻、Fe³⁺+S²⁻、Cu²⁺+CO₃²⁻ 等）写在 reactions.js。

const row = (cation, anion, product, slight) => (slight ? { cation, anion, product, slight: true } : { cation, anion, product });

export const INSOLUBLE = [
  // 钡
  row('Ba^2+', 'SO4^2-', 'BaSO4'),
  row('Ba^2+', 'CO3^2-', 'BaCO3'),
  row('Ba^2+', 'SO3^2-', 'BaSO3'),
  row('Ba^2+', 'PO4^3-', 'Ba3(PO4)2'),
  // 钙
  row('Ca^2+', 'CO3^2-', 'CaCO3'),
  row('Ca^2+', 'SO3^2-', 'CaSO3'),
  row('Ca^2+', 'SiO3^2-', 'CaSiO3'),
  row('Ca^2+', 'PO4^3-', 'Ca3(PO4)2'),
  row('Ca^2+', 'SO4^2-', 'CaSO4', true),
  row('Ca^2+', 'OH^-', 'Ca(OH)2', true),
  // 镁
  row('Mg^2+', 'OH^-', 'Mg(OH)2'),
  row('Mg^2+', 'CO3^2-', 'MgCO3', true),
  // 铝、锌、铁、铜
  row('Al^3+', 'OH^-', 'Al(OH)3'),
  row('Zn^2+', 'OH^-', 'Zn(OH)2'),
  row('Zn^2+', 'CO3^2-', 'ZnCO3'),
  row('Zn^2+', 'S^2-', 'ZnS'),
  row('Fe^2+', 'OH^-', 'Fe(OH)2'),
  row('Fe^2+', 'CO3^2-', 'FeCO3'),
  row('Fe^2+', 'S^2-', 'FeS'),
  row('Fe^3+', 'OH^-', 'Fe(OH)3'),
  row('Cu^2+', 'OH^-', 'Cu(OH)2'),
  row('Cu^2+', 'S^2-', 'CuS'),
  // 银
  row('Ag^+', 'Cl^-', 'AgCl'),
  row('Ag^+', 'Br^-', 'AgBr'),
  row('Ag^+', 'I^-', 'AgI'),
  row('Ag^+', 'CO3^2-', 'Ag2CO3'),
  row('Ag^+', 'PO4^3-', 'Ag3PO4'),
  row('Ag^+', 'S^2-', 'Ag2S'),
  row('Ag^+', 'SO4^2-', 'Ag2SO4', true),
  // 铅
  row('Pb^2+', 'SO4^2-', 'PbSO4'),
  row('Pb^2+', 'I^-', 'PbI2'),
  row('Pb^2+', 'S^2-', 'PbS'),
  row('Pb^2+', 'CO3^2-', 'PbCO3'),
  row('Pb^2+', 'Cl^-', 'PbCl2', true),
];
