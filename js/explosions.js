// 爆炸与剧烈反应快捷实验（界面用）。每一项：先把反应物装进一个新容器（不引发），
// 用户再点触发条件（点燃 / 光照 / 投入金属）引发反应。纯数据 + 纯函数，可在 Node 里测试。
import { createBeaker, addSubstance, addTo } from './state.js';

// level：1 剧烈，2 爆鸣，3 爆炸（与 data/reactions.js 的 intensity 一致）
// load：[物质 id, mol, 'g' 气体 | 's' 固体 | 'l' 液体]；water：容器里的水（mL），0 为干燥容器
// trigger：{ type: 'ignite' | 'light' } 或 { type: 'add', id, mol }（投入固体）
export const EXPLOSIONS = [
  { id: 'h2-o2', title: '氢气和氧气混合点燃', reaction: 'h2-o2', level: 3, water: 0,
    load: [['H2', 0.004, 'g'], ['O2', 0.002, 'g']], trigger: { type: 'ignite' },
    tip: '氢气点燃前必须验纯，就是怕混进氧气后爆炸。' },
  { id: 'ch4-o2', title: '甲烷和氧气混合点燃（瓦斯爆炸）', reaction: 'ch4-o2', level: 3, water: 0,
    load: [['CH4', 0.002, 'g'], ['O2', 0.004, 'g']], trigger: { type: 'ignite' },
    tip: '煤矿里的瓦斯爆炸就是甲烷和空气混合后遇到明火。' },
  { id: 'co-o2', title: '一氧化碳和氧气混合点燃', reaction: 'co-o2', level: 3, water: 0,
    load: [['CO', 0.004, 'g'], ['O2', 0.002, 'g']], trigger: { type: 'ignite' },
    tip: '用 CO 还原氧化铁前要先通 CO 赶走空气，再加热。' },
  { id: 'h2-cl2-light', title: '氢气和氯气混合，强光照射', reaction: 'h2-cl2-light', level: 3, water: 0,
    load: [['H2', 0.003, 'g'], ['Cl2', 0.003, 'g']], trigger: { type: 'light' },
    tip: '纯净的氢气能在氯气中安静燃烧；两者先混合再光照或点燃就会爆炸。' },
  { id: 'h2-cl2', title: '氢气和氯气混合点燃', reaction: 'h2-cl2', level: 3, water: 0,
    load: [['H2', 0.003, 'g'], ['Cl2', 0.003, 'g']], trigger: { type: 'ignite' } },
  { id: 'black-powder', title: '黑火药', reaction: 'black-powder', level: 3, water: 0,
    load: [['KNO3', 0.02, 's'], ['S', 0.01, 's'], ['C', 0.03, 's']], trigger: { type: 'ignite' },
    tip: '我国古代四大发明之一：“一硫二硝三木炭”。' },
  { id: 'kclo3-s', title: '氯酸钾和硫粉混合', reaction: 'kclo3-s', level: 3, water: 0,
    load: [['KClO3', 0.01, 's'], ['S', 0.015, 's']], trigger: { type: 'ignite' },
    tip: '氯酸钾不能和可燃物混在一起研磨或存放。' },
  { id: 'kclo3-c', title: '氯酸钾和木炭混合', reaction: 'kclo3-c', level: 3, water: 0,
    load: [['KClO3', 0.01, 's'], ['C', 0.015, 's']], trigger: { type: 'ignite' } },
  { id: 'kclo3-p', title: '氯酸钾和红磷混合', reaction: 'kclo3-p', level: 3, water: 0,
    load: [['KClO3', 0.01, 's'], ['P', 0.012, 's']], trigger: { type: 'ignite' } },
  { id: 'nh4no3', title: '硝酸铵受撞击或高温', reaction: 'nh4no3-boom', level: 3, water: 0,
    load: [['NH4NO3', 0.02, 's']], trigger: { type: 'ignite', label: '引爆' },
    tip: '硝酸铵化肥结块时不能用铁锤砸碎。' },
  { id: 'k-h2o', title: '钾投入水中', reaction: 'k-h2o', level: 2, water: 50,
    load: [], trigger: { type: 'add', id: 'K', mol: 0.004, label: '投入钾' },
    tip: '钾比钠活泼，和水反应会燃烧，还会有轻微爆鸣。' },
  { id: 'thermite', title: '铝热反应', reaction: 'al-fe2o3', level: 2, water: 0,
    load: [['Al', 0.02, 's'], ['Fe2O3', 0.01, 's']], trigger: { type: 'ignite' },
    tip: '用来焊接钢轨，生成的铁是熔化状态。' },
  // 对照：纯净气体在导管口点燃，安静燃烧不爆炸（level 0）
  { id: 'co-quiet', title: '纯净的一氧化碳在导管口点燃', reaction: 'co-o2', level: 0, water: 0,
    load: [['CO', 0.004, 'g']], trigger: { type: 'nozzle' },
    tip: '只有一氧化碳、没混氧气，点燃后用的是空气里的氧气，安静燃烧。' },
  { id: 'h2-quiet', title: '纯净的氢气在导管口点燃', reaction: 'h2-o2', level: 0, water: 0,
    load: [['H2', 0.004, 'g']], trigger: { type: 'nozzle' },
    tip: '这就是“验纯”之后点燃氢气的样子。' },
  { id: 'ch4-quiet', title: '纯净的甲烷在导管口点燃', reaction: 'ch4-o2', level: 0, water: 0,
    load: [['CH4', 0.002, 'g']], trigger: { type: 'nozzle' } },
  { id: 'na-h2o', title: '钠投入水中', reaction: 'na-h2o', level: 1, water: 50,
    load: [], trigger: { type: 'add', id: 'Na', mol: 0.004, label: '投入钠' } },
  { id: 'fe-o2', title: '铁丝在氧气中燃烧', reaction: 'fe-o2', level: 1, water: 0,
    load: [['Fe', 0.003, 's'], ['O2', 0.004, 'g']], trigger: { type: 'ignite' } },
  { id: 'mg-o2', title: '镁条在氧气中燃烧', reaction: 'mg-o2', level: 1, water: 0,
    load: [['Mg', 0.004, 's'], ['O2', 0.003, 'g']], trigger: { type: 'ignite' } },
];

export const LEVEL_LABEL = { 0: '安静', 1: '剧烈', 2: '爆鸣', 3: '爆炸' };
export const TRIGGER_LABEL = { ignite: '点燃', light: '光照', nozzle: '导管口点燃' };
export const triggerLabel = t => t.label || TRIGGER_LABEL[t.type] || '引发';

// 装好反应物但不引发。气体直接放进容器（不溶到水里），固体保持固态。
export function loadExplosion(preset, id, label, data) {
  let b = createBeaker(id, label, preset.water);
  for (const [sid, mol, form] of preset.load) {
    if (form === 'g') { b = { ...b, gases: { ...b.gases } }; addTo(b.gases, sid, mol); }
    else b = addSubstance(b, sid, mol, data, form === 's' ? { form: 's' } : {});
  }
  return b;
}

// 触发：返回 { beaker, ctx }，交给 react() 运行。
export function triggerExplosion(preset, beaker, data) {
  const t = preset.trigger;
  if (t.type === 'add') return { beaker: addSubstance(beaker, t.id, t.mol, data, { form: 's' }), ctx: {} };
  if (t.type === 'nozzle') return nozzleIgnite(beaker);
  return { beaker, ctx: { [t.type]: true } };
}

// 导管口点燃：容器里的可燃气体从导管口导出，在空气中点燃。
// 纯净（没混氧气）时补上刚好够用的空气中的氧气，安静燃烧（ctx.quiet）；混有氧气时就是普通点燃，会爆炸。
// 刚生成、正在逸出的气体也算导出来了（例如锌和稀硫酸反应生成的氢气）。
export const FUELS = { H2: 0.5, CO: 0.5, CH4: 2 }; // 每 mol 燃料需要的 O2
export function nozzleIgnite(beaker) {
  const g = beaker.gases || {};
  const fuels = Object.keys(FUELS).filter(id => (g[id] || 0) > 1e-9);
  const mixed = (g.O2 || 0) > 1e-9;
  const b = { ...beaker, gases: { ...g } };
  if (b.escaping) { b.escaping = { ...b.escaping }; for (const id of [...fuels, 'O2']) delete b.escaping[id]; }
  if (!fuels.length || mixed) return { beaker: b, ctx: { ignite: true }, fuels, mixed };
  let need = 0;
  for (const id of fuels) need += g[id] * FUELS[id];
  addTo(b.gases, 'O2', need);
  return { beaker: b, ctx: { ignite: true, quiet: true }, fuels, mixed };
}

// 一组事件里最猛烈的等级（0 表示没有特别的效果）。
export function maxIntensity(events) {
  return (events || []).reduce((m, e) => Math.max(m, e.intensity || 0), 0);
}
