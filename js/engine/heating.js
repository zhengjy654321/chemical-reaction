// 通用加热规则（溶液蒸发、受热分解的兜底）（B 负责）。
// 签名：(beaker, ctx) => null | { beaker, event }，每次只执行一步。见 CONTRACT.md 第 5 节。

export function heatingRule(beaker, ctx) {
  return null; // TODO(B)
}
