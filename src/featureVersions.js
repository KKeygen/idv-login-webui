// The next Fever UI changes ship with the tool's 6.3.3 beta release.
export const FEVER_NEXT_VERSION = '6.3.3-beta'
export const ACCOUNT_SWITCHING_VERSION = '6.3.2'
const LAST_NATIVE_SAVE_TOGGLE_VERSION = [6, 3, 0]
const HOTFIX_SETTINGS_VERSION = '6.3.4-stable'
const GAME_IMPORT_ROUTING_VERSION = '6.3.4-stable'
const RELEASE_STAGES = { beta: 0, rc: 1, stable: 2 }

function parseToolVersion(version) {
  if (typeof version !== 'string') return null
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(beta|rc|stable)(?:[.-](\d+))?)?(?:\+[\w.-]+)?$/i)
  if (!match) return null
  const parts = [...match.slice(1, 4).map(Number), RELEASE_STAGES[(match[4] || 'stable').toLowerCase()], Number(match[5] || 0)]
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

function supportsStableFeature(version, minimum) {
  return parseToolVersion(version)?.[3] === RELEASE_STAGES.stable && versionAtLeast(version, minimum)
}

export function supportsStableGameImport(version) {
  return supportsStableFeature(version, GAME_IMPORT_ROUTING_VERSION)
}

export function supportsHotfixSettings(version) {
  return supportsStableFeature(version, HOTFIX_SETTINGS_VERSION)
}

export function supportsAccountSwitching(version) {
  const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i)
  if (!match) return false
  const current = match.slice(1, 4).map(Number)
  const minimum = ACCOUNT_SWITCHING_VERSION.split('.').map(Number)
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index]
  }
  return true
}

export function supportsNativeSaveToggle(version) {
  // Old health responses can omit version. This legacy toggle compares numeric
  // components only, so beta and stable with the same numbers behave alike.
  const match = String(version || '').match(/\d+(?:\.\d+)*/)
  if (!match) return true
  const parts = match[0].split('.').map(Number)
  for (let index = 0; index < Math.max(parts.length, LAST_NATIVE_SAVE_TOGGLE_VERSION.length); index += 1) {
    const current = parts[index] || 0
    const last = LAST_NATIVE_SAVE_TOGGLE_VERSION[index] || 0
    if (current !== last) return current < last
  }
  return true
}

export function supportsAccountChannel(version, requiredVersion) {
  return requiredVersion === undefined || versionAtLeast(version, requiredVersion)
}
