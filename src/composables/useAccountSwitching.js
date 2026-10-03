import { computed, reactive, readonly } from 'vue'
import { ApiError, request } from '../api'
import { normalizeSwitchingConfig, supportsAccountSwitching } from '../accountSwitching'
import { useAppStore } from './useAppStore'

const state = reactive({ open: false, loading: false, saving: false, loaded: false, unavailable: false, error: '', config: normalizeSwitchingConfig(), games: [] })
let pendingLoad = null
let pendingAcknowledgement = null
let loadGeneration = 0

export function useAccountSwitching() {
  const app = useAppStore()
  const supported = computed(() => supportsAccountSwitching(app.state.backendVersion) && !state.unavailable)

  async function load({ force = false } = {}) {
    if (!supported.value) return null
    if (pendingLoad) return pendingLoad
    if (state.loaded && !force) return state
    const generation = ++loadGeneration
    state.loading = true
    state.loaded = false
    state.error = ''
    pendingLoad = (async () => {
      try {
        const data = await request('/account-list-config')
        if (generation !== loadGeneration || !supported.value) return null
        if (data?.success === false) throw new Error(data.error || '无法读取游戏内切换设置')
        if (!data?.config || !Array.isArray(data.games)) throw new Error('游戏内切换设置数据不完整，请重试')
        state.config = normalizeSwitchingConfig(data.config)
        state.games = data.games.filter(game => game?.local_game_id).map(game => ({ ...game, accounts: Array.isArray(game.accounts) ? game.accounts : [] }))
        state.loaded = true
        return state
      } catch (error) {
        if (generation !== loadGeneration || !supported.value) return null
        if (error instanceof ApiError && error.status === 404) {
          state.unavailable = true
          state.open = false
          app.markUpdateRequired()
        }
        state.error = error.message || '无法读取游戏内切换设置'
        // Log only a status, never account metadata or backend response bodies.
        console.warn('[account-switching] Configuration unavailable', { status: error.status || 'network' })
        return null
      } finally {
        if (generation === loadGeneration) { state.loading = false; pendingLoad = null }
      }
    })()
    return pendingLoad
  }

  async function openWizard() {
    if (!supported.value || state.saving) return
    state.open = true
    await load({ force: true })
  }

  async function persistConfig(config) {
    if (!supported.value || state.saving) return false
    const generation = loadGeneration
    state.saving = true
    state.error = ''
    try {
      const data = await request('/account-list-config', { method: 'POST', body: { config } })
      if (data?.success === false) throw new Error(data.error || '设置未保存，请重试')
      if (generation !== loadGeneration || !supported.value) return false
      state.config = normalizeSwitchingConfig(data?.config || { ...state.config, ...config })
      state.loaded = true
      return true
    } catch (error) {
      if (generation !== loadGeneration || !supported.value) return false
      state.error = error.message || '设置未保存，请重试'
      console.warn('[account-switching] Save failed', { status: error.status || 'network' })
      return false
    } finally { state.saving = false }
  }

  function save(config) { return persistConfig(normalizeSwitchingConfig(config)) }

  function acknowledgeOnboarding() {
    if (!supported.value || pendingAcknowledgement) return
    const generation = loadGeneration
    // This metadata-only acknowledgement must never hold the modal or save lock.
    const pending = request('/account-list-config', { method: 'POST', body: { config: { onboarding_completed: true } } })
      .then(data => {
        if (data?.success === false) throw new Error('Onboarding acknowledgement failed')
        if (generation !== loadGeneration || !supported.value) return
        state.config.onboarding_completed = true
      })
      .catch(error => {
        console.warn('[account-switching] Onboarding acknowledgement failed', { status: error.status || 'network' })
      })
      .finally(() => { if (pendingAcknowledgement === pending) pendingAcknowledgement = null })
    pendingAcknowledgement = pending
  }

  function dismiss() {
    if (!state.open || state.saving) return
    state.open = false
    app.notify('没关系，您随时可以在应用设置中重新打开向导')
    // Close first; a failed or slow acknowledgement cannot trap a declined user.
    if (state.loaded && !state.config.onboarding_completed) acknowledgeOnboarding()
  }

  function closeAfterSave() { state.open = false }
  function reset() {
    loadGeneration += 1
    pendingLoad = null
    pendingAcknowledgement = null
    state.open = false
    state.loaded = false
    state.unavailable = false
    state.loading = false
    state.error = ''
  }

  return { state: readonly(state), supported, load, openWizard, save, dismiss, closeAfterSave, reset }
}
