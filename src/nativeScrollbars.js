/*! WinUI ScrollBar overlay for actual browser/Qt scroll containers.
 * Microsoft source-derived geometry and state timing.
 * Source: microsoft/microsoft-ui-xaml @ ba3b6cd989b4bac7c82791ad76a28d837bbf903b
 * Wheel/touch inertia and content keyboard scrolling remain owned by the browser.
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.

 */
import { SCROLLBAR, createScrollIndicatorState, scrollbarMetrics } from './scrollbarState'
import { acrylicRecipe } from './acrylicRecipe'
import { acrylicNoise } from './acrylicNoise'

const parents = new WeakMap()
let filterSequence = 0
const editable = 'input,textarea,select,[contenteditable="true"]'
const ignored = '.win-scroll-overlay,.game-rail,[data-win-scrollbars="native"],[data-win-scrollbars="hidden"]'
function positionParent(parent, window) {
  let entry = parents.get(parent)
  if (!entry) {
    const old = parent.style.position
    const changed = window.getComputedStyle(parent).position === 'static'
    if (changed) parent.style.position = 'relative'
    entry = { count: 0, old, changed }
    parents.set(parent, entry)
  }
  entry.count++
  return () => { if (--entry.count === 0) { if (entry.changed && parent.style.position === 'relative') parent.style.position = entry.old; parents.delete(parent) } }
}
function node(document, tag, className) { const element = document.createElement(tag); element.className = className; return element }
function setStyle(element, property, value) { if (element.style[property] !== value) element.style[property] = value }
function acrylicDefinition(document) {
  const id = `win-scroll-acrylic-${++filterSequence}`
  const svg = (name, attributes) => { const element = document.createElementNS('http://www.w3.org/2000/svg', name); for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value); return element }
  const definition = svg('svg', { class: 'win-scroll-definition', width: '0', height: '0', focusable: 'false' })
  const defs = svg('defs', {}), filter = svg('filter', { id, x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' })
  // Same backdrop effect graph as AcrylicSurface.vue. Nested CSS mix-blend-mode
  // does not produce the native graph under Chromium's backdrop isolation.
  const luminosity = svg('feFlood', { result: 'luminosity' }), tint = svg('feFlood', { result: 'tint' })
  filter.append(svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '30', edgeMode: 'duplicate', result: 'blurred' }), luminosity,
    svg('feBlend', { in: 'luminosity', in2: 'blurred', mode: 'luminosity', result: 'luminosityOutput' }), tint,
    svg('feBlend', { in: 'tint', in2: 'luminosityOutput', mode: 'color' }))
  defs.append(filter); definition.append(defs)
  return { definition, id, update(recipe) { for (const [element, color] of [[luminosity, recipe.luminosity], [tint, recipe.tint]]) { element.setAttribute('flood-color', `rgb(${color.slice(0, 3).join(',')})`); element.setAttribute('flood-opacity', color[3]) } } }
}

export function attachNativeScrollbars(viewport, options = {}) {
  const document = viewport.ownerDocument, window = document.defaultView, parent = viewport.parentElement
  if (!parent) return null
  const releaseParent = positionParent(parent, window)
  const overlay = node(document, 'div', 'win-scroll-overlay')
  overlay.dataset.mode = 'none'
  overlay.setAttribute('aria-hidden', 'true') // Native ScrollBar thumbs are Raw; the actual scroll container remains accessible.
  const material = acrylicDefinition(document)
  overlay.append(material.definition); overlay.style.setProperty('--scroll-filter', `url(#${material.id})`)
  parent.append(overlay)
  viewport.classList.add('win-scroll-viewport')
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const listeners = []
  let activePointer = null, repeatTimer = null, frame = null, disposed = false, inputType = 'mouse', disabled = false, lastTheme = null
  let ready = false, currentState = { mode: 'none', expanded: false, reducedMotion: !!reduced?.matches }
  let autoHide = options.autoHide !== false && viewport.dataset.winScrollAutoHide !== 'false'
  const bars = {}
  const state = createScrollIndicatorState({
    autoHide,
    reducedMotion: !!reduced?.matches,
    onChange(next) {
      currentState = next
      overlay.dataset.mode = next.mode
      overlay.dataset.expanded = String(next.expanded)
      overlay.dataset.reduced = String(next.reducedMotion)
      if (ready) refresh()
    },
  })
  function listen(target, type, callback, config) { target.addEventListener(type, callback, config); listeners.push(() => target.removeEventListener(type, callback, config)) }
  function offset(axis) { return axis === 'y' ? viewport.scrollTop : Math.abs(viewport.scrollLeft) }
  function writeOffset(axis, value) {
    const metrics = bars[axis].metrics
    const next = Math.min(metrics.maximum, Math.max(0, value))
    // Setting real offsets intentionally requests no extra smoothing/inertia.
    if (axis === 'y') viewport.scrollTop = next
    else viewport.scrollLeft = window.getComputedStyle(viewport).direction === 'rtl' ? -next : next
    state.activity('mouse'); refresh()
  }
  function stopRepeat() { window.clearTimeout(repeatTimer); repeatTimer = null }
  function cancelPointer() {
    stopRepeat()
    if (activePointer) {
      const old = activePointer; activePointer = null
      old.target.removeAttribute('data-pressed')
      try { old.target.releasePointerCapture?.(old.id) } catch { /* capture can already have been lost */ }
      state.setDragging(false)
    }
  }
  function beginPointer(event, axis, kind, direction = 0) {
    if (disabled || event.button !== 0 || !bars[axis].metrics?.overflow) return
    cancelPointer()
    event.preventDefault() // Prevent text selection only while manipulating a scrollbar.
    const target = event.currentTarget
    activePointer = { id: event.pointerId, axis, kind, direction, target, coordinate: axis === 'y' ? event.clientY : event.clientX, dragValue: offset(axis), withinHit: true }
    target.setAttribute('data-pressed', 'true')
    try { target.setPointerCapture?.(event.pointerId) } catch { /* test/old Qt fallback uses window listeners */ }
    state.pointerOver(true); state.setDragging(true)
    if (kind !== 'thumb') {
      const press = activePointer
      const step = () => {
        if (activePointer !== press || disabled || !press.withinHit) return
        const metrics = bars[axis].metrics
        if (kind === 'page') {
          const bounds = bars[axis].element.getBoundingClientRect()
          const coordinate = press.coordinate - (axis === 'y' ? bounds.top : bounds.left)
          const current = coordinate < metrics.position ? -1 : coordinate > metrics.position + metrics.thumb ? 1 : 0
          if (current !== direction) return // Stop when the moving thumb reaches the pointer.
        }
        const logicalDirection = direction * (axis === 'x' && window.getComputedStyle(viewport).direction === 'rtl' ? -1 : 1)
        writeOffset(axis, offset(axis) + logicalDirection * (kind === 'page' ? (axis === 'y' ? viewport.clientHeight : viewport.clientWidth) : 16))
      }
      step()
      const repeat = () => { if (activePointer !== press) return; step(); repeatTimer = window.setTimeout(repeat, SCROLLBAR.repeatInterval) }
      // WinUI interval is 50ms. Browser cannot read the Windows repeat-delay
      // setting; the host can pass repeatDelay (500ms default, documented).
      repeatTimer = window.setTimeout(repeat, options.repeatDelay ?? 500)
    }
  }
  for (const axis of ['y', 'x']) {
    const bar = node(document, 'div', 'win-scroll-bar'); bar.dataset.axis = axis
    const track = node(document, 'span', 'win-scroll-track')
    track.style.setProperty('--scroll-noise', `url("${acrylicNoise}")`)
    const recipe = node(document, 'span', 'win-scroll-material-recipe')
    recipe.append(node(document, 'span', 'win-scroll-material-noise'))
    track.append(recipe, node(document, 'span', 'win-scroll-material-fallback'))
    const thumb = node(document, 'span', 'win-scroll-thumb')
    bar.append(track, thumb)
    bars[axis] = { element: bar, thumb, track, metrics: null }
    for (const direction of [-1, 1]) {
      const arrow = node(document, 'button', 'win-scroll-arrow'); arrow.type = 'button'; arrow.tabIndex = -1; arrow.dataset.direction = direction
      arrow.setAttribute('aria-hidden', 'true')
      // FontIcon EDDB/EDDC/EDDA/EDD9 fallback triangles. This is not an asserted
      // byte-identical Segoe glyph; its metrics are the source's 8px FontSize.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 8 8')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', axis === 'y' ? direction < 0 ? 'M1 5.5 4 2.5 7 5.5Z' : 'M1 2.5 4 5.5 7 2.5Z' : direction < 0 ? 'M5.5 1 2.5 4 5.5 7Z' : 'M2.5 1 5.5 4 2.5 7Z')
      svg.append(path); arrow.append(svg); bar.append(arrow)
      listen(arrow, 'pointerdown', event => beginPointer(event, axis, 'line', direction))
      listen(arrow, 'click', event => event.preventDefault())
    }
    listen(thumb, 'pointerdown', event => { event.stopPropagation(); beginPointer(event, axis, 'thumb') })
    listen(bar, 'pointerdown', event => {
      if (event.target !== bar && event.target !== track) return
      const bounds = bar.getBoundingClientRect()
      const coordinate = (axis === 'y' ? event.clientY - bounds.top : event.clientX - bounds.left)
      beginPointer(event, axis, 'page', coordinate < bars[axis].metrics.position ? -1 : 1)
    })
    listen(bar, 'pointerenter', event => { if (event.pointerType !== 'touch') state.pointerOver(true) })
    listen(bar, 'pointerleave', event => { if (!overlay.contains(event.relatedTarget)) state.pointerOver(false) })
    overlay.append(bar)
  }
  function refresh() {
    if (disposed) return
    const bounds = viewport.getBoundingClientRect(), parentBounds = parent.getBoundingClientRect()
    const style = window.getComputedStyle(viewport)
    overlay.dir = style.direction === 'rtl' ? 'rtl' : 'ltr'
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    if (lastTheme !== theme) {
      lastTheme = theme
      const recipe = acrylicRecipe({ rgb: theme === 'light' ? [252, 252, 252] : [44, 44, 44], alpha: 255, tintOpacity: theme === 'light' ? 0 : .15 })
      material.update(recipe)
    }
    disabled = viewport.matches(':disabled,[aria-disabled="true"]') || !!viewport.closest('[inert],[aria-disabled="true"]')
    overlay.dataset.disabled = String(disabled)
    overlay.style.setProperty('--scroll-noise-size', `${256 / Math.max(1, window.devicePixelRatio || 1)}px`)
    if (disabled) cancelPointer()
    // A sibling overlay shares the viewport's clipping/stacking ancestors and
    // is not part of its scrollable content, including a teleported popup.
    const scaleX = parentBounds.width && parent.offsetWidth ? parentBounds.width / parent.offsetWidth : 1
    const scaleY = parentBounds.height && parent.offsetHeight ? parentBounds.height / parent.offsetHeight : 1
    setStyle(overlay, 'left', `${(bounds.left - parentBounds.left) / scaleX + parent.scrollLeft - parent.clientLeft + viewport.clientLeft}px`)
    setStyle(overlay, 'top', `${(bounds.top - parentBounds.top) / scaleY + parent.scrollTop - parent.clientTop + viewport.clientTop}px`)
    setStyle(overlay, 'width', `${viewport.clientWidth}px`); setStyle(overlay, 'height', `${viewport.clientHeight}px`)
    setStyle(overlay, 'zIndex', String(Math.max(1, Number.parseInt(style.zIndex) || 0) + 1))
    const allowed = axis => /auto|scroll|overlay/.test(axis === 'y' ? style.overflowY || style.overflow : style.overflowX || style.overflow)
    const overflowY = allowed('y') && viewport.scrollHeight > viewport.clientHeight + .5
    const overflowX = allowed('x') && viewport.scrollWidth > viewport.clientWidth + .5
    const visible = viewport.clientWidth > 0 && viewport.clientHeight > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !viewport.closest('[hidden],[aria-hidden="true"]')
    overlay.hidden = !visible || (!overflowY && !overflowX)
    for (const axis of ['y', 'x']) {
      const vertical = axis === 'y', bar = bars[axis]
      const viewportLength = vertical ? viewport.clientHeight : viewport.clientWidth
      const length = Math.max(0, viewportLength - 2 - ((vertical ? overflowX : overflowY) ? 14 : 0))
      bar.metrics = scrollbarMetrics({ viewport: viewportLength, extent: vertical ? viewport.scrollHeight : viewport.scrollWidth, offset: offset(axis), length, touch: currentState.mode === 'touch' })
      if (!vertical && style.direction === 'rtl') bar.metrics.position = bar.metrics.button + bar.metrics.travel - (bar.metrics.position - bar.metrics.button)
      bar.element.hidden = !(vertical ? overflowY : overflowX) || !bar.metrics.overflow
      setStyle(bar.element, vertical ? 'height' : 'width', `${length}px`)
      if (!vertical) setStyle(bar.element, 'left', `${style.direction === 'rtl' && overflowY ? 15 : 1}px`)
      setStyle(bar.thumb, vertical ? 'height' : 'width', `${bar.metrics.thumb}px`)
      setStyle(bar.thumb, vertical ? 'top' : 'left', `${bar.metrics.position}px`)
    }
    if (overlay.hidden && (currentState.mode !== 'none' || activePointer)) { cancelPointer(); state.reset() }
    else if (!overlay.hidden && !autoHide && currentState.mode === 'none') state.activity('mouse')
    if (activePointer && !bars[activePointer.axis].metrics.overflow) cancelPointer()
  }
  function schedule() { if (disposed || frame !== null) return; frame = window.requestAnimationFrame(() => { frame = null; refresh() }) }
  listen(viewport, 'scroll', () => { state.activity(inputType); schedule() }, { passive: true })
  listen(viewport, 'wheel', () => { inputType = 'mouse'; state.activity('mouse') }, { passive: true })
  listen(viewport, 'pointermove', event => { if (event.pointerType !== 'touch') { inputType = 'mouse'; state.activity('mouse') } }, { passive: true })
  listen(viewport, 'pointerdown', event => { inputType = event.pointerType === 'touch' ? 'touch' : 'mouse' }, { passive: true })
  listen(viewport, 'keydown', event => {
    if (!event.defaultPrevented && !event.target.closest(editable) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) { inputType = 'mouse'; state.activity('mouse') }
    // Do not stop propagation or preventDefault: browser focus/scroll semantics.
  })
  // The overlay is a sibling rather than scroll content. Forward wheel ONLY
  // when directly over its interactive rail; never synthesize momentum.
  listen(overlay, 'wheel', event => {
    if (disabled) return
    const scale = event.deltaMode === 1 ? (Number.parseFloat(window.getComputedStyle(viewport).lineHeight) || 16) : event.deltaMode === 2 ? viewport.clientHeight : 1
    const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * scale
    const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY * scale
    const beforeX = viewport.scrollLeft, beforeY = viewport.scrollTop
    viewport.scrollLeft += dx; viewport.scrollTop += dy
    if (viewport.scrollLeft !== beforeX || viewport.scrollTop !== beforeY) event.preventDefault()
    inputType = 'mouse'; state.activity('mouse'); refresh()
  }, { passive: false })
  listen(window, 'pointermove', event => {
    if (!activePointer || activePointer.id !== event.pointerId) return
    const press = activePointer
    if (press.kind !== 'thumb') {
      const bounds = press.target.getBoundingClientRect()
      press.withinHit = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
      press.coordinate = press.axis === 'y' ? event.clientY : event.clientX
    }
    if (press.kind === 'thumb') {
      const coordinate = press.axis === 'y' ? event.clientY : event.clientX
      const bounds = bars[press.axis].element.getBoundingClientRect()
      const logical = press.axis === 'y' ? bars[press.axis].element.clientHeight : bars[press.axis].element.clientWidth
      const displayed = press.axis === 'y' ? bounds.height : bounds.width
      const scale = logical && displayed ? displayed / logical : 1
      const metrics = bars[press.axis].metrics
      const direction = press.axis === 'x' && window.getComputedStyle(viewport).direction === 'rtl' ? -1 : 1
      // WinUI accumulates raw deltas in m_dragValue, so clipping an overshoot
      // does not lose it, and resizing the track mid-drag causes no jump.
      if (metrics.travel) press.dragValue += (coordinate - press.coordinate) / scale / metrics.travel * metrics.maximum * direction
      press.coordinate = coordinate
      writeOffset(press.axis, press.dragValue)
    }
  })
  const release = event => { if (activePointer && (event.pointerId === undefined || activePointer.id === event.pointerId)) { cancelPointer(); state.pointerOver(!!event.target?.closest?.('.win-scroll-bar')) } }
  listen(window, 'pointerup', release); listen(window, 'pointercancel', release); listen(overlay, 'lostpointercapture', release)
  listen(window, 'blur', () => { cancelPointer(); state.pointerOver(false) })
  listen(window, 'resize', schedule)
  listen(document, 'scroll', schedule, { capture: true, passive: true })
  listen(document, 'visibilitychange', () => { if (document.hidden) { cancelPointer(); state.reset() } else schedule() })
  const mediaChange = () => state.setReducedMotion(!!reduced?.matches)
  reduced?.addEventListener?.('change', mediaChange)
  const observer = window.ResizeObserver ? new window.ResizeObserver(schedule) : null
  observer?.observe(viewport); observer?.observe(parent)
  let observedChildren = new Set()
  function observeChildren() {
    const next = new Set([...viewport.children])
    for (const old of observedChildren) if (!next.has(old)) observer?.unobserve(old)
    for (const child of next) if (!observedChildren.has(child)) observer?.observe(child)
    observedChildren = next
  }
  ready = true; observeChildren(); refresh()
  return {
    overlay, viewport, refresh() { observeChildren(); const nextAutoHide = options.autoHide !== false && viewport.dataset.winScrollAutoHide !== 'false'; if (nextAutoHide !== autoHide) { autoHide = nextAutoHide; state.setAutoHide(autoHide) } refresh() },
    setAutoHide(value) { options.autoHide = value; autoHide = !!value; state.setAutoHide(autoHide) },
    dispose() {
      if (disposed) return
      disposed = true; cancelPointer(); state.dispose(); observer?.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      for (const remove of listeners) remove()
      reduced?.removeEventListener?.('change', mediaChange)
      viewport.classList.remove('win-scroll-viewport'); overlay.remove(); releaseParent()
    },
  }
}

export function installNativeScrollbars(root = document.body, options = {}) {
  const window = root.ownerDocument.defaultView, controllers = new Map()
  let frame = null, disposed = false
  function eligible(element) {
    if (element.nodeType !== 1 || element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || element.matches(editable) || element.closest(ignored)) return false
    const style = window.getComputedStyle(element)
    return /auto|scroll|overlay/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)
  }
  function scan() {
    frame = null
    if (disposed) return
    for (const [element, controller] of controllers) {
      if (!root.contains(element) || !eligible(element) || controller.overlay.parentElement !== element.parentElement) { controller.dispose(); controllers.delete(element) }
      else controller.refresh()
    }
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (controllers.has(element) || !eligible(element)) continue
      const controller = attachNativeScrollbars(element, { ...options })
      if (controller) controllers.set(element, controller)
    }
  }
  function schedule() { if (!disposed && frame === null) frame = window.requestAnimationFrame(scan) }
  const observer = new window.MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.win-scroll-overlay') && !(record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].every(child => child.nodeType === 1 && child.classList.contains('win-scroll-overlay'))))) schedule()
  })
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled', 'data-win-scroll-auto-hide'], characterData: true })
  if (root !== root.ownerDocument.documentElement) observer.observe(root.ownerDocument.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  window.addEventListener('resize', schedule)
  // Animation/transition completion catches retained pages entering/leaving and
  // their final layout without polling all frames or stealing their lifecycle.
  root.addEventListener('transitionend', schedule); root.addEventListener('animationend', schedule)
  scan()
  return {
    refresh: scan,
    dispose() { disposed = true; observer.disconnect(); window.removeEventListener('resize', schedule); root.removeEventListener('transitionend', schedule); root.removeEventListener('animationend', schedule); if (frame !== null) window.cancelAnimationFrame(frame); for (const controller of controllers.values()) controller.dispose(); controllers.clear() },
  }
}
