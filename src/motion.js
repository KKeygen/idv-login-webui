const REVEAL_SELECTOR = 'button:not([data-reveal="off"]), [data-reveal]:not([data-reveal="off"])'

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
