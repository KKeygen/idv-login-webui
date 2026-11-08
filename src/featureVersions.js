// The next Fever UI changes ship with the tool's 6.3.3 beta release.
export const FEVER_NEXT_VERSION = '6.3.3-beta'

function parseToolVersion(version) {
  if (typeof version !== 'string') return null
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(beta|rc|stable)(?:[.-](\d+))?)?(?:\+[\w.-]+)?$/i)
  if (!match) return null
  const stages = { beta: 0, rc: 1, stable: 2 }
  const parts = [...match.slice(1, 4).map(Number), stages[(match[4] || 'stable').toLowerCase()], Number(match[5] || 0)]
  return parts.every(Number.isSafeInteger) ? parts : null
}

export function versionAtLeast(version, minimumVersion) {
  const current = parseToolVersion(version)
  const minimum = parseToolVersion(minimumVersion)
  if (!current || !minimum) return false
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index]
  }
  return true
}

export function supportsNextFeverFeatures(version) {
  return versionAtLeast(version, FEVER_NEXT_VERSION)
}
