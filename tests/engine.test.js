// 引擎测试（B 负责扩充）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from '../js/data.js';
import { createBeaker, addSubstance, pour, filter } from '../js/state.js';
import { react } from '../js/engine/index.js';
import { formatEquation, checkConservation } from '../js/equation.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('BaCl2 + H2SO4 生成 BaSO4 沉淀', () => {
  let b = createBeaker('b1', '烧杯 1');
  b = addSubstance(b, 'BaCl2', 0.01, DATA);
  b = addSubstance(b, 'H2SO4', 0.005, DATA);
  const { beaker, events } = react(b, { data: DATA });
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'precipitation');
  assert.equal(formatEquation(events[0].ionic), 'Ba²⁺ + SO₄²⁻ = BaSO₄↓');
  assert.ok(checkConservation(events[0].ionic).ok);
  assert.deepEqual(events[0].observations, ['产生白色沉淀']);
  assert.ok(close(beaker.solids.BaSO4, 0.005));
  assert.ok(close(beaker.ions['Ba^2+'], 0.005));
  assert.equal(beaker.ions['SO4^2-'], undefined);
  assert.ok(close(beaker.ions['H^+'], 0.01));
});

test('倾倒后反应，过滤分出沉淀', () => {
  let a = addSubstance(createBeaker('a', 'A'), 'BaCl2', 0.01, DATA);
  let b = addSubstance(createBeaker('b', 'B'), 'H2SO4', 0.01, DATA);
  ({ from: a, to: b } = pour(a, b));
  assert.equal(Object.keys(a.ions).length, 0);
  const r = react(b, { data: DATA });
  const { filtrate, residue } = filter(r.beaker);
  assert.ok(close(residue.BaSO4, 0.01));
  assert.deepEqual(filtrate.solids, {});
});

test('特殊反应：H2O2 遇 MnO2 放出 O2', () => {
  let b = createBeaker('b1', '烧杯 1');
  b = addSubstance(b, 'H2O2', 0.02, DATA);
  assert.equal(react(b, { data: DATA }).events.length, 0, '无催化剂不反应');
  b = addSubstance(b, 'MnO2', 0.001, DATA);
  const { beaker, events } = react(b, { data: DATA });
  assert.equal(formatEquation(events[0].equation), '2H₂O₂ =MnO₂= 2H₂O + O₂↑');
  assert.ok(close(beaker.gases.O2, 0.01));
  assert.ok(close(beaker.solids.MnO2, 0.001));
});

test('加热条件：Cu(OH)2 只在加热时分解', () => {
  let b = createBeaker('b1', '烧杯 1');
  b = addSubstance(b, 'CuSO4', 0.01, DATA);
  b = addSubstance(b, 'NaOH', 0.02, DATA);
  let r = react(b, { data: DATA });
  assert.ok(close(r.beaker.solids['Cu(OH)2'], 0.01));
  r = react(r.beaker, { data: DATA, heated: true });
  assert.equal(formatEquation(r.events[0].equation), 'Cu(OH)₂ =加热= CuO + H₂O');
  assert.ok(close(r.beaker.solids.CuO, 0.01));
});
