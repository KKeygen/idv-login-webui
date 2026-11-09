/*! Microsoft WinUI ScrollBar geometry and indicator state adaptation.
 * Source: microsoft/microsoft-ui-xaml @ ba3b6cd989b4bac7c82791ad76a28d837bbf903b
 * Browser input and Windows compositor rendering remain distinct.
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
export const SCROLLBAR = Object.freeze({ size: 12, margin: 1, collapsed: 8, stroke: 6, offset: 2, minThumb: 30, touchMinThumb: 32, expandDelay: 400, contractDelay: 500, geometryDuration: 167, opacityDuration: 83, mouseHide: 2000, touchHide: 500, repeatInterval: 50 })
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

export function scrollbarMetrics({ viewport, extent, offset = 0, length = viewport, touch = false }) {
  viewport = Math.max(0, Number(viewport) || 0)
  extent = Math.max(viewport, Number(extent) || 0)
  length = Math.max(0, Number(length) || 0)
  const maximum = extent - viewport
  const button = touch ? 0 : Math.min(SCROLLBAR.size, length / 2)
  const track = Math.max(0, length - button * 2)
  const thumb = Math.min(track, Math.max(touch ? SCROLLBAR.touchMinThumb : SCROLLBAR.minThumb, extent ? track * viewport / extent : track))
  const travel = Math.max(0, track - thumb)
  const value = clamp(Number(offset) || 0, 0, maximum)
  return { maximum, button, track, thumb, travel, value, position: button + (maximum ? travel * value / maximum : 0), overflow: maximum > .5 && viewport > 0 && length > 0 }
}

export function scrollbarDragOffset(initial, delta, metrics) {
  return metrics.travel > 0 ? clamp(initial + delta / metrics.travel * metrics.maximum, 0, metrics.maximum) : metrics.value
}

// Keep the hide timer independent from the expansion timer. Repeated scrolling
// must reset the former without postponing a pointer already hovering the rail.
export function createScrollIndicatorState({ onChange, autoHide = true, reducedMotion = false, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let mode = 'none', expanded = !autoHide, hover = false, dragging = false, disposed = false
  let hideTimer = null, geometryTimer = null
  const state = () => ({ mode, expanded, hover, dragging, reducedMotion })
  const emit = () => { if (!disposed) onChange?.(state()) }
  function clearHide() { clearTimer(hideTimer); hideTimer = null }
  function clearGeometry() { clearTimer(geometryTimer); geometryTimer = null }
  function hideLater() {
    clearHide()
    if (!autoHide || hover || dragging || mode === 'none') return
    hideTimer = setTimer(() => { hideTimer = null; mode = 'none'; expanded = false; clearGeometry(); emit() }, mode === 'touch' ? SCROLLBAR.touchHide : SCROLLBAR.mouseHide)
  }
  function activity(input = 'mouse') {
    if (disposed) return
    // Native ShowIndicators: an already visible mouse indicator dominates touch.
    mode = !autoHide || input !== 'touch' || mode === 'mouse' ? 'mouse' : 'touch'
    if (!autoHide) expanded = true
    hideLater(); emit()
  }
  function pointerOver(value) {
    if (disposed || hover === value) return
    hover = value
    clearGeometry()
    if (hover) {
      activity('mouse')
      if (!expanded) geometryTimer = setTimer(() => { geometryTimer = null; expanded = true; emit() }, SCROLLBAR.expandDelay)
    } else {
      if (!dragging && autoHide && expanded) geometryTimer = setTimer(() => { geometryTimer = null; expanded = false; emit() }, SCROLLBAR.contractDelay)
      hideLater(); emit()
    }
  }
  function setDragging(value) {
    dragging = value
    if (value) { activity('mouse') }
    else { if (!hover && autoHide && expanded) geometryTimer = setTimer(() => { geometryTimer = null; expanded = false; emit() }, SCROLLBAR.contractDelay); hideLater(); emit() }
  }
  return {
    activity, pointerOver, setDragging, state,
    setReducedMotion(value) { reducedMotion = !!value; emit() },
    setAutoHide(value) { autoHide = !!value; clearGeometry(); if (!autoHide) { expanded = true; activity('mouse') } else { expanded = hover || dragging; hideLater(); emit() } },
    reset() { clearHide(); clearGeometry(); mode = 'none'; expanded = !autoHide; hover = dragging = false; emit() },
    dispose() { disposed = true; clearHide(); clearGeometry() },
  }
}
