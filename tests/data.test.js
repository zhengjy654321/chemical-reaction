// 数据自检（A 负责扩充）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from '../js/data.js';
import { parseFormula, checkConservation } from '../js/equation.js';

const { SUBSTANCES, IONS, INSOLUBLE, REACTIONS } = DATA;
const known = id => SUBSTANCES[id] || IONS[id];
const terms = (obj) => Object.entries(obj).map(([id, n]) => ({ formula: IONS[id] ? id : SUBSTANCES[id].formula, n }));

test('物质：id 一致、化学式可解析、电离后原子和电荷守恒', () => {
  for (const [id, s] of Object.entries(SUBSTANCES)) {
    assert.equal(s.id, id);
    assert.ok(s.name && s.category && s.state, `${id} 缺字段`);
    parseFormula(s.formula);
    if (s.ions) {
      for (const ion of Object.keys(s.ions)) assert.ok(IONS[ion], `${id} 的离子 ${ion} 不在 IONS`);
      const r = checkConservation({ reactants: [{ formula: s.formula, n: 1 }], products: terms(s.ions) });
      assert.ok(r.ok, `${id} 电离不守恒 ${JSON.stringify(r)}`);
    }
  }
});

test('离子：id 与 formula/charge 一致', () => {
  for (const [id, ion] of Object.entries(IONS)) {
    assert.equal(ion.id, id);
    assert.equal(parseFormula(id).charge, ion.charge, id);
    assert.deepEqual(parseFormula(id).atoms, parseFormula(ion.formula).atoms, id);
  }
});

test('难溶物表：离子和产物都存在且守恒', () => {
  for (const row of INSOLUBLE) {
    assert.ok(IONS[row.cation] && IONS[row.anion] && SUBSTANCES[row.product], JSON.stringify(row));
    const p = parseFormula(SUBSTANCES[row.product].formula);
    assert.equal(p.charge, 0);
  }
});

test('特殊反应：引用存在、原子电荷守恒', () => {
  const ids = new Set();
  for (const r of REACTIONS) {
    assert.ok(!ids.has(r.id), `重复 id ${r.id}`);
    ids.add(r.id);
    for (const id of [...Object.keys(r.match), ...Object.keys(r.produce)]) assert.ok(known(id), `${r.id}: 未知 ${id}`);
    if (r.catalyst) assert.ok(SUBSTANCES[r.catalyst], `${r.id}: 未知催化剂`);
    const c = checkConservation({ reactants: terms(r.match), products: terms(r.produce) });
    assert.ok(c.ok, `${r.id} 不守恒 ${JSON.stringify(c)}`);
    if (r.display) {
      const d = checkConservation({ reactants: terms(r.display.reactants), products: terms(r.display.products) });
      assert.ok(d.ok, `${r.id} display 不守恒 ${JSON.stringify(d)}`);
    }
  }
});
