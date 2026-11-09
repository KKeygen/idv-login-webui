// Browser mapping of WinUI ba3b6cd9 ThemeAnimations.cpp and
// LayoutTransition_partial.cpp; precise sources are in WINUI_FORM_CONTROLS.md.
export const EXPANDER_MOTION = { enter: 333, leave: 167, upLeave: 200, enterEasing: 'cubic-bezier(0, 0, 0, 1)', leaveEasing: 'cubic-bezier(1, 1, 0, 1)' }
export const DIALOG_MOTION = { enter: 250, leave: 167, opacity: 83, easing: 'cubic-bezier(0, 0, 0, 1)' }
export const SELECT_MOTION = { enter: 250, leave: 167, opacity: 83, closeOpacityDelay: 84, easing: 'cubic-bezier(0, 0, 0, 1)' }

export function reducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Starts from the actually displayed frame, not an old animation endpoint.
export function animateStyles(element, from, to, options = {}) {
  return animateKeyframes(element, [from, to], options)
}

export function animateKeyframes(element, frames, { duration, easing = 'linear', delay = 0 } = {}) {
  const final = frames.at(-1)
  for (const [property, value] of Object.entries(final)) {
    if (!['offset', 'easing', 'composite'].includes(property)) element.style[property] = value
  }
  if (!duration || !element.animate) {
    let timer
    let complete
    const finished = new Promise(resolve => { complete = resolve; timer = setTimeout(resolve, duration + delay) })
    return { finished, cancel() { clearTimeout(timer); complete() }, finish() { clearTimeout(timer); complete() } }
  }
  const animation = element.animate(frames, { duration, easing, delay, fill: 'none' })
  return { finished: animation.finished.catch(() => {}), cancel: () => animation.cancel(), finish: () => animation.finish() }
}

// The native clip is centered on the trigger, with a translated 0.5 origin.
// It overcovers the far edge so both clip edges move at the same speed.
export function splitClip(height, anchor, phase) {
  height = Math.max(1, height)
  const offset = anchor - height / 2
  const ratio = phase === 'open-start' ? .5 : .15
  const scale = phase === 'full' ? 1 + 2 * Math.abs(offset) / height
    : Math.max(ratio, 2 * ratio - 1 + 2 * Math.abs(offset) / height)
  const half = height * scale / 2
  return `inset(${anchor - half}px 0px ${height - anchor - half}px 0px round 8px)`
}

// clip-path creates a Backdrop Root in Chromium: a nested acrylic surface can
// then no longer sample the page behind a popup. The positioned legacy rect
// clip preserves that backdrop while using the same native split geometry.
export function splitRect(height, anchor, phase, width) {
  height = Math.max(1, height)
  const offset = anchor - height / 2
  const ratio = phase === 'open-start' ? .5 : .15
  const scale = phase === 'full' ? 1 + 2 * Math.abs(offset) / height
    : Math.max(ratio, 2 * ratio - 1 + 2 * Math.abs(offset) / height)
  const half = height * scale / 2
  return `rect(${anchor - half}px, ${Math.max(0, width)}px, ${anchor + half}px, 0px)`
}

export function nextEnabled(options, start, step, wrap = true) {
  if (!options.length) return -1
  let index = start
  for (let count = 0; count < options.length; count += 1) {
    index += step
    if (!wrap && (index < 0 || index >= options.length)) return start
    index = (index + options.length) % options.length
    if (!options[index].disabled) return index
  }
  return -1
}

export function findTypeahead(options, text, start = -1) {
  const needle = text.toLocaleLowerCase()
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (start + offset + options.length) % options.length
    if (!options[index].disabled && String(options[index].label).toLocaleLowerCase().startsWith(needle)) return index
  }
  return -1
}

export function selectPlacement(rect, { viewportWidth, viewportHeight, rowHeight = 32, count, selectedIndex = 0, maxHeight = 504, margin = 8, padding = 4, outset = 0, minWidth = 80 }) {
  const width = Math.min(Math.max(rect.width + outset * 2, minWidth), Math.max(0, viewportWidth - margin * 2))
  const height = Math.min(Math.max(rowHeight + padding * 2, count * rowHeight + padding * 2), maxHeight, Math.max(0, viewportHeight - margin * 2))
  const index = Math.max(0, selectedIndex)
  const anchor = rect.top + rect.height / 2
  const wantedTop = anchor - padding - index * rowHeight - rowHeight / 2
  const top = Math.max(margin, Math.min(wantedTop, viewportHeight - height - margin))
  const maxScroll = Math.max(0, count * rowHeight + padding * 2 - height)
  const scrollTop = Math.max(0, Math.min(padding + index * rowHeight + rowHeight / 2 - (anchor - top), maxScroll))
  const selectedCenter = padding + index * rowHeight + rowHeight / 2 - scrollTop
  return { left: Math.max(margin, Math.min(rect.left - outset, viewportWidth - width - margin)), top, width, height, scrollTop, anchor: Math.max(rowHeight / 2, Math.min(selectedCenter, height - rowHeight / 2)) }
}
