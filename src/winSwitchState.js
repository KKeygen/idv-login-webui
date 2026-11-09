export const SWITCH_TRAVEL = 20
export const SWITCH_RESPONSE_MS = 83
export const SWITCH_RESPONSE_EASING = 'cubic-bezier(0, 0, 0, 1)'

export function switchDragOffset(checked, delta) {
  return Math.max(0, Math.min(SWITCH_TRAVEL, (checked ? SWITCH_TRAVEL : 0) + delta))
}

// WinUI ToggleSwitch::MoveCompleted toggles on reaching the midpoint from
// either side, including an exact tie. A drag that returns to its side is a no-op.
export function switchDragResult(checked, offset) {
  if (!Number.isFinite(offset)) return checked
  const crossed = checked ? offset <= SWITCH_TRAVEL / 2 : offset >= SWITCH_TRAVEL / 2
  return crossed ? !checked : checked
}

export function switchKnobGeometry(checked, state = 'normal') {
  if (state === 'pressed') return { width: 17, height: 14, left: checked ? 0 : 3 }
  if (state === 'hover') return { width: 14, height: 14, left: 2.5 }
  // The native template's -1/0/0/0 (off), 0/0/1/0 (on) margins produce 3.5.
  return { width: 12, height: 12, left: 3.5 }
}
