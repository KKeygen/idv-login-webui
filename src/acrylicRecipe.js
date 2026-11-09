/*! Acrylic recipe adapted from Microsoft WinUI AcrylicBrush.cpp.
 * Source: microsoft/microsoft-ui-xaml @ ba3b6cd989b4bac7c82791ad76a28d837bbf903b
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
const clamp = (x, low, high) => Math.min(high, Math.max(low, x))
export function acrylicRecipe({ rgb = [28, 28, 28], alpha = 179, tintOpacity = .6, luminosityOpacity = null } = {}) {
  const maximum = Math.max(...rgb) / 255, minimum = Math.min(...rgb) / 255
  const saturation = maximum ? (maximum - minimum) / maximum : 0
  const lowOpacity = maximum > .5 ? .45 : .85
  const suppression = (.9 - lowOpacity) * Math.max(1 - saturation * 2, 0) * Math.abs(maximum - .5) / .5
  const tintAlpha = Math.round(alpha * tintOpacity * (luminosityOpacity === null ? .9 - suppression : 1)) / 255
  const unmodifiedAlpha = Math.round(alpha * tintOpacity) / 255
  const luminosityAlpha = luminosityOpacity === null ? Math.min(unmodifiedAlpha * .88 + .15, 1) : clamp(luminosityOpacity, 0, 1)
  const value = clamp(maximum, .125, .965)
  const luminosityRgb = luminosityOpacity === null ? rgb.map(channel => Math.round(maximum ? channel * value / maximum : value * 255)) : rgb
  return { tint: [...rgb, tintAlpha], luminosity: [...luminosityRgb, Math.round(luminosityAlpha * 255) / 255], blur: 30, noiseOpacity: .02 }
}
export const rgba = ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`
