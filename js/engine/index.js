// 反应引擎入口（B 负责）。约定见 CONTRACT.md 第 5 节。
import { clone } from '../state.js';
import { specialRule } from './special.js';
import { precipitationRule } from './precipitation.js';
import { acidBaseRule } from './acidbase.js';
import { displacementRule } from './displacement.js';
import { heatingRule } from './heating.js';

export const RULES = [specialRule, precipitationRule, acidBaseRule, displacementRule, heatingRule];
const MAX_STEPS = 50;

export function react(beaker, ctx) {
  let b = clone(beaker);
  b.gases = {};
  const events = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    let fired = null;
    for (const rule of RULES) {
      fired = rule(b, ctx);
      if (fired) break;
    }
    if (!fired) break;
    b = fired.beaker;
    events.push(fired.event);
  }
  return { beaker: b, events };
}
