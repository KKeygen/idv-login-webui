/*! Animation data adapted from Microsoft WinUI.
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
// Oracle: microsoft/microsoft-ui-xaml @ ba3b6cd989b4bac7c82791ad76a28d837bbf903b
// src/controls/dev/ProgressRing/{ProgressRing.cpp,ProgressRing.xaml,
//   AnimatedVisuals/ProgressRingIndeterminate.cpp,AnimatedVisuals/ProgressRingDeterminate.cpp}
// src/controls/dev/AnimatedVisualPlayer/AnimatedVisualPlayer.cpp
//
// SVG/Chromium (including Qt WebEngine) renders the source's circle geometry and
// trim values, not Windows Composition pixels: antialiasing/caps may differ.
// The source's cubic controls are (0.166999996,0.166999996),
// (0.833000004,0.833000004). Both lie on y=x, so evaluating that cubic is
// exactly linear, not a guessed spinner easing.
export const PROGRESS_RING_DURATION = 2000
export const PROGRESS_RING_MIN_PLAY = 20
export const PROGRESS_RING_EASING = Object.freeze([0.166999996, 0.166999996, 0.833000004, 0.833000004])
export const PROGRESS_RING_EPSILON = 9.99999975e-5
export const DETERMINATE_VISIBLE_AT = 0.00833333377
export const DETERMINATE_TRIM_FRAMES = Object.freeze([
  [0, PROGRESS_RING_EPSILON],
  [DETERMINATE_VISIBLE_AT, PROGRESS_RING_EPSILON],
  [0.25, 0.25],
  [0.5, 0.5],
  [0.75, 0.75],
  [0.983333349, 0.96666666],
  [0.991666675, 1],
  [1, 1],
].map(Object.freeze))
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0))
export const progressRingValue = value => clamp(value / 100)

export function indeterminateProgressRingFrame(progress) {
  const p = clamp(progress)
  return {
    mode: 'indeterminate', canvas: 80, center: 40, radius: 35, stroke: 7.5,
    rotation: p * 900,
    // Native SpriteShape_1 is the shrinking half, SpriteShape_2 the growing half.
    // HoldThenStep makes the switch exact, with no opacity interpolation.
    arcs: [
      { start: Math.max(0, p - 0.5), end: 0.5, opacity: p < 0.5 ? 0 : 1 },
      { start: 0, end: PROGRESS_RING_EPSILON + (0.5 - PROGRESS_RING_EPSILON) * Math.min(1, p * 2), opacity: p < 0.5 ? 1 : 0 },
    ],
  }
}

export function determinateProgressRingFrame(progress) {
  const p = clamp(progress)
  let end = 1
  for (let i = 1; i < DETERMINATE_TRIM_FRAMES.length; i += 1) {
    const [right, to] = DETERMINATE_TRIM_FRAMES[i]
    if (p <= right) {
      const [left, from] = DETERMINATE_TRIM_FRAMES[i - 1]
      end = from + (to - from) * (p - left) / (right - left)
      break
    }
  }
  return {
    mode: 'determinate', canvas: 32, center: 16,
    radius: 8 * 1.76999998, stroke: 1.5 * 1.76999998, rotation: 0,
    // Native Scale stays zero until the 1/120 keyframe. Its other arc has
    // permanently transparent foreground, so it is omitted from the DOM.
    arcs: [{ start: 0, end, opacity: p < DETERMINATE_VISIBLE_AT ? 0 : 1 }],
  }
}

export function progressRingDash(arc) {
  const length = Math.max(0, arc.end - arc.start) * 100
  return { array: `${length} ${100 - length}`, offset: -arc.start * 100 }
}

/**
 * A small AnimatedVisualPlayer analogue. A newer value interrupts the previous
 * play, but starts from the previous *requested* value (m_oldValue), not the
 * currently painted value. Decreases use SetProgress, never reverse playback.
 * Document/KeepAlive visibility pauses elapsed time; IsActive stops/restarts.
 * Reduced motion is an explicit web accessibility adaptation: a static native
 * half-cycle frame for indeterminate, immediate target for determinate. It is
 * not claimed to be behavior implemented in the native ProgressRing source.
 */
export function createProgressRingMotion({
  render,
  now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id),
  visible = true,
  reduced = false,
}) {
  let state = null
  let oldValue = 0
  let play = null
  let frameId = null
  let version = 0
  let disposed = false
  let paused = !visible
  let reduceMotion = reduced

  function paint(mode, progress) {
    render(mode === 'indeterminate' ? indeterminateProgressRingFrame(progress) : determinateProgressRingFrame(progress))
  }
  function cancel() {
    version += 1
    if (frameId !== null) cancelFrame(frameId)
    frameId = null
  }
  function schedule() {
    if (disposed || paused || !play || frameId !== null) return
    const token = version
    frameId = requestFrame(time => {
      if (disposed || token !== version) return
      frameId = null
      advance(Number.isFinite(time) ? time : now())
      schedule()
    })
  }
  function advance(time) {
    if (!play) return
    const elapsed = Math.max(0, time - play.started) + play.elapsed
    if (play.mode === 'indeterminate') {
      paint(play.mode, (elapsed % PROGRESS_RING_DURATION) / PROGRESS_RING_DURATION)
    } else {
      const progress = Math.min(play.to, play.from + elapsed / PROGRESS_RING_DURATION)
      paint(play.mode, progress)
      if (progress >= play.to) play = null
    }
  }
  function start(mode, from = 0, to = 1) {
    cancel()
    play = null
    if (reduceMotion) {
      paint(mode, mode === 'indeterminate' ? 0.5 : to)
      return
    }
    paint(mode, from)
    // AnimationPlay::Start deliberately jumps to FROM, not TO, below 20 ms.
    if (mode === 'determinate' && (to - from) * PROGRESS_RING_DURATION < PROGRESS_RING_MIN_PLAY) return
    play = { mode, from, to, started: now(), elapsed: 0 }
    schedule()
  }
  function select({ value = Number.NaN, active = true } = {}) {
    if (disposed) return
    const mode = Number.isFinite(value) ? 'determinate' : 'indeterminate'
    const target = progressRingValue(value)
    const previous = state
    if (previous && previous.mode === mode && previous.target === target && previous.active === active) return
    state = { mode, target, active }
    const from = oldValue
    if (mode === 'determinate') oldValue = target
    if (!active) {
      cancel()
      play = null
      paint(mode, mode === 'indeterminate' ? 0 : target)
    } else if (mode === 'indeterminate') {
      start(mode)
    } else if (!previous || !previous.active) {
      // OnApplyTemplate/Loaded applies the determinate value immediately.
      cancel()
      play = null
      paint(mode, target)
    } else if (from < target) {
      start(mode, from, target)
    } else {
      cancel()
      play = null
      paint(mode, target)
    }
  }
  function setVisible(value) {
    if (disposed || paused === !value) return
    const time = now()
    if (!value) {
      advance(time)
      if (play) play.elapsed += Math.max(0, time - play.started)
      paused = true
      cancel()
    } else {
      paused = false
      if (play) play.started = time
      schedule()
    }
  }
  function setReducedMotion(value) {
    if (disposed || reduceMotion === value) return
    reduceMotion = value
    if (!state?.active) return
    if (state.mode === 'indeterminate') start(state.mode)
    else {
      cancel()
      play = null
      paint(state.mode, state.target)
    }
  }
  function dispose() {
    disposed = true
    cancel()
    play = null
  }
  return { select, setVisible, setReducedMotion, dispose }
}
