// Shared between ModalShell instances; ownership lasts through the leave motion.
const layers = []
const saved = new Map()
let observer
let originalOverflow

export function focusableElements(root) {
  if (!root) return []
  return [...root.querySelectorAll('a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]')].filter(element => {
    if (element.disabled || element.tabIndex < 0 || element.closest('[inert],[hidden],[aria-hidden="true"]')) return false
    for (let parent = element; parent && parent !== root.parentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden') return false
    }
    return true
  })
}

function restoreInert() {
  for (const [element, state] of saved) {
    if (state.inert === null) element.removeAttribute('inert')
    else element.setAttribute('inert', state.inert)
    if (state.hidden === null) element.removeAttribute('aria-hidden')
    else element.setAttribute('aria-hidden', state.hidden)
  }
  saved.clear()
}

function syncBackground() {
  restoreInert()
  const top = layers.at(-1)?.root
  if (!top) return
  for (const child of document.body.children) {
    if (child === top || child.contains(top) || ['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName)) continue
    saved.set(child, { inert: child.getAttribute('inert'), hidden: child.getAttribute('aria-hidden') })
    child.setAttribute('inert', '')
    child.setAttribute('aria-hidden', 'true')
  }
}

export function activateModalLayer(token, root, dialog, originalFocus) {
  const existing = layers.findIndex(layer => layer.token === token)
  const old = existing < 0 ? null : layers.splice(existing, 1)[0]
  const returnFocus = old?.returnFocus || originalFocus || document.activeElement
  layers.push({ token, root, dialog, returnFocus })
  if (layers.length === 1 && !observer) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    observer = new MutationObserver(syncBackground)
    observer.observe(document.body, { childList: true })
  }
  syncBackground()
}

export function deactivateModalLayer(token) {
  const index = layers.findIndex(layer => layer.token === token)
  if (index < 0) return
  const wasTop = index === layers.length - 1
  const [layer] = layers.splice(index, 1)
  // A child may outlive its parent. Preserve a usable focus-return chain.
  for (const remaining of layers) {
    if (layer.root.contains(remaining.returnFocus)) remaining.returnFocus = layer.returnFocus
  }
  syncBackground()
  if (!layers.length) {
    observer?.disconnect()
    observer = undefined
    document.body.style.overflow = originalOverflow || ''
  }
  if (!wasTop) return
  const previous = layer.returnFocus
  const top = layers.at(-1)
  if (previous?.isConnected && !previous.closest?.('[inert]') && (!top || top.root.contains(previous))) previous.focus?.({ preventScroll: true })
  else if (top) (focusableElements(top.dialog)[0] || top.dialog).focus({ preventScroll: true })
}
