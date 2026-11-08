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
