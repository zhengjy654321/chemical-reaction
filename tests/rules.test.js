// 引擎规则测试（B 负责）：课本方程式、原子/电荷守恒、不该发生的反应、约定里的气体/固体/条件写法。
// 用 tests/fixtures/engine-data.js（仓库数据 + 测试补齐的物质），不依赖 A 的进度。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TDATA as D } from './fixtures/engine-data.js';
import { DATA } from '../js/data.js';
import { createBeaker, addSubstance } from '../js/state.js';
import { react } from '../js/engine/index.js';
import { formatEquation, checkConservation } from '../js/equation.js';

const close = (a, b) => Math.abs((a || 0) - b) < 1e-9;
function run(items, ctx = {}, beaker = createBeaker('b', 'b')) {
  let b = beaker;
  for (const [id, n, opt] of items) b = addSubstance(b, id, n, D, opt);
  return react(b, { data: D, ...ctx });
}
const eq = e => e.equation && formatEquation(e.equation);
const ionic = e => e.ionic && formatEquation(e.ionic);

// [加入的物质, 期望分子方程式, 期望离子方程式, 加热]
const TEXTBOOK = [
  [[['BaCl2', 0.01], ['H2SO4', 0.01]], 'BaCl₂ + H₂SO₄ = BaSO₄↓ + 2HCl', 'Ba²⁺ + SO₄²⁻ = BaSO₄↓'],
  [[['AgNO3', 0.01], ['NaCl', 0.01]], 'AgNO₃ + NaCl = AgCl↓ + NaNO₃', 'Ag⁺ + Cl⁻ = AgCl↓'],
  [[['AgNO3', 0.01], ['HCl', 0.01]], 'AgNO₃ + HCl = AgCl↓ + HNO₃', 'Ag⁺ + Cl⁻ = AgCl↓'],
  [[['CuSO4', 0.01], ['NaOH', 0.02]], 'CuSO₄ + 2NaOH = Cu(OH)₂↓ + Na₂SO₄', 'Cu²⁺ + 2OH⁻ = Cu(OH)₂↓'],
  [[['FeCl3', 0.01], ['NaOH', 0.03]], 'FeCl₃ + 3NaOH = Fe(OH)₃↓ + 3NaCl', 'Fe³⁺ + 3OH⁻ = Fe(OH)₃↓'],
  [[['CaCl2', 0.01], ['Na2CO3', 0.01]], 'CaCl₂ + Na₂CO₃ = CaCO₃↓ + 2NaCl', 'Ca²⁺ + CO₃²⁻ = CaCO₃↓'],
  [[['NaOH', 0.01], ['HCl', 0.01]], 'NaOH + HCl = NaCl + H₂O', 'H⁺ + OH⁻ = H₂O'],
  [[['NaOH', 0.02], ['H2SO4', 0.01]], '2NaOH + H₂SO₄ = Na₂SO₄ + 2H₂O', 'H⁺ + OH⁻ = H₂O'],
  [[['Ba(OH)2', 0.01], ['H2SO4', 0.01]], 'Ba(OH)₂ + H₂SO₄ = BaSO₄↓ + 2H₂O', 'Ba²⁺ + 2OH⁻ + 2H⁺ + SO₄²⁻ = BaSO₄↓ + 2H₂O'],
  [[['Na2CO3', 0.01], ['HCl', 0.02]], 'Na₂CO₃ + 2HCl = 2NaCl + H₂O + CO₂↑', '2H⁺ + CO₃²⁻ = H₂O + CO₂↑'],
  [[['NaHCO3', 0.01], ['HCl', 0.01]], 'NaHCO₃ + HCl = NaCl + H₂O + CO₂↑', 'H⁺ + HCO₃⁻ = H₂O + CO₂↑'],
  [[['CaCO3', 0.01], ['HCl', 0.02]], 'CaCO₃ + 2HCl = CaCl₂ + H₂O + CO₂↑', 'CaCO₃ + 2H⁺ = Ca²⁺ + H₂O + CO₂↑'],
  [[['CuO', 0.01], ['H2SO4', 0.01]], 'CuO + H₂SO₄ = CuSO₄ + H₂O', 'CuO + 2H⁺ = Cu²⁺ + H₂O'],
  [[['Fe2O3', 0.01], ['HCl', 0.06]], 'Fe₂O₃ + 6HCl = 2FeCl₃ + 3H₂O', 'Fe₂O₃ + 6H⁺ = 2Fe³⁺ + 3H₂O'],
  [[['Zn', 0.01], ['H2SO4', 0.01]], 'Zn + H₂SO₄ = ZnSO₄ + H₂↑', 'Zn + 2H⁺ = Zn²⁺ + H₂↑'],
  [[['Fe', 0.01], ['HCl', 0.02]], 'Fe + 2HCl = FeCl₂ + H₂↑', 'Fe + 2H⁺ = Fe²⁺ + H₂↑'],
  [[['Al', 0.01], ['HCl', 0.03]], '2Al + 6HCl = 2AlCl₃ + 3H₂↑', '2Al + 6H⁺ = 2Al³⁺ + 3H₂↑'],
  [[['Fe', 0.01], ['CuSO4', 0.01]], 'Fe + CuSO₄ = FeSO₄ + Cu', 'Fe + Cu²⁺ = Fe²⁺ + Cu'],
  [[['Cu', 0.01], ['AgNO3', 0.02]], 'Cu + 2AgNO₃ = Cu(NO₃)₂ + 2Ag', 'Cu + 2Ag⁺ = Cu²⁺ + 2Ag'],
  [[['Fe', 0.01], ['FeCl3', 0.02]], 'Fe + 2FeCl₃ = 3FeCl₂', 'Fe + 2Fe³⁺ = 3Fe²⁺'],
  [[['Cu', 0.01], ['FeCl3', 0.02]], 'Cu + 2FeCl₃ = CuCl₂ + 2FeCl₂', 'Cu + 2Fe³⁺ = Cu²⁺ + 2Fe²⁺'],
  [[['Na', 0.01]], '2Na + 2H₂O = 2NaOH + H₂↑', '2Na + 2H₂O = 2Na⁺ + 2OH⁻ + H₂↑'],
  [[['CaO', 0.001]], 'CaO + H₂O = Ca(OH)₂', 'CaO + H₂O = Ca²⁺ + 2OH⁻'],
  [[['NH4Cl', 0.01], ['NaOH', 0.01]], 'NH₄Cl + NaOH =加热= NaCl + H₂O + NH₃↑', 'NH₄⁺ + OH⁻ =加热= H₂O + NH₃↑', true],
  [[['Ca(HCO3)2', 0.01]], 'Ca(HCO₃)₂ =加热= CaCO₃↓ + H₂O + CO₂↑', 'Ca²⁺ + 2HCO₃⁻ =加热= CaCO₃↓ + H₂O + CO₂↑', true],
  [[['Fe(OH)3', 0.01]], '2Fe(OH)₃ =加热= Fe₂O₃ + 3H₂O', null, true],
];

for (const [items, mol, ion, heated] of TEXTBOOK) {
  test(`课本方程式：${mol}`, () => {
    const { events } = run(items, { heated: !!heated });
    assert.ok(events.length >= 1, '应该发生反应');
    const e = events[0];
    assert.equal(eq(e), mol);
    assert.equal(ionic(e), ion);
    for (const x of [e.equation, e.ionic]) if (x) assert.ok(checkConservation(x).ok, formatEquation(x));
    assert.ok(e.observations.length > 0);
  });
}

test('不该发生的反应', () => {
  const none = [
    [['Cu', 0.01], ['HCl', 0.02]],          // 铜排在氢后面
    [['Ag', 0.01], ['H2SO4', 0.01]],
    [['Ag', 0.01], ['CuSO4', 0.01]],        // 银不如铜活泼
    [['Cu', 0.01], ['FeSO4', 0.01]],
    [['Zn', 0.01], ['HNO3', 0.02]],         // 硝酸与金属不放氢气（交给特殊反应表）
    [['NaCl', 0.01], ['H2SO4', 0.01]],      // 无沉淀、气体、水
    [['NaCl', 0.01], ['KCl', 0.01]],
    [['BaSO4', 0.01, { form: 's' }], ['HCl', 0.02]], // BaSO4 不溶于酸
    [['NH4Cl', 0.01], ['NaOH', 0.01]],      // 不加热不放氨气
    [['Fe(OH)3', 0.01]],                    // 不加热不分解
  ];
  for (const items of none) {
    const { events } = run(items);
    assert.equal(events.length, 0, items.map(x => x[0]).join(' + ') + ' 不应反应');
  }
});

test('所有事件都原子守恒、电荷守恒，烧杯里的元素总量不变', () => {
  const mixes = [
    [['CuSO4', 0.01], ['NaOH', 0.03], ['H2SO4', 0.005]],
    [['Na', 0.02], ['CuSO4', 0.01]],
    [['Zn', 0.01], ['Fe', 0.01], ['CuSO4', 0.015], ['AgNO3', 0.01]],
    [['Na2CO3', 0.01], ['HCl', 0.01], ['BaCl2', 0.01]],
    [['Ba(OH)2', 0.01], ['CuSO4', 0.01]],
  ];
  const total = b => {
    const atoms = {};
    for (const p of ['ions', 'dissolved', 'liquids', 'solids', 'gases']) {
      for (const [id, n] of Object.entries(b[p])) {
        const f = D.IONS[id] ? id : D.SUBSTANCES[id].formula;
        const { atoms: a } = checkConservation({ reactants: [], products: [{ formula: f, n: 1 }] });
        for (const [el, k] of Object.entries(a)) atoms[el] = (atoms[el] || 0) + k * n;
      }
    }
    return atoms;
  };
  for (const items of mixes) {
    let b = createBeaker('b', 'b');
    for (const [id, n] of items) b = addSubstance(b, id, n, D);
    const r = react(b, { data: D });
    assert.ok(r.events.length > 0);
    for (const e of r.events) for (const x of [e.equation, e.ionic]) if (x) assert.ok(checkConservation(x).ok, formatEquation(x));
    const t0 = total(b), t1 = total(r.beaker);
    for (const el of new Set([...Object.keys(t0), ...Object.keys(t1)])) assert.ok(close(t0[el], t1[el] || 0), `${el} 不守恒`);
  }
});

test('金属活动性：混合时最不活泼的离子先被最活泼的金属置换', () => {
  const r = run([['Zn', 0.002], ['Fe', 0.001], ['CuSO4', 0.001], ['AgNO3', 0.002]]);
  assert.equal(eq(r.events[0]), 'Zn + 2AgNO₃ = Zn(NO₃)₂ + 2Ag');
  assert.ok(close(r.beaker.solids.Ag, 0.002));
  assert.ok(close(r.beaker.solids.Cu, 0.001));
  assert.ok(close(r.beaker.solids.Fe, 0.001), '铁没有参加反应');
});

test('有酸时 NaOH 先中和，再与 Cu²⁺ 沉淀', () => {
  const r = run([['CuSO4', 0.01], ['H2SO4', 0.005], ['NaOH', 0.03]]);
  assert.deepEqual(r.events.map(e => e.kind), ['neutralization', 'precipitation']);
  assert.ok(close(r.beaker.solids['Cu(OH)2'], 0.01));
});

test('微溶物：少量 Ca(OH)2 全部溶解，过量时析出', () => {
  assert.equal(run([['Ca(OH)2', 0.0005]]).events.length, 0);
  const r = run([['Ca(OH)2', 0.01]]);
  assert.equal(r.events[0].kind, 'precipitation');
  assert.ok(r.beaker.solids['Ca(OH)2'] > 0.008);
});

test('约定：通入的气体能反应（CO2 使澄清石灰水变浑浊）', () => {
  const r = run([['Ca(OH)2', 0.0005], ['CO2', 0.0005]]);
  assert.equal(eq(r.events[0]), 'CO₂ + Ca(OH)₂ = CaCO₃↓ + H₂O');
  assert.ok(close(r.beaker.solids.CaCO3, 0.0005));
  assert.deepEqual(r.beaker.gases, {});
});

test('约定：本次生成的气体不再参加本次反应，下次 react 前清掉', () => {
  // 加热 Ca(HCO3)2 放出 CO2；CO2 不能再和 CaCO3、H2O 生成 Ca(HCO3)2。
  const r = run([['Ca(HCO3)2', 0.01]], { heated: true });
  assert.ok(!r.events.some(e => e.reactionId === 't-caco3-co2'));
  assert.ok(close(r.beaker.gases.CO2, 0.01));
  const r2 = react(r.beaker, { data: D });
  assert.equal(r2.events.length, 0);
  assert.deepEqual(r2.beaker.gases, {});
});

test('约定：用户通入、没反应完的气体留着，之后还能反应（氢气点燃）', () => {
  let r = run([['H2', 0.02], ['O2', 0.01]], {}, createBeaker('b', 'b', 0));
  assert.equal(r.events.length, 0);
  assert.ok(close(r.beaker.gases.H2, 0.02));
  r = react(r.beaker, { data: D, ignite: true });
  assert.equal(eq(r.events[0]), '2H₂ + O₂ =点燃= 2H₂O');
});

test('约定：addSubstance 的 form: "s" 或没有水时固体不溶解', () => {
  let b = addSubstance(createBeaker('b', 'b'), 'NaCl', 0.01, D, { form: 's' });
  assert.ok(close(b.solids.NaCl, 0.01));
  assert.deepEqual(b.ions, {});
  b = addSubstance(createBeaker('b', 'b', 0), 'KClO3', 0.02, D);
  assert.ok(close(b.solids.KClO3, 0.02));
  b = addSubstance(createBeaker('b', 'b'), 'NaCl', 0.01, D);
  assert.ok(close(b.ions['Na^+'], 0.01));
  // 固体 KClO3 加热分解
  b = addSubstance(addSubstance(createBeaker('b', 'b', 0), 'KClO3', 0.02, D), 'MnO2', 0.001, D);
  const r = react(b, { data: D, heated: true });
  assert.equal(eq(r.events[0]), '2KClO₃ =MnO₂、加热= 2KCl + 3O₂↑');
  assert.ok(close(r.beaker.solids.KCl, 0.02), '干试管里生成的 KCl 是固体');
  assert.deepEqual(r.beaker.ions, {});
});

test('约定：特殊反应的 conditionText 显示为条件', () => {
  const data = { ...D, REACTIONS: [{ id: 'x', name: '煅烧石灰石', match: { CaCO3: 1 }, produce: { CaO: 1, CO2: 1 }, condition: 'heat', conditionText: '高温', observations: [] }] };
  const b = addSubstance(createBeaker('b', 'b', 0), 'CaCO3', 0.01, D);
  const r = react(b, { data, heated: true });
  assert.equal(eq(r.events[0]), 'CaCO₃ =高温= CaO + CO₂↑');
});

// ---------- 真实数据（A 的物质表和特殊反应表）与引擎合在一起 ----------
const has = items => items.every(([id]) => DATA.SUBSTANCES[id]);
function runReal(items, ctx = {}) {
  let b = createBeaker('b', 'b');
  for (const [id, n, opt] of items) b = addSubstance(b, id, n, DATA, opt);
  return react(b, { data: DATA, ...ctx });
}

test('真实数据：不该发生的反应', () => {
  const none = [
    [['Cu', 0.01], ['HCl', 0.02]], [['Ag', 0.01], ['H2SO4', 0.01]], [['Ag', 0.01], ['CuSO4', 0.01]],
    [['Cu', 0.01], ['FeSO4', 0.01]], [['NaCl', 0.01], ['H2SO4', 0.01]], [['NaCl', 0.01], ['KNO3', 0.01]],
    [['BaSO4', 0.01, { form: 's' }], ['HCl', 0.02]], [['AgCl', 0.01, { form: 's' }], ['HNO3', 0.02]],
  ];
  for (const items of none.filter(has)) {
    const { events } = runReal(items);
    assert.equal(events.length, 0, items.map(x => x[0]).join(' + ') + ' 不应反应：' + events.map(e => e.reactionId || e.kind).join(','));
  }
});

test('真实数据：常见实验每个事件都守恒，并且有分子或离子方程式', () => {
  const mixes = [
    [['BaCl2', 0.01], ['H2SO4', 0.01]], [['CuSO4', 0.01], ['NaOH', 0.02]], [['Na2CO3', 0.01], ['HCl', 0.02]],
    [['CaCO3', 0.01], ['HCl', 0.02]], [['Zn', 0.01], ['H2SO4', 0.01]], [['Fe', 0.01], ['CuSO4', 0.01]],
    [['Na', 0.01]], [['CaO', 0.001]], [['NaHCO3', 0.01], ['HCl', 0.01]], [['Ca(OH)2', 0.0005], ['CO2', 0.0005]],
    [['Cu', 0.01], ['HNO3', 0.04]], [['Fe2O3', 0.01], ['HCl', 0.06]], [['NH4Cl', 0.01], ['NaOH', 0.01]],
  ];
  for (const items of mixes.filter(has)) {
    for (const heated of [false, true]) {
      const { events } = runReal(items, { heated });
      for (const e of events) {
        assert.ok(e.equation || e.ionic, `${items.map(x => x[0]).join('+')}: ${e.reactionId || e.kind} 没有方程式`);
        for (const x of [e.equation, e.ionic]) if (x) assert.ok(checkConservation(x).ok, `${e.reactionId || e.kind}: ${formatEquation(x)}`);
      }
    }
  }
});

// ---------- 沉淀转化、气体试剂（真实数据） ----------
function realSeq(steps, water = 50) {
  let b = createBeaker('b', 'b', water);
  const all = [];
  for (const [items, ctx = {}] of steps) {
    for (const [id, n, opt] of items) b = addSubstance(b, id, n, DATA, opt);
    const r = react(b, { data: DATA, ...ctx });
    b = r.beaker; all.push(...r.events);
  }
  return { beaker: b, events: all };
}
const eqs = events => events.map(e => e.equation && formatEquation(e.equation));

test('沉淀转化：微溶/难溶物遇到能生成更难溶物的离子就转化', () => {
  const cases = [
    [[['CaSO4', 0.002, { form: 's' }]], [['Na2CO3', 0.002]], 'CaSO₄ + Na₂CO₃ = CaCO₃ + Na₂SO₄', 'CaCO3'],
    [[['AgNO3', 0.002], ['NaCl', 0.002]], [['KI', 0.002]], /^AgCl \+ (KI|NaI) = AgI \+ (KCl|NaCl)$/, 'AgI'],
    [[['AgNO3', 0.002], ['NaCl', 0.002]], [['NaBr', 0.002]], /^AgCl \+ NaBr = AgBr \+ NaCl$/, 'AgBr'],
    [[['ZnSO4', 0.002], ['Na2S', 0.002]], [['CuSO4', 0.002]], 'ZnS + CuSO₄ = CuS + ZnSO₄', 'CuS'],
    [[['MgCl2', 0.003], ['NaOH', 0.006]], [['FeCl3', 0.002]], '3Mg(OH)₂ + 2FeCl₃ = 2Fe(OH)₃ + 3MgCl₂', 'Fe(OH)3'],
  ];
  for (const [first, second, expected, product] of cases) {
    if (!has([...first, ...second])) continue;
    const r = realSeq([[first], [second]]);
    const ok = eqs(r.events).some(x => (expected instanceof RegExp ? expected.test(x || '') : x === expected));
    assert.ok(ok, `${expected}：实际 ${eqs(r.events).join(' / ')}`);
    assert.ok(r.beaker.solids[product] > 0);
    for (const e of r.events) for (const x of [e.equation, e.ionic]) if (x) assert.ok(checkConservation(x).ok, formatEquation(x));
  }
});

test('沉淀转化：不会反过来（AgI 遇 Cl⁻、CaCO3 遇 SO4²⁻ 不转化）', () => {
  let r = realSeq([[[['AgNO3', 0.002], ['KI', 0.002]]], [[['NaCl', 0.004]]]]);
  assert.equal(r.events.length, 1);
  r = realSeq([[[['CaCO3', 0.002, { form: 's' }], ['Na2SO4', 0.002]]]]);
  assert.equal(r.events.length, 0);
});

test('几种沉淀能同时生成时，最难溶的先出（Cl⁻、I⁻ 混合液滴入 AgNO3 先出黄色 AgI）', () => {
  const r = runReal([['NaCl', 0.002], ['KI', 0.002], ['AgNO3', 0.002]]);
  assert.equal(r.events[0].ionic && formatEquation(r.events[0].ionic), 'Ag⁺ + I⁻ = AgI↓');
});

test('气体都在试剂架上，可以通入烧杯', () => {
  for (const id of ['NO', 'NO2', 'CO', 'CO2', 'H2', 'O2', 'SO2', 'NH3', 'HCl_g', 'H2S']) {
    const s = DATA.SUBSTANCES[id];
    assert.ok(s && s.shelf && s.shelfForm === 'g', `${id} 应在试剂架上，形态为气体`);
  }
});

test('气体反应：2NO + O2、3NO2 + H2O、CO 还原 CuO、HCl 溶于水、H2S 与 CuSO4', () => {
  const one = (steps, water) => eqs(realSeq(steps, water).events);
  assert.ok(one([[[['NO', 0.002], ['O2', 0.001]]]], 0).includes('2NO + O₂ = 2NO₂'));
  assert.ok(one([[[['NO2', 0.003]]]]).includes('3NO₂ + H₂O = 2HNO₃ + NO'));
  assert.ok(one([[[['CuO', 0.002, { form: 's' }], ['CO', 0.002]], { heated: true }]], 0).includes('CuO + CO =加热= Cu + CO₂'));
  const hcl = realSeq([[[['HCl_g', 0.002]]]]);
  assert.ok(Math.abs(hcl.beaker.ions['H^+'] - 0.002) < 1e-9, 'HCl 气体溶于水成为盐酸');
  assert.ok(one([[[['H2S', 0.002], ['CuSO4', 0.002]]]]).includes('H₂S + CuSO₄ = CuS↓ + H₂SO₄'));
});
