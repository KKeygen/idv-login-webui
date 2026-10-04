import { computed, reactive, readonly } from 'vue'
import { ApiError, request, resolveTask } from '../api'
import { gameRailTabKey, mergeGameRailTabs, readGameRailState, rememberedGameRailTab, writeGameRailState } from '../gameRailStorage'
import { cacheCatalog, cacheLauncherVisual, preloadLauncherImages, readCatalogCache, readLauncherVisual } from '../launcherCache'

const APP_VIEWS = new Set(['launcher', 'accounts', 'settings', 'cloud'])
const persistedRail = readGameRailState()

export function initialViewFromSearch(search = '') {
  const requested = new URLSearchParams(search).get('view') || ''
  return APP_VIEWS.has(requested) ? requested : 'launcher'
}

const state = reactive({
  view: initialViewFromSearch(typeof location === 'undefined' ? '' : location.search),
  games: [], catalog: [], gameId: '', launcher: null, distributionId: '',
  accounts: [], manualChannels: {}, defaultUuid: '', autoClose: false,
  connection: 'checking', updateRequired: false, notices: [], busy: '',
  nativeCapabilities: null,
  backendVersion: '',
  launcherVisual: null,
  railLaunchers: [],
  railTabs: persistedRail.tabs,
  lastRailTabKey: persistedRail.last_tab_key,
  rememberedGame: persistedRail.current_game || null,
})

const launcherRequests = new Map()
const accountRequests = new Map()
const accountDataByGame = new Map()
const ACCOUNT_CACHE_TTL = 30_000
let gamesLoadRequest = null

function gameCacheKey(gameId = '') {
  return shortGameId(gameId)
}

function notify(message, tone = 'info') {
  const id = `${Date.now()}-${Math.random()}`
  state.notices.push({ id, message, tone })
  setTimeout(() => { state.notices = state.notices.filter(item => item.id !== id) }, 5000)
}

export function cmpGameId(a = '', b = '') {
  if (a === b) return true
  const sa = shortGameId(a)
  const sb = shortGameId(b)
  return Boolean(sa && sb && sa === sb)
}

export function shortGameId(gameId = '') {
  return String(gameId).split('-').pop() || ''
}

export function gameTitle(game = {}, fallbackId = '') {
  const id = game.game_id || game.short_game_id || fallbackId
  const short = shortGameId(id)
  const title = [game.launcher?.display_name, game.launcher?.app_name, game.display_name, game.app_name, game.name]
    .find(value => typeof value === 'string' && value.trim() && value !== id && value !== short)
  return title || (short ? `游戏（${short}）` : '游戏启动器')
}

function feverRank(game) { return ['fever', 'fever_display'].includes(game?.platform_type) ? 0 : 1 }

function uniqueGames(games) {
  const seen = new Set()
  return [...games].sort((a, b) => feverRank(a) - feverRank(b)).filter(game => {
    const id = shortGameId(game?.game_id || game?.short_game_id)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function normalizeGames(data = {}) {
  const records = uniqueGames(Array.isArray(data.games) ? data.games : [])
  const catalog = uniqueGames(Array.isArray(data.catalog) ? data.catalog : [])
  const catalogAll = uniqueGames(Array.isArray(data.catalog_all) ? data.catalog_all : catalog)
  const merged = records.map(record => {
    const remote = catalogAll.find(item => cmpGameId(item.game_id, record.game_id)) || {}
    return {
      ...remote,
      ...record,
      launcher: { ...(remote.launcher || {}), ...(record.launcher || {}) },
    }
  })
  for (const item of catalog) if (!merged.some(existing => cmpGameId(existing.game_id, item.game_id))) merged.push(item)
  return { records, catalog, merged: merged.sort((a, b) => feverRank(a) - feverRank(b)) }
}

export function isGameInstalled(game = {}) {
  return Array.isArray(game.installations) && game.installations.some(item => item?.installed)
}

function persistRail() {
  writeGameRailState(state.railTabs, state.lastRailTabKey, { currentGame: state.rememberedGame })
}

function rememberCurrentGame() {
  if (!state.gameId) return
  state.rememberedGame = { game_id: state.gameId, distribution_id: state.distributionId }
  persistRail()
}

function rememberRailTab(gameId, distributionId) {
  const key = gameRailTabKey(gameId, distributionId)
  if (state.railTabs.some(tab => tab.key === key)) state.lastRailTabKey = key
  rememberCurrentGame()
}

function rememberRailLauncher(data) {
  if (!data?.game_id || !Array.isArray(data.distributions)) return
  const existingIndex = state.railLaunchers.findIndex(item => cmpGameId(item.game_id, data.game_id))
  if (existingIndex === -1) state.railLaunchers.push(data)
  else state.railLaunchers.splice(existingIndex, 1, data)

  const game = state.games.find(item => cmpGameId(item.game_id, data.game_id))
  const installed = isGameInstalled(game) || data.distributions.some(item => item.installation?.installed)
  if (!installed) return
  const available = data.distributions
    .filter(item => item.can_download || item.installation?.installed)
    .map(item => ({ game_id: data.game_id, distribution_id: item.distribution_id }))
  const availableKeys = new Set(available.map(tab => gameRailTabKey(tab.game_id, tab.distribution_id)))
  const retained = state.railTabs.filter(tab => (
    !cmpGameId(tab.game_id, data.game_id) || availableKeys.has(tab.key)
  ))
  state.railTabs = mergeGameRailTabs(retained, available)
  if (state.lastRailTabKey && !state.railTabs.some(tab => tab.key === state.lastRailTabKey)) {
    state.lastRailTabKey = ''
  }
  persistRail()
}

function pruneUninstalledRailGames() {
  const installed = state.games.filter(isGameInstalled)
  state.railTabs = state.railTabs.filter(tab => installed.some(game => cmpGameId(game.game_id, tab.game_id)))
  if (state.lastRailTabKey && !state.railTabs.some(tab => tab.key === state.lastRailTabKey)) {
    state.lastRailTabKey = ''
  }
  persistRail()
}

function cachedLauncher(gameId) {
  return state.railLaunchers.find(item => cmpGameId(item.game_id, gameId)) || null
}

function requestLauncher(gameId, { force = false } = {}) {
  const key = gameCacheKey(gameId)
  const cached = cachedLauncher(gameId)
  if (!key) return Promise.resolve(null)
  if (!force && cached) return Promise.resolve(cached)
  if (launcherRequests.has(key)) return launcherRequests.get(key)
  const pending = request('/launcher-status', { query: { game_id: gameId } })
    .then(data => {
      if (data?.success !== false && data?.installation_model_version === 1 && data.game && Array.isArray(data.distributions)) {
        rememberRailLauncher(data)
        cacheLauncherVisual(data)
        preloadLauncherImages(data)
      }
      return data
    })
    .finally(() => launcherRequests.delete(key))
  launcherRequests.set(key, pending)
  return pending
}

async function loadInstalledRail() {
  const missing = state.games.filter(game => isGameInstalled(game) && !cachedLauncher(game.game_id))
  if (!missing.length) return []
  return Promise.allSettled(missing.map(game => requestLauncher(game.game_id)))
}

function hydrateVisualCache() {
  const cached = readCatalogCache()
  if (cached && !state.games.length) {
    const normalized = normalizeGames({ games: [], ...cached })
    state.games = normalized.merged
    state.catalog = normalized.catalog
    preloadLauncherImages(state.games, { limit: 8 })
  }
  if (!state.gameId) {
    const queryId = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('game_id') || ''
    const remembered = state.rememberedGame || state.railTabs.find(tab => tab.key === state.lastRailTabKey)
    state.gameId = queryId || remembered?.game_id || state.games[0]?.game_id || ''
    if (remembered && cmpGameId(remembered.game_id, state.gameId)) state.distributionId = String(remembered.distribution_id ?? '')
  }
  if (state.gameId) {
    const current = state.games.find(item => cmpGameId(item.game_id, state.gameId))
    state.launcherVisual = readLauncherVisual(state.gameId) || current?.launcher || null
    preloadLauncherImages(state.launcherVisual)
  }
}

async function guarded(name, fn, { optional = false } = {}) {
  state.busy = name
  try { return await fn() }
  catch (error) {
    if (optional && error instanceof ApiError && error.status === 404) {
      state.updateRequired = true
      return null
    }
    notify(error.message || '操作失败', 'error')
    throw error
  } finally { if (state.busy === name) state.busy = '' }
}

async function loadGames() {
  hydrateVisualCache()
  if (gamesLoadRequest) return gamesLoadRequest
  gamesLoadRequest = (async () => {
    try {
      const health = await request('/health')
      if (health?.status !== 'ok') throw new Error('启动器后端尚未就绪')
      state.backendVersion = typeof health.version === 'string' ? health.version : ''
      const data = await request('/list-games')
      if (data?.success === false) throw new Error(data.error || '获取游戏列表失败')
      state.connection = 'connected'
      const normalized = normalizeGames(data)
      state.games = normalized.merged
      state.catalog = normalized.catalog
      preloadLauncherImages(state.games, { limit: 8 })
      pruneUninstalledRailGames()
      cacheCatalog(data)
      const queryId = new URLSearchParams(location.search).get('game_id') || ''
      const remembered = state.rememberedGame || rememberedGameRailTab(state.railTabs, state.lastRailTabKey, state.games)
      if (!state.gameId) {
        state.gameId = queryId || remembered?.game_id || normalized.records[0]?.game_id || normalized.merged[0]?.game_id || ''
        if (remembered && cmpGameId(remembered.game_id, state.gameId)) state.distributionId = String(remembered.distribution_id ?? '')
      }
      rememberCurrentGame()
      return data
    } catch (error) {
      state.connection = 'disconnected'
      state.backendVersion = ''
      throw error
    }
  })().finally(() => { gamesLoadRequest = null })
  return gamesLoadRequest
}

async function loadNativeCapabilities() {
  try {
    state.nativeCapabilities = await request('/native/capabilities')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      state.updateRequired = true
      state.nativeCapabilities = null
      return null
    }
    throw error
  }
  return state.nativeCapabilities
}

async function selectGame(gameId, { distributionId = '', view = state.view } = {}) {
  if (!gameId) return null
  if (APP_VIEWS.has(view)) state.view = view
  state.gameId = gameId
  state.distributionId = String(distributionId ?? '')
  rememberCurrentGame()
  state.launcher = cachedLauncher(gameId)
  state.launcherVisual = readLauncherVisual(gameId)
  const cachedAccounts = accountDataByGame.get(gameCacheKey(gameId))
  if (cachedAccounts) applyAccountData(cachedAccounts)
  else applyAccountData()
  const url = new URL(location.href)
  url.searchParams.set('game_id', gameId)
  history.replaceState({}, '', url)
  return ensureViewData(state.view)
}

async function loadLauncher({ force = false } = {}) {
  if (!state.gameId) { state.launcher = null; state.launcherVisual = null; return }
  const gameId = state.gameId
  const current = state.games.find(item => cmpGameId(item.game_id, gameId))
  const cached = cachedLauncher(gameId)
  if (cached) state.launcher = cached
  state.launcherVisual = readLauncherVisual(gameId) || current?.launcher || null
  try {
    const data = await requestLauncher(gameId, { force })
    if (data?.success === false) throw new Error(data.error || '获取启动器信息失败')
    if (data?.installation_model_version !== 1 || !data.game || !Array.isArray(data.distributions)) {
      state.updateRequired = true
      if (cmpGameId(state.gameId, gameId)) state.launcher = null
      return data
    }
    if (!cmpGameId(state.gameId, gameId)) return data
    state.launcher = data
    state.launcherVisual = readLauncherVisual(gameId) || state.launcherVisual
    return data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      state.updateRequired = true
      if (cmpGameId(state.gameId, gameId)) state.launcher = null
      return null
    }
    throw error
  }
}

function applyAccountData(data = {}) {
  state.accounts = data.accounts || []
  state.manualChannels = data.manualChannels || {}
  state.defaultUuid = data.defaultUuid || ''
  state.autoClose = Boolean(data.autoClose)
}

async function loadAccounts({ force = false, gameId = state.gameId } = {}) {
  if (!gameId) { state.accounts = []; return }
  const key = gameCacheKey(gameId)
  const cached = accountDataByGame.get(key)
  if (force && cached) cached.loadedAt = 0
  if (cached && cmpGameId(state.gameId, gameId)) applyAccountData(cached)
  if (!force && cached && Date.now() - cached.loadedAt < ACCOUNT_CACHE_TTL) return cached
  if (accountRequests.has(key)) {
    if (!force) return accountRequests.get(key)
    await accountRequests.get(key).catch(() => {})
    return loadAccounts({ force: true, gameId })
  }

  const pending = Promise.allSettled([
    request('/list', { query: { game_id: gameId } }),
    request('/manualChannels', { query: { game_id: gameId } }),
    request('/defaultChannel', { query: { game_id: shortGameId(gameId) } }),
    request('/get-auto-close-state', { query: { game_id: gameId } }),
  ]).then(([list, manual, def, close]) => {
    if (list.status !== 'fulfilled' || (!Array.isArray(list.value) && !Array.isArray(list.value?.channels))) {
      throw new Error('账号列表读取失败，请确认工具正在运行后重试')
    }
    const previous = accountDataByGame.get(key) || {}
    const incomplete = [manual, def, close].some(result => result.status === 'rejected' || !result.value || result.value.success === false)
    const data = {
      accounts: Array.isArray(list.value) ? list.value : list.value.channels,
      manualChannels: manual.status === 'fulfilled' && manual.value?.success !== false ? (manual.value || {}) : (previous.manualChannels || {}),
      defaultUuid: def.status === 'fulfilled' && def.value?.success !== false ? (def.value?.uuid || '') : (previous.defaultUuid || ''),
      autoClose: close.status === 'fulfilled' && close.value && 'state' in close.value ? Boolean(close.value.state) : Boolean(previous.autoClose),
      loadedAt: incomplete ? 0 : Date.now(),
    }
    accountDataByGame.set(key, data)
    if (cmpGameId(state.gameId, gameId)) applyAccountData(data)
    if (incomplete) throw new Error('账号列表已读取，但部分账号设置刷新失败，请重试')
    return data
  }).finally(() => accountRequests.delete(key))
  accountRequests.set(key, pending)
  return pending
}

async function ensureViewData(view = state.view, options = {}) {
  if (view === 'launcher') return loadLauncher(options)
  if (view === 'accounts') return loadAccounts(options)
  return null
}

async function refreshCurrent({ all = false, force = true } = {}) {
  if (all) return Promise.allSettled([loadLauncher({ force }), loadAccounts({ force })])
  return ensureViewData(state.view, { force })
}

async function selectRailTab(tab) {
  if (!tab?.game_id) return
  state.view = 'launcher'
  const distributionId = String(tab.distribution_id)
  if (!cmpGameId(tab.game_id, state.gameId)) {
    rememberRailTab(tab.game_id, tab.distribution_id)
    return selectGame(tab.game_id, { distributionId, view: 'launcher' })
  }
  state.distributionId = distributionId
  rememberRailTab(tab.game_id, tab.distribution_id)
  return ensureViewData('launcher')
}

async function mutate(name, path, options = {}, {
  taskPath,
  reload = true,
  optional = false,
  startMessage = '',
  successMessage = '操作完成',
} = {}) {
  return guarded(name, async () => {
    if (startMessage) notify(startMessage)
    let result = await request(path, options)
    if (taskPath) result = await resolveTask(result, taskPath)
    if (result?.success === false) throw new Error(result.error || '操作失败')
    if (reload) await refreshCurrent()
    if (successMessage) notify(successMessage, 'success')
    return result
  }, { optional })
}

export function useAppStore() {
  return {
    state: readonly(state),
    currentGame: computed(() => state.games.find(item => cmpGameId(item.game_id, state.gameId)) || null),
    notify, guarded, loadGames, loadNativeCapabilities, loadInstalledRail, loadLauncher, loadAccounts, ensureViewData, refreshCurrent, selectGame, selectRailTab, mutate,
    setView: view => {
      if (!APP_VIEWS.has(view)) return Promise.resolve(null)
      state.view = view
      return ensureViewData(view).catch(error => {
        notify(error.message || '页面加载失败', 'error')
        return null
      })
    },
    setDistribution: id => {
      state.distributionId = String(id ?? '')
      if (state.gameId && state.distributionId !== '') rememberRailTab(state.gameId, state.distributionId)
    },
    setAutoClose: value => { state.autoClose = Boolean(value) },
    markUpdateRequired: () => { state.updateRequired = true },
  }
}
