// 酸碱中和、生成气体（H⁺+CO₃²⁻、NH₄⁺+OH⁻ 加热等）（B 负责）。
// 签名：(beaker, ctx) => null | { beaker, event }，每次只执行一步。见 CONTRACT.md 第 5 节。

export function acidBaseRule(beaker, ctx) {
  return null; // TODO(B)
}
