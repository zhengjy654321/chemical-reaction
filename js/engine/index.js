// 反应引擎入口（B 负责）。约定见 CONTRACT.md 第 5 节。
import { clone, addTo } from '../state.js';
import { specialRule } from './special.js?v=4';
import { precipitationRule } from './precipitation.js';
import { acidBaseRule } from './acidbase.js';
import { displacementRule } from './displacement.js';
import { heatingRule } from './heating.js';

export const RULES = [specialRule, precipitationRule, acidBaseRule, displacementRule, heatingRule];
const MAX_STEPS = 50;

// 气体：react 开始时烧杯里的气体（用户通入的）可以参加反应；上一次反应生成、已逸出的气体
// （beaker.escaping 记录的部分）先去掉。本次生成的气体不再参与本次反应，最后和剩余气体一起放在
// gases 里，并记入 escaping，下次 react 开始时清掉。
export function react(beaker, ctx) {
  let b = clone(beaker);
  for (const [id, n] of Object.entries(b.escaping || {})) addTo(b.gases, id, -n);
  delete b.escaping;
  const produced = {};
  const events = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    let fired = null;
    for (const rule of RULES) {
      fired = rule(b, ctx);
      if (fired) break;
    }
    if (!fired) break;
    const next = fired.beaker;
    for (const [id, n] of Object.entries(next.gases)) {
      const d = n - (b.gases[id] || 0);
      if (d > 0) { addTo(next.gases, id, -d); addTo(produced, id, d); }
    }
    b = next;
    events.push(fired.event);
  }
  for (const [id, n] of Object.entries(produced)) addTo(b.gases, id, n);
  if (Object.keys(produced).length) b.escaping = produced;
  return { beaker: b, events };
}
