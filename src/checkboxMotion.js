/*! Geometry and timing adapted from Microsoft's AnimatedAcceptVisualSource.cpp:
 * https://github.com/microsoft/microsoft-ui-xaml/blob/ba3b6cd989b4bac7c82791ad76a28d837bbf903b/src/controls/dev/AnimatedIcon/AnimatedVisuals/AnimatedAcceptVisualSource.cpp
 *
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
export const CHECKBOX_CHECK_PATH = 'M-15.172 .016 L-5 10.188 L15.337 -10.337'
export const CHECKBOX_MIXED_PATH = 'M-11.75 -.125 L11.875 -.125'
// 48x48 visual: translated 24,24, scaled 1.05, inner translated -24,-24,
// then path translated 24,23 and scaled .7. Indeterminate uses 24,24.
export const CHECKBOX_CHECK_TRANSFORM = 'matrix(.735 0 0 .735 24 22.95)'
export const CHECKBOX_MIXED_TRANSFORM = 'matrix(.735 0 0 .735 24 24)'

export function checkboxCheckAnimation(checked, pressed = false) {
  // TrimEnd: 19 frames, or 9 while staying pressed. TrimStart: 4 frames.
  // The generated source is 160 frames at 60fps; other state changes are
  // static geometry or brushes, not an invented icon scale/bounce.
  return {
    frames: checked
      ? [{ strokeDashoffset: '1', opacity: 1 }, { strokeDashoffset: '0', opacity: 1 }]
      : [{ strokeDashoffset: '0', opacity: 1 }, { strokeDashoffset: '-1', opacity: 1 }],
    options: {
      duration: (checked ? pressed ? 9 : 19 : 4) * 1000 / 60,
      easing: checked ? 'cubic-bezier(0.55, 0, 0, 1)' : 'linear',
      fill: 'both',
    },
  }
}
