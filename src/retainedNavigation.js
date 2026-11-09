import { frameLeaveMotion, retainedFrameEnterMotion } from './pageTransitionMotion'

// A Frame-like visual transition that keeps Vue business state mounted.
// This is used only for game/server changes on existing game-specific pages.
// No live controls, embedded web pages or media are duplicated for interaction.
export function createRetainedNavigation(getHost) {
  const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  let animations = [], snapshot = null, generation = 0
  function finish() {
    generation += 1
    for (const animation of animations) animation.cancel()
    animations = []
    snapshot?.remove()
    snapshot = null
  }
  function navigate() {
    finish()
    const host = getHost()
    const page = host?.firstElementChild
    if (!page || !host.isConnected || !host.parentElement || media?.matches || typeof host.animate !== 'function') return
    snapshot = page.cloneNode(true)
    const originals = [page, ...page.querySelectorAll('*')]
    const copies = [snapshot, ...snapshot.querySelectorAll('*')]
    const scrollPositions = originals.map((node, index) => ({ node: copies[index], top: node.scrollTop, left: node.scrollLeft })).filter(item => item.top || item.left)
    snapshot.querySelectorAll('script,iframe,video,audio,object,embed').forEach(node => node.remove())
    snapshot.removeAttribute('id')
    snapshot.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
    snapshot.setAttribute('aria-hidden', 'true')
    snapshot.setAttribute('inert', '')
    snapshot.dataset.navigationSnapshot = ''
    Object.assign(snapshot.style, { position: 'absolute', inset: '0', width: `${host.clientWidth}px`, height: `${host.clientHeight}px`, zIndex: '3', pointerEvents: 'none' })
    host.parentElement.append(snapshot)
    for (const item of scrollPositions) if (item.node.isConnected) { item.node.scrollTop = item.top; item.node.scrollLeft = item.left }
    const token = generation
    try {
      const leave = frameLeaveMotion()
      const old = snapshot.animate(leave.frames, leave.options)
      animations.push(old)
      const enter = retainedFrameEnterMotion()
      const incoming = host.animate(enter.frames, enter.options)
      animations.push(incoming)
      old.finished.then(() => { if (token === generation) { snapshot?.remove(); snapshot = null } }).catch(() => {})
      incoming.finished.then(() => { if (token === generation) finish() }).catch(() => {})
    } catch { finish() }
  }
  media?.addEventListener?.('change', finish)
  globalThis.addEventListener?.('resize', finish)
  return { navigate, finish, dispose() { finish(); media?.removeEventListener?.('change', finish); globalThis.removeEventListener?.('resize', finish) } }
}
