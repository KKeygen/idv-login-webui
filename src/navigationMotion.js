// NavigationView.cpp, WindowsAppSDK 1.8.11 (microsoft-ui-xaml ba3b6cd9),
// PlayIndicatorAnimations: grow for one third, then contract to the next item.
export const NAVIGATION_DURATION = 600
export const NAVIGATION_GROW_FRACTION = 1 / 3
export const NAVIGATION_GROW_EASING = 'cubic-bezier(0.9, 0.1, 1, 0.2)'
export const NAVIGATION_SHRINK_EASING = 'cubic-bezier(0.1, 0.9, 0.2, 1)'
export const NAVIGATION_INDICATOR_HEIGHT = 16

/** Two-edge equivalent of the native Offset/Scale/CenterPoint animations.
 * Each indicator keeps its own local origin. At 200 ms the stationary edge
 * changes without a geometric discontinuity. Height preserves the rounded ends.
 */
export function navigationIndicatorFrames(from, to, outgoing = false) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return []
  const height = NAVIGATION_INDICATOR_HEIGHT
  return [
    { offset: 0, transform: `translateY(${from}px)`, height: `${height}px`, opacity: 1, easing: NAVIGATION_GROW_EASING },
    { offset: NAVIGATION_GROW_FRACTION, transform: `translateY(${Math.min(from, to)}px)`, height: `${Math.abs(to - from) + height}px`, opacity: 1, easing: NAVIGATION_SHRINK_EASING },
    { offset: 1, transform: `translateY(${to}px)`, height: `${height}px`, opacity: outgoing ? 0 : 1 },
  ]
}

export function navigationFocusTarget(items, currentId, key) {
  const available = items.filter(item => !item.disabled && !item.hidden)
  if (!available.length) return null
  if (key === 'Home') return available[0].id
  if (key === 'End') return available.at(-1).id
  if (key !== 'ArrowUp' && key !== 'ArrowDown') return currentId
  const current = available.findIndex(item => item.id === currentId)
  if (current < 0) return key === 'ArrowUp' ? available.at(-1).id : available[0].id
  // NavigationView stops at the ends rather than wrapping to another group.
  return available[Math.max(0, Math.min(available.length - 1, current + (key === 'ArrowDown' ? 1 : -1)))].id
}

function resetIndicator(element, visible) {
  if (!element?.style) return
  element.style.opacity = visible ? '1' : '0'
  element.style.transform = 'translateY(0px)'
  element.style.height = `${NAVIGATION_INDICATOR_HEIGHT}px`
}

/** DOM-independent coordinator, also exercised with fake WAAPI elements.
 * A different target completes the old transition first, exactly as WinUI does.
 * A repeated target does not restart it. Late completion callbacks are ignored.
 */
export function createNavigationIndicatorMotion({ getIndicator, getGeometry, reducedMotion = () => false }) {
  let activeId = null
  let activeElement = null
  let running = null
  let disposed = false

  function finish() {
    const previous = running
    if (!previous) return
    running = null
    for (const animation of previous.animations) {
      animation.onfinish = null
      animation.oncancel = null
      animation.cancel()
    }
    resetIndicator(previous.outgoing, false)
    resetIndicator(previous.incoming, true)
  }

  function select(id, { immediate = false } = {}) {
    if (disposed) return
    const incoming = getIndicator(id)
    if (running && id === activeId && incoming === activeElement && !immediate && !reducedMotion()) return
    finish()
    const outgoing = activeElement
    const previousId = activeId
    activeId = id
    activeElement = incoming || null
    const previous = outgoing && getGeometry(previousId)
    const next = incoming && getGeometry(id)
    resetIndicator(outgoing, false)
    resetIndicator(incoming, Boolean(next))
    if (immediate || reducedMotion() || !outgoing || !incoming || outgoing === incoming || !previous || !next
      || typeof outgoing.animate !== 'function' || typeof incoming.animate !== 'function') return

    const distance = next.top - previous.top
    if (!Number.isFinite(distance) || Math.abs(distance) < 0.01) return
    // This component is flat, so all its items share the same indicator depth.
    const transition = { outgoing, incoming, animations: [] }
    running = transition
    resetIndicator(outgoing, true)
    try {
      transition.animations.push(outgoing.animate(navigationIndicatorFrames(0, distance, true), { duration: NAVIGATION_DURATION, fill: 'both' }))
      transition.animations.push(incoming.animate(navigationIndicatorFrames(-distance, 0), { duration: NAVIGATION_DURATION, fill: 'both' }))
      let remaining = transition.animations.length
      for (const animation of transition.animations) {
        animation.onfinish = () => {
          if (running !== transition) return
          if (--remaining === 0) finish()
        }
        animation.oncancel = () => { if (running === transition) finish() }
      }
    } catch {
      // Older embedded webviews can expose WAAPI but reject an animation.
      finish()
    }
  }

  return {
    select,
    finish,
    refresh() { select(activeId, { immediate: true }) },
    dispose() {
      finish()
      resetIndicator(activeElement, false)
      activeElement = null
      activeId = null
      disposed = true
    },
  }
}
