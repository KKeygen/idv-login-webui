/*! Geometry adapted from Microsoft's AnimatedSettingsVisualSource.cpp:
 * https://github.com/microsoft/microsoft-ui-xaml/blob/ba3b6cd989b4bac7c82791ad76a28d837bbf903b/src/controls/dev/AnimatedIcon/AnimatedVisuals/AnimatedSettingsVisualSource.cpp
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
export const SETTINGS_ICON_PATH = "M48.88 30.981 C49.199 29.996 49.723 29.092 50.416 28.325 C50.533 28.195 50.717 28.149 50.881 28.208 L52.536 28.799 C52.985 28.959 53.479 28.726 53.639 28.277 C53.655 28.233 53.667 28.188 53.675 28.142 L53.99 26.411 C54.021 26.239 54.154 26.102 54.325 26.066 C54.826 25.959 55.339 25.906 55.859 25.906 C56.379 25.906 56.892 25.96 57.392 26.066 C57.563 26.102 57.695 26.239 57.726 26.411 L58.042 28.142 C58.128 28.611 58.577 28.921 59.046 28.836 C59.092 28.828 59.137 28.815 59.181 28.799 L60.836 28.208 C61 28.149 61.185 28.195 61.302 28.325 C61.995 29.092 62.519 29.996 62.838 30.981 C62.892 31.147 62.839 31.33 62.706 31.443 L61.365 32.581 C61.002 32.889 60.958 33.435 61.266 33.798 C61.296 33.834 61.329 33.867 61.365 33.897 L62.706 35.036 C62.839 35.149 62.892 35.331 62.838 35.497 C62.519 36.482 61.995 37.387 61.302 38.154 C61.185 38.284 61 38.33 60.836 38.271 L59.181 37.679 C58.732 37.519 58.239 37.752 58.079 38.201 C58.063 38.245 58.05 38.291 58.042 38.337 L57.726 40.068 C57.695 40.24 57.563 40.376 57.392 40.412 C56.892 40.518 56.379 40.573 55.859 40.573 C55.339 40.573 54.826 40.519 54.325 40.412 C54.154 40.376 54.021 40.239 53.99 40.067 L53.675 38.337 C53.59 37.868 53.141 37.557 52.672 37.643 C52.626 37.651 52.58 37.663 52.536 37.679 L50.881 38.271 C50.717 38.33 50.533 38.284 50.416 38.154 C49.723 37.387 49.199 36.482 48.88 35.497 C48.826 35.331 48.878 35.149 49.011 35.036 L50.352 33.897 C50.715 33.589 50.76 33.044 50.452 32.681 C50.422 32.645 50.388 32.611 50.352 32.581 L49.011 31.443 C48.878 31.33 48.826 31.147 48.88 30.981 Z M49.795 30.976 L50.911 31.924 C50.982 31.985 51.048 32.051 51.109 32.122 C51.726 32.848 51.637 33.937 50.911 34.554 L49.795 35.502 C50.047 36.177 50.41 36.804 50.869 37.359 L52.246 36.867 C52.334 36.835 52.425 36.811 52.517 36.794 C53.455 36.623 54.353 37.244 54.524 38.182 L54.786 39.621 C55.138 39.68 55.497 39.71 55.859 39.71 C56.221 39.71 56.579 39.68 56.931 39.621 L57.194 38.182 C57.211 38.09 57.234 37.999 57.266 37.911 C57.587 37.014 58.574 36.546 59.472 36.867 L60.849 37.359 C61.307 36.804 61.671 36.177 61.923 35.502 L60.807 34.554 C60.736 34.493 60.669 34.427 60.608 34.356 C59.991 33.63 60.081 32.541 60.807 31.924 L61.923 30.976 C61.671 30.301 61.307 29.674 60.849 29.119 L59.472 29.612 C59.384 29.644 59.293 29.667 59.201 29.684 C58.264 29.855 57.365 29.234 57.194 28.297 L56.931 26.857 C56.579 26.798 56.221 26.768 55.859 26.768 C55.497 26.768 55.138 26.798 54.786 26.857 L54.524 28.296 C54.507 28.388 54.483 28.48 54.451 28.568 C54.13 29.465 53.143 29.933 52.246 29.612 L50.869 29.119 C50.41 29.674 50.047 30.301 49.795 30.976 Z M53.702 33.239 C53.702 32.048 54.668 31.082 55.859 31.082 C57.05 31.082 58.016 32.048 58.016 33.239 C58.016 34.43 57.05 35.396 55.859 35.396 C54.668 35.396 53.702 34.43 53.702 33.239 Z M54.565 33.239 C54.565 33.954 55.144 34.533 55.859 34.533 C56.574 34.533 57.153 33.954 57.153 33.239 C57.153 32.524 56.574 31.945 55.859 31.945 C55.144 31.945 54.565 32.524 54.565 33.239 Z"
export const SETTINGS_ICON_TRANSFORM = 'translate(24 24) scale(3) translate(-55.859 -33.239)'

export function settingsIconState(state) {
  const normalized = String(state ?? '').toLowerCase()
  if (normalized === 'pressed') return 'Pressed'
  if (normalized === 'pointerover' || normalized === 'hover' || normalized === 'focus') return 'PointerOver'
  if (normalized === 'disabled') return 'Disabled'
  return 'Normal'
}

export function settingsIconTransition(from, to) {
  from = settingsIconState(from)
  to = settingsIconState(to)
  if (from === to || to === 'Disabled') return null
  // AnimatedSettings is 120 frames at 60fps. Hover is a static segment, NOT
  // a 45-degree rotation. Press winds back 20deg in 9 frames; release spins
  // forward to 360deg in 39 frames with the asset's (0,0,0,1) easing.
  return {
    frames: from === 'Pressed'
      ? [{ transform: 'rotate(-20deg)' }, { transform: 'rotate(360deg)' }]
      : [{ transform: 'rotate(0deg)' }, { transform: `rotate(${to === 'Pressed' ? -20 : 0}deg)` }],
    options: {
      duration: from === 'Pressed' ? 650 : 150,
      easing: from === 'Pressed' ? 'cubic-bezier(0, 0, 0, 1)' : 'linear',
      fill: 'both',
    },
  }
}

/** AnimatedIcon's default QueueOne strategy, bounded at its source limit 4.
 * On overflow the oldest pending transition replaces the active transition.
 * Repeated states and stale animation callbacks cannot restart or corrupt it.
 */
export function createSettingsIconMotion({ element, reducedMotion = () => false }) {
  let current = 'Normal'
  let animation = null
  let queue = []
  let disposed = false
  const angle = state => state === 'Pressed' ? -20 : 0
  function cancel() {
    const previous = animation
    animation = null
    if (previous) {
      previous.onfinish = null
      previous.oncancel = null
      previous.cancel()
    }
  }
  function settle() {
    if (element?.style) element.style.transform = `rotate(${angle(current)}deg)`
  }
  function start(target) {
    const transition = settingsIconTransition(current, target)
    current = target
    cancel()
    settle()
    if (!transition || reducedMotion() || !element?.animate) return
    try {
      animation = element.animate(transition.frames, transition.options)
      const playing = animation
      playing.onfinish = playing.oncancel = () => {
        if (animation !== playing) return
        cancel()
        settle()
        if (queue.length) start(queue.shift())
      }
    } catch {
      cancel()
      settle()
      if (queue.length) start(queue.shift())
    }
  }
  return {
    select(state, { immediate = false } = {}) {
      if (disposed) return
      state = settingsIconState(state)
      if (immediate || state === 'Disabled' || reducedMotion()) {
        queue = []
        cancel()
        current = state
        settle()
        return
      }
      if (state === (queue.at(-1) ?? current)) return
      if (animation) {
        if (queue.length >= 4) start(queue.shift())
        if (animation) queue.push(state)
        else start(state)
      } else start(state)
    },
    dispose() {
      queue = []
      cancel()
      current = 'Normal'
      settle()
      disposed = true
    },
  }
}
