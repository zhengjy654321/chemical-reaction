// 特殊反应表（A 负责）。格式见 CONTRACT.md 3.4。

export const REACTIONS = [
  {
    id: 'h2o2-mno2',
    name: '过氧化氢在二氧化锰催化下分解',
    match: { H2O2: 2 },
    produce: { H2O: 2, O2: 1 },
    condition: 'none',
    catalyst: 'MnO2',
    display: null,
    observations: ['产生大量气泡'],
  },
  {
    id: 'cuoh2-heat',
    name: '氢氧化铜受热分解',
    match: { 'Cu(OH)2': 1 },
    produce: { CuO: 1, H2O: 1 },
    condition: 'heat',
    display: null,
    observations: ['蓝色固体逐渐变为黑色'],
  },
];
