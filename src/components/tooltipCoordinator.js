// ToolTipService_Partial.{cpp,h}, WinUI ba3b6cd9: one automatic tooltip,
// a 200ms reshow window, and a convex safe zone joining owner and tooltip.
const registered = new Set()
let current = null
let lastClosed = -Infinity
export const TOOLTIP_TIMING = { hover: 400, between: 200, safeZoneCheck: 1000 }
export function tooltipDelay(mode, reshow, hover = TOOLTIP_TIMING.hover) {
  // Preserve the actual source expression, including INT64(1.5) truncation.
  // The comment says 1.5× for mouse reshow, but this revision executes 1×.
  return mode === 'touch' ? (reshow ? 0 : hover) : mode === 'mouse' && reshow ? hover : hover * 2
}
export function registerTooltip(token) { registered.add(token) }
export function releaseTooltip(token) {
  if (current?.token !== token) return
  if (current.visible) lastClosed = Date.now()
  current = null
}
export function unregisterTooltip(token) {
  releaseTooltip(token)
  registered.delete(token)
  if (!registered.size) lastClosed = -Infinity
}
export function claimTooltip(token, close, mode, explicitDelay) {
  if (current?.token === token) return null
  current?.close()
  const delay = explicitDelay ?? tooltipDelay(mode, Date.now() - lastClosed < TOOLTIP_TIMING.between)
  current = { token, close, visible: false }
  return Math.max(0, delay)
}
export function markTooltipVisible(token) {
  if (current?.token !== token) return false
  current.visible = true
  return true
}
export function inTooltipSafeZone(point, owner, tooltip) {
  const inside = rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  if (inside(owner) || inside(tooltip)) return true
  const corners = rect => [[rect.left, rect.top], [rect.right, rect.top], [rect.right, rect.bottom], [rect.left, rect.bottom]]
  const points = [...corners(owner), ...corners(tooltip)].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const half = ordered => {
    const result = []
    for (const p of ordered) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop()
      result.push(p)
    }
    result.pop()
    return result
  }
  const hull = [...half(points), ...half([...points].reverse())]
  if (hull.length < 3) return false
  const test = [point.x, point.y]
  return hull.every((vertex, index) => cross(vertex, hull[(index + 1) % hull.length], test) >= -1e-6)
}
