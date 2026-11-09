const REVEAL_SELECTOR = '[data-reveal="on"]'

/**
 * Fluent/WinUI-style pointer reveal.
 *
 * Only the element currently under the pointer is repainted. Pointer updates
 * are coalesced to one write per animation frame, so large pages do not gain a
 * document-sized mousemove repaint surface.
 */
export function installMotionSystem(root = document) {
  if (!root?.addEventListener) return () => {}

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  let current = null
  let point = null
  let frame = 0

  function clearCurrent() {
    if (!current) return
    current.classList.remove('reveal-pointer-active')
    current = null
  }

  function flush() {
    frame = 0
    if (!current || !point || !current.isConnected) return
    const rect = current.getBoundingClientRect()
    current.style.setProperty('--reveal-x', `${point.x - rect.left}px`)
    current.style.setProperty('--reveal-y', `${point.y - rect.top}px`)
  }

  function queueFlush() {
    if (!frame) frame = requestAnimationFrame(flush)
  }

  function findRevealTarget(event) {
    if (event.pointerType === 'touch' || reducedMotion?.matches) return null
    const origin = event.target instanceof Element ? event.target : null
    const target = origin?.closest(REVEAL_SELECTOR)
    if (!target || target.matches(':disabled, [aria-disabled="true"]')) return null
    return target
  }

  function handlePointerMove(event) {
    const target = findRevealTarget(event)
    if (target !== current) {
      clearCurrent()
      current = target
      current?.classList.add('reveal-pointer-active')
    }
    if (!current) return
    point = { x: event.clientX, y: event.clientY }
    queueFlush()
  }

  function handlePointerOut(event) {
    if (!current) return
    const next = event.relatedTarget instanceof Element ? event.relatedTarget : null
    if (next && current.contains(next)) return
    clearCurrent()
  }

  function handleWindowBlur() {
    clearCurrent()
  }

  root.addEventListener('pointermove', handlePointerMove, { capture: true, passive: true })
  root.addEventListener('pointerout', handlePointerOut, { capture: true, passive: true })
  globalThis.addEventListener?.('blur', handleWindowBlur)

  return () => {
    root.removeEventListener('pointermove', handlePointerMove, true)
    root.removeEventListener('pointerout', handlePointerOut, true)
    globalThis.removeEventListener?.('blur', handleWindowBlur)
    if (frame) cancelAnimationFrame(frame)
    clearCurrent()
  }
}

/** Freeze layout before Vue removes a grid/list item from flow. */
export function freezeLeavingElement(element) {
  // Layout dimensions exclude a parent dialog's in-progress scale.
  const style = getComputedStyle(element)
  element.style.width = `${parseFloat(style.width) || element.offsetWidth}px`
  element.style.height = `${parseFloat(style.height) || element.offsetHeight}px`
  element.style.left = `${element.offsetLeft}px`
  element.style.top = `${element.offsetTop}px`
}
export function clearLeavingElement(element) {
  for (const name of ['width', 'height', 'left', 'top']) element.style.removeProperty(name)
}
