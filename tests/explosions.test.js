import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA } from '../js/data.js';
import { react } from '../js/engine/index.js';
import { EXPLOSIONS, loadExplosion, triggerExplosion, maxIntensity } from '../js/explosions.js';

for (const p of EXPLOSIONS) {
  test(`快捷爆炸实验：${p.title}`, () => {
    assert.ok(DATA.REACTIONS.some(r => r.id === p.reaction), `${p.reaction} 不在反应表里`);
    const b0 = loadExplosion(p, 'x', 't', DATA);
    // 装好后、引发前不应发生这个反应
    const idle = react(b0, { data: DATA, heated: false, ignite: false });
    assert.ok(!idle.events.some(e => e.reactionId === p.reaction), '还没引发就反应了');
    const { beaker, ctx } = triggerExplosion(p, idle.beaker, DATA);
    const { events } = react(beaker, { data: DATA, heated: false, ignite: false, ...ctx });
    assert.ok(events.some(e => e.reactionId === p.reaction), `没有触发 ${p.reaction}：${JSON.stringify(events.map(e => e.reactionId))}`);
    assert.equal(maxIntensity(events), p.level);
  });
}

test('氢气和氯气：不光照不点燃就不反应', () => {
  const p = EXPLOSIONS.find(x => x.id === 'h2-cl2-light');
  const { events } = react(loadExplosion(p, 'x', 't', DATA), { data: DATA, heated: true });
  assert.equal(events.length, 0);
});

import { nozzleIgnite } from '../js/explosions.js';
import { createBeaker, addSubstance } from '../js/state.js';

test('导管口点燃：混有氧气就爆炸，没有可燃气体就不反应', () => {
  let b = createBeaker('x', 't', 0);
  b = { ...b, gases: { CO: 0.004, O2: 0.002 } };
  const r = nozzleIgnite(b);
  assert.ok(r.mixed);
  assert.equal(maxIntensity(react(r.beaker, { data: DATA, ...r.ctx }).events), 3);
  assert.equal(nozzleIgnite(createBeaker('y', 't')).fuels.length, 0);
});

test('导管口点燃：锌和稀硫酸刚生成的氢气也能安静燃烧', () => {
  let b = addSubstance(createBeaker('x', 't'), 'H2SO4', 0.01, DATA);
  b = addSubstance(b, 'Zn', 0.005, DATA, { form: 's' });
  b = react(b, { data: DATA }).beaker;
  assert.ok(b.gases.H2 > 0);
  const r = nozzleIgnite(b);
  const { events } = react(r.beaker, { data: DATA, ...r.ctx });
  const ev = events.find(e => e.reactionId === 'h2-o2');
  assert.ok(ev, JSON.stringify(events.map(e => e.reactionId)));
  assert.equal(ev.intensity, 0);
  assert.match(ev.observations[0], /安静燃烧/);
});
