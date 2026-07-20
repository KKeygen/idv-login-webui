import { computed, reactive, readonly } from 'vue'
import { ApiError, request, resolveTask } from '../api'

const state = reactive({
  view: 'launcher', games: [], catalog: [], gameId: '', launcher: null, distributionId: '',
  accounts: [], manualChannels: {}, defaultUuid: '', autoClose: false,
  connection: 'checking', updateRequired: false, notices: [], busy: '',
  nativeCapabilities: null,
})

function notify(message, tone = 'info') {
  const id = `${Date.now()}-${Math.random()}`
  state.notices.push({ id, message, tone })
  setTimeout(() => { state.notices = state.notices.filter(item => item.id !== id) }, 5000)
}

export function cmpGameId(a = '', b = '') {
  if (a === b) return true
  const sa = String(a).split('-').pop()
  const sb = String(b).split('-').pop()
  return Boolean(sa && sb && sa === sb)
}

export function normalizeGames(data = {}) {
  const records = Array.isArray(data.games) ? data.games : []
  const catalog = Array.isArray(data.catalog) ? data.catalog : []
  const catalogAll = Array.isArray(data.catalog_all) ? data.catalog_all : catalog
  const merged = records.map(record => {
    const remote = catalogAll.find(item => cmpGameId(item.game_id, record.game_id)) || {}
    return {
      ...remote,
      ...record,
      launcher: { ...(remote.launcher || {}), ...(record.launcher || {}) },
    }
  })
  for (const item of catalog) if (!merged.some(existing => cmpGameId(existing.game_id, item.game_id))) merged.push(item)
  return { records, catalog, merged }
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
  try {
    const previousGameId = state.gameId
    const data = await request('/list-games')
    if (data?.success === false) throw new Error(data.error || '获取游戏列表失败')
    state.connection = 'connected'
    const normalized = normalizeGames(data)
    state.games = normalized.merged
    state.catalog = normalized.catalog
    const queryId = new URLSearchParams(location.search).get('game_id') || ''
    if (!state.gameId) state.gameId = queryId || normalized.records[0]?.game_id || normalized.merged[0]?.game_id || ''
    if (!previousGameId && state.gameId) queueMicrotask(() => refreshCurrent())
  } catch (error) {
    state.connection = 'disconnected'
    throw error
  }
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

async function selectGame(gameId) {
  state.gameId = gameId
  const url = new URL(location.href)
  if (gameId) url.searchParams.set('game_id', gameId)
  history.replaceState({}, '', url)
  await refreshCurrent()
}

async function loadLauncher() {
  if (!state.gameId) { state.launcher = null; return }
  try {
    const data = await request('/launcher-status', { query: { game_id: state.gameId } })
    if (data?.success === false) throw new Error(data.error || '获取启动器信息失败')
    if (data?.installation_model_version !== 1 || !data.game || !Array.isArray(data.game.installations) || !Array.isArray(data.distributions)) {
      state.updateRequired = true
      state.launcher = null
      return
    }
    state.launcher = data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      state.updateRequired = true
      state.launcher = null
      return
    }
    throw error
  }
}

async function loadAccounts() {
  if (!state.gameId) { state.accounts = []; return }
  const [list, manual, def, close] = await Promise.allSettled([
    request('/list', { query: { game_id: state.gameId } }),
    request('/manualChannels', { query: { game_id: state.gameId } }),
    request('/defaultChannel', { query: { game_id: state.gameId } }),
    request('/get-auto-close-state', { query: { game_id: state.gameId } }),
  ])
  if (list.status === 'fulfilled') state.accounts = Array.isArray(list.value) ? list.value : (list.value.channels || [])
  if (manual.status === 'fulfilled') state.manualChannels = manual.value || {}
  if (def.status === 'fulfilled') state.defaultUuid = def.value.uuid || ''
  if (close.status === 'fulfilled' && 'state' in close.value) state.autoClose = Boolean(close.value.state)
}

async function refreshCurrent() {
  await Promise.allSettled([loadLauncher(), loadAccounts()])
}

async function mutate(name, path, options = {}, { taskPath, reload = true, optional = false } = {}) {
  return guarded(name, async () => {
    let result = await request(path, options)
    if (taskPath) result = await resolveTask(result, taskPath)
    if (result?.success === false) throw new Error(result.error || '操作失败')
    if (reload) await refreshCurrent()
    notify('操作完成', 'success')
    return result
  }, { optional })
}

export function useAppStore() {
  return {
    state: readonly(state),
    currentGame: computed(() => state.games.find(item => cmpGameId(item.game_id, state.gameId)) || null),
    notify, guarded, loadGames, loadNativeCapabilities, loadLauncher, loadAccounts, refreshCurrent, selectGame, mutate,
    setView: view => { state.view = view },
    setDistribution: id => { state.distributionId = String(id ?? '') },
    setAutoClose: value => { state.autoClose = Boolean(value) },
    markUpdateRequired: () => { state.updateRequired = true },
    setLauncher: launcher => { state.launcher = launcher },
  }
}
