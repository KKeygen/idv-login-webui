/*! Geometry adapted from Microsoft's AnimatedChevronUpDownSmallVisualSource.cpp:
 * https://github.com/microsoft/microsoft-ui-xaml/blob/ba3b6cd989b4bac7c82791ad76a28d837bbf903b/src/controls/dev/AnimatedIcon/AnimatedVisuals/AnimatedChevronUpDownSmallVisualSource.cpp
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
// Native 48×48 composition geometry, rendered at the 12px Expander glyph size.
export const EXPANDER_CHEVRON_PATH = 'M -3.543 -1.793 L .02 1.707 L 3.489 -1.715'
export const CHEVRON_ROTATION = [[0,180.0,"step"],[15,180.0,"hold"],[25,0.0,0],[30,180.0,"hold"],[40,180.0,"hold"],[50,0.0,"hold"],[65,0.0,"hold"],[75,180.0,0],[80,0.0,"hold"],[90,0.0,"hold"],[100,180.0,"hold"],[109,0.0,0],[110,180.0,"hold"],[120,180.0,"hold"],[130,0.0,"hold"],[139,180.0,0],[140,0.0,"hold"],[150,0.0,"hold"],[160,180.0,"hold"],[169,0.0,0],[170,180.0,"hold"],[175,180.0,"hold"],[185,0.0,0],[190,180.0,"hold"],[195,180.0,"hold"],[205,0.0,0],[210,0.0,"hold"],[219,180.0,0],[220,0.0,"hold"],[225,0.0,"hold"],[235,180.0,0],[240,0.0,"hold"],[245,0.0,"hold"],[255,180.0,0]]
export const CHEVRON_OFFSET = [[0,[24.0,24.0],"hold"],[10,[24.0,26.0],0],[15,[24.0,18.0],1],[29,[24.1709995,23.9230003],2],[30,[24.0,24.0],"hold"],[40,[24.0,24.0],"hold"],[49,[24.0,26.0],0],[50,[24.0,24.0],"hold"],[60,[24.0,22.0],0],[65,[24.0,30.0],3],[79,[24.0,24.0],2],[90,[24.0,24.0],"hold"],[99,[24.0,22.0],0],[100,[24.0,24.0],"hold"],[120,[24.0,24.0],"hold"],[129,[24.0,26.0],0],[130,[24.0,24.0],"hold"],[150,[24.0,24.0],"hold"],[159,[24.0,22.0],0],[160,[24.0,26.0],"hold"],[169,[24.0,22.0],0],[170,[24.0,26.0],"hold"],[175,[24.0,18.0],1],[189,[24.1709995,23.9230003],2],[190,[24.0,26.0],"hold"],[195,[24.0,18.0],1],[209,[24.1709995,23.9230003],2],[210,[24.0,22.0],"hold"],[219,[24.0,26.0],0],[220,[24.0,22.0],"hold"],[225,[24.0,30.0],3],[239,[24.0,24.0],2],[240,[24.0,22.0],"hold"],[245,[24.0,30.0],3],[259,[24.0,24.0],2]]
export const CHEVRON_SEGMENTS = {"NormalOnToNormalOff":[0.0,29.05],"NormalOnToPointerOverOn":[30.05,39.05],"NormalOnToPressedOn":[40.05,49.05],"NormalOffToNormalOn":[50.05,79.05],"NormalOffToPointerOverOff":[80.05,89.05],"NormalOffToPressedOff":[90.05,99.05],"PointerOverOnToPointerOverOff":[100.05,109.05],"PointerOverOnToNormalOn":[110.05,119.05],"PointerOverOnToPressedOn":[120.05,129.05],"PointerOverOffToPointerOverOn":[130.05,139.05],"PointerOverOffToNormalOff":[140.05,149.05],"PointerOverOffToPressedOff":[150.05,159.05],"PressedOnToPressedOff":[160.05,169.05],"PressedOnToPointerOverOff":[170.05,189.05],"PressedOnToNormalOff":[190.05,209.05],"PressedOffToPressedOn":[210.05,219.05],"PressedOffToPointerOverOn":[220.05,239.05],"PressedOffToNormalOn":[240.05,259.05]}
export const CHEVRON_CURVES = [[.167,.167,0,1],[.85,0,.75,1],[.35,0,0,1],[.85,0,.45,1]]

function bezier(progress, curve) {
  const [x1, y1, x2, y2] = curve
  const value = (t, a, b) => 3 * (1-t) * (1-t) * t * a + 3 * (1-t) * t * t * b + t * t * t
  let lower = 0, upper = 1
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (lower + upper) / 2
    if (value(mid, x1, x2) < progress) lower = mid
    else upper = mid
  }
  return value((lower + upper) / 2, y1, y2)
}
function sample(track, frame) {
  if (frame <= track[0][0]) return track[0][1]
  for (let index = 1; index < track.length; index += 1) {
    const [end, to, curve] = track[index]
    if (frame > end) continue
    const [start, from] = track[index - 1]
    const progress = (frame - start) / (end - start)
    const t = curve === 'hold' ? (progress < 1 ? 0 : 1) : curve === 'step' ? 1 : bezier(progress, CHEVRON_CURVES[curve])
    return Array.isArray(to) ? to.map((value, coordinate) => from[coordinate] + (value - from[coordinate]) * t) : from + (to - from) * t
  }
  return track.at(-1)[1]
}
export function chevronFrame(frame) {
  const [x, y] = sample(CHEVRON_OFFSET, frame)
  return { x, y, rotation: sample(CHEVRON_ROTATION, frame) }
}
export function chevronState({ expanded, direction = 'down', hovered = false, pressed = false, disabled = false }) {
  const on = direction === 'down' ? expanded : !expanded
  return `${!disabled && pressed ? 'Pressed' : !disabled && hovered ? 'PointerOver' : 'Normal'}${on ? 'On' : 'Off'}`
}
function endFrame(state) {
  // AnimatedIcon.cpp's fallback searches the ordered marker map for ToSTATE_End.
  const marker = Object.keys(CHEVRON_SEGMENTS).sort().find(key => key.endsWith(`To${state}`))
  return marker ? CHEVRON_SEGMENTS[marker][1] : 0
}
export function createExpanderChevronMotion(element, reduced = () => false) {
  let current = 'NormalOff'
  let running = null
  let frameId = 0
  let queue = []
  let disposed = false
  function paint(frame) {
    const { x, y, rotation } = chevronFrame(frame)
    element?.setAttribute('transform', `translate(${x} ${y}) rotate(${rotation}) scale(4)`)
  }
  function stop() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; running = null }
  function start(target) {
    const segment = CHEVRON_SEGMENTS[`${current}To${target}`]
    current = target
    stop()
    if (!segment || reduced()) { paint(endFrame(target)); if (queue.length) start(queue.shift()); return }
    const [from, to] = segment
    const duration = (to - from) / 260 * 4333.3333
    running = { from, to, start: performance.now(), duration }
    paint(from)
    frameId = requestAnimationFrame(tick)
  }
  function tick(now) {
    frameId = 0
    if (!running || disposed) return
    const t = Math.min(1, Math.max(0, (now - running.start) / running.duration))
    paint(running.from + (running.to - running.from) * t)
    if (t < 1) frameId = requestAnimationFrame(tick)
    else { running = null; if (queue.length) start(queue.shift()) }
  }
  return {
    select(target, immediate = false) {
      if (disposed) return
      if (immediate || reduced()) { queue = []; stop(); current = target; paint(endFrame(target)); return }
      if (target === (queue.at(-1) || current)) return
      if (running) {
        if (queue.length >= 4) start(queue.shift())
        queue.push(target)
      } else start(target)
    },
    dispose() { disposed = true; queue = []; stop() },
  }
}
