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

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

test('规模：约 100 种物质、100 条以上特殊反应', () => {
  assert.ok(Object.keys(SUBSTANCES).length >= 100, `物质只有 ${Object.keys(SUBSTANCES).length} 种`);
  assert.ok(REACTIONS.length >= 100, `特殊反应只有 ${REACTIONS.length} 条`);
});

test('物质：字段取值合法', () => {
  const cats = ['acid', 'base', 'salt', 'oxide', 'metal', 'nonmetal', 'organic', 'other'];
  for (const [id, s] of Object.entries(SUBSTANCES)) {
    assert.ok(cats.includes(s.category), `${id} category`);
    assert.ok(['s', 'l', 'g'].includes(s.state), `${id} state`);
    assert.equal(typeof s.color, 'string', `${id} color`);
    if (s.shelf) assert.ok(['aq', 's', 'l', 'g'].includes(s.shelfForm), `${id} shelfForm`);
    if (s.ions) assert.ok(s.soluble, `${id} 有 ions 却不可溶`);
    if (!id.includes('_')) assert.equal(s.formula, id, `${id} formula 应与 id 相同`);
  }
});

test('难溶物表：按电荷配比后与产物化学式原子守恒、无重复', () => {
  const seen = new Set();
  for (const row of INSOLUBLE) {
    const key = row.cation + '|' + row.anion;
    assert.ok(!seen.has(key), `重复 ${key}`);
    seen.add(key);
    const qc = IONS[row.cation].charge, qa = -IONS[row.anion].charge;
    assert.ok(qc > 0 && qa > 0, key);
    const g = gcd(qc, qa);
    const eq = { reactants: [{ formula: row.cation, n: qa / g }, { formula: row.anion, n: qc / g }], products: [{ formula: SUBSTANCES[row.product].formula, n: 1 }] };
    assert.ok(checkConservation(eq).ok, `${key} -> ${row.product} 配比不对`);
    assert.ok(!SUBSTANCES[row.product].ions || row.slight, `${row.product} 难溶物不应写 ions`);
  }
});

test('特殊反应：字段完整、条件合法、催化剂不在反应物中', () => {
  for (const r of REACTIONS) {
    assert.ok(r.name && r.id, JSON.stringify(r));
    assert.ok(['none', 'heat', 'ignite', 'electrolysis'].includes(r.condition), `${r.id} condition`);
    assert.ok(Array.isArray(r.observations) && r.observations.length > 0, `${r.id} 缺现象`);
    assert.ok(Object.keys(r.match).length > 0 && Object.keys(r.produce).length > 0, `${r.id} 空`);
    for (const n of [...Object.values(r.match), ...Object.values(r.produce)]) assert.ok(Number.isInteger(n) && n > 0, `${r.id} 系数`);
    if (r.catalyst) assert.ok(!(r.catalyst in r.match), `${r.id} 催化剂被消耗`);
    if (r.conditionText !== undefined) assert.equal(typeof r.conditionText, 'string');
    if (r.display) {
      for (const id of [...Object.keys(r.display.reactants), ...Object.keys(r.display.products)]) assert.ok(known(id), `${r.id} display: 未知 ${id}`);
    }
  }
});

test('特殊反应：系数为最简整数比', () => {
  for (const r of REACTIONS) {
    const all = [...Object.values(r.match), ...Object.values(r.produce)];
    assert.equal(all.reduce(gcd), 1, `${r.id} 系数可约`);
  }
});
