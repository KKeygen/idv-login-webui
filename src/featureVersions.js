// The next Fever UI changes ship with the tool's 6.3.3 beta release.
export const FEVER_NEXT_VERSION = '6.3.3-beta'

export function supportsNextFeverFeatures(version) {
  const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(?:beta|rc|stable)(?:[.-]\d+)?)?(?:\+[\w.-]+)?$/i)
  if (!match) return false
  const current = match.slice(1, 4).map(Number)
  const minimum = [6, 3, 3]
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index]
  }
  return true
}
