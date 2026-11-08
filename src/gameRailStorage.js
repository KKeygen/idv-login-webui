export const GAME_RAIL_STORAGE_KEY = 'idv.game-rail.v1'
const GAME_RAIL_SCHEMA_VERSION = 1

function shortGameId(gameId = '') {
  return String(gameId).split('-').pop() || ''
}

export function gameRailTabKey(gameId, distributionId) {
  return `${shortGameId(gameId)}::${String(distributionId)}`
}

function normalizeTab(tab = {}) {
  const gameId = String(tab.game_id || '')
  if (!gameId || tab.distribution_id === undefined || tab.distribution_id === null) return null
  return {
    key: gameRailTabKey(gameId, tab.distribution_id),
    game_id: gameId,
    distribution_id: tab.distribution_id,
  }
}

function normalizeCurrentGame(value) {
  if (!value || typeof value.game_id !== 'string' || !value.game_id) return null
  return { game_id: value.game_id, distribution_id: String(value.distribution_id ?? '') }
}

export function mergeGameRailTabs(existing = [], incoming = []) {
  const result = []
  const seen = new Set()
  for (const value of [...existing, ...incoming]) {
    const tab = normalizeTab(value)
    if (!tab || seen.has(tab.key)) continue
    seen.add(tab.key)
    result.push(tab)
  }
  return result
}

export function readGameRailState(options = {}) {
  const storage = options.storage ?? globalThis.localStorage
  if (!storage) return { tabs: [], last_tab_key: '' }
  try {
    const value = JSON.parse(storage.getItem(GAME_RAIL_STORAGE_KEY) || 'null')
    if (value?.schema_version !== GAME_RAIL_SCHEMA_VERSION) return { tabs: [], last_tab_key: '' }
    const tabs = mergeGameRailTabs([], Array.isArray(value.tabs) ? value.tabs : [])
    const lastTabKey = tabs.some(tab => tab.key === value.last_tab_key) ? value.last_tab_key : ''
    const currentGame = normalizeCurrentGame(value.current_game) || normalizeCurrentGame(tabs.find(tab => tab.key === lastTabKey))
    return { tabs, last_tab_key: lastTabKey, current_game: currentGame }
  } catch {
    return { tabs: [], last_tab_key: '' }
  }
}

export function writeGameRailState(tabs, lastTabKey = '', options = {}) {
  const storage = options.storage ?? globalThis.localStorage
  if (!storage) return false
  const normalized = mergeGameRailTabs([], tabs)
  const remembered = normalized.some(tab => tab.key === lastTabKey) ? lastTabKey : ''
  try {
    storage.setItem(GAME_RAIL_STORAGE_KEY, JSON.stringify({
      schema_version: GAME_RAIL_SCHEMA_VERSION,
      tabs: normalized,
      last_tab_key: remembered,
      current_game: normalizeCurrentGame(options.currentGame) || normalizeCurrentGame(normalized.find(tab => tab.key === remembered)),
    }))
    return true
  } catch {
    return false
  }
}

export function rememberedGameRailTab(tabs = [], lastTabKey = '', games = []) {
  const installedIds = games.map(game => game?.game_id).filter(Boolean)
  return tabs.find(tab => (
    tab.key === lastTabKey
    && installedIds.some(gameId => shortGameId(gameId) === shortGameId(tab.game_id))
  )) || null
}
