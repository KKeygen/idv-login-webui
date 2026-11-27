import { computed, reactive, readonly } from 'vue'
import { ApiError, request, resolveTask } from '../api'
import { supportsNextFeverFeatures, supportsStableGameImport } from '../featureVersions'
import { cmpGameId, gameTitle, useAppStore } from './useAppStore'
import { gameRailTabKey } from '../gameRailStorage'

const pollers = new Map()
const state = reactive({
  open: false, loading: false, picking: false, submitting: false, controlling: false,
  unavailable: false, uncertain: false, step: 0, mode: 'manual', error: '',
  candidates: [], tasks: [], recentTasks: [], draft: { source: 'manual', game_id: '', path: '', distribution_id: -1 },
})
let loadGeneration = 0
let pickerGeneration = 0
let submissionBaselineIds = new Set()
let openingPage

export function importTargetKey(gameId, distributionId) {
  return gameRailTabKey(gameId, distributionId === '' ? -1 : distributionId ?? -1)
}

export function importProgressValue(task) {
  const value = task?.progress_percent
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : Number.NaN
}

export function postImportDownload(result) {
  return {
    id: result?.download_task_id || result?.update_task_id || result?.repair_task_id || '',
    operation: result?.download_operation || (result?.repair_task_id ? 'repair' : 'update'),
    status: result?.download_status || result?.update_status || result?.repair_status || '',
    error: result?.download_error || result?.update_error || result?.repair_error || '',
  }
}

export function importErrorMessage(detail = '') {
  if (/(多个.*安装)/.test(detail)) return '找到多个安装，请选择要导入的游戏。'
  if (/未找到可导入/.test(detail)) return '发烧游戏平台中找不到此游戏，请手动选择文件。'
  if (/启动程序.*(?:不存在|移走)|请选择.*EXE|须.*\.exe/.test(detail)) return '找不到游戏程序，请重新选择 EXE 文件。'
  if (/权限|拒绝访问|access denied/i.test(detail)) return '无法访问游戏文件，请检查权限。'
  return '导入失败，请检查所选游戏和文件后重试。'
}

export function importResultWarning(result) {
  const { status, error } = postImportDownload(result)
  if (status === 'failed') return '游戏暂未就绪，请在游戏页重试。'
  if (status === 'skipped' && /安装路径.*不匹配/.test(error)) return '无法确认游戏程序，请检查所选文件。'
  return ''
}

function importPathKey(path) {
  return String(path || '').replaceAll('\\', '/').toLowerCase()
}

export function useGameImport() {
  const app = useAppStore()
  const supported = computed(() => supportsNextFeverFeatures(app.state.backendVersion)
    && app.state.nativeCapabilities?.import_tasks_v1 === true && !state.unavailable)
  const stableRouting = computed(() => supportsStableGameImport(app.state.backendVersion))
  const busy = computed(() => state.loading || state.picking || state.submitting || state.controlling)
  const pendingImports = computed(() => supported.value ? state.tasks.filter(task => task.status === 'pending') : [])
  function pendingFor(gameId, distributionId) {
    const key = importTargetKey(gameId, distributionId)
    return pendingImports.value.find(task => task.game_id && importTargetKey(task.game_id, task.distribution_id) === key)
  }
  function distributionsFor(gameId) {
    return app.state.railLaunchers.find(item => cmpGameId(item.game_id, gameId))?.distributions || []
  }
  function distributionTitle(gameId, distributionId) {
    if (distributionId == null || distributionId === '' || String(distributionId) === '-1') return ''
    const item = distributionsFor(gameId).find(item => String(item.distribution_id) === String(distributionId))
    return item?.launcher?.display_name || item?.name || item?.launcher?.app_name || `版本 ${distributionId}`
  }
  function distributionCorrection(gameId, requested, actual) {
    if (!stableRouting.value || String(requested) === String(actual) || requested == null || requested === '' || String(requested) === '-1') return ''
    const title = distributionTitle(gameId, actual)
    return title ? `已识别为「${title}」` : ''
  }
  function resultCorrection(result, task) {
    if (result.success !== true || !cmpGameId(result.game_id, task?.game_id)
      || importPathKey(result.path) !== importPathKey(task?.path)) return ''
    return distributionCorrection(result.game_id, task.requested_distribution_id, result.distribution_id)
  }

  function rememberTask(task) {
    const index = state.tasks.findIndex(item => item.task_id === task.task_id)
    const existing = state.tasks[index]
    if (existing?.status === 'done' && task.status === 'pending') return existing
    if (existing) state.tasks.splice(index, 1, { ...existing, ...task })
    else state.tasks.push(task)
    return state.tasks[existing ? index : state.tasks.length - 1]
  }
  const manualDistributions = computed(() => stableRouting.value ? distributionsFor(state.draft.game_id) : [])
  const selectedDistribution = computed(() => {
    if (state.draft.source === 'fever') return state.draft.distribution_id
    const ids = manualDistributions.value.map(item => String(item.distribution_id))
    const selected = String(state.draft.distribution_id)
    if (!ids.length || ids.includes(selected)) return selected
    return ids.length === 1 ? ids[0] : '-1'
  })
  const canConfirm = computed(() => Boolean(state.draft.game_id && state.draft.path
    && (state.draft.source === 'fever' || /\.exe$/i.test(state.draft.path))
    && (state.draft.source === 'fever' || manualDistributions.value.length <= 1 || selectedDistribution.value !== '-1')
    && !(stableRouting.value ? pendingFor(state.draft.game_id, selectedDistribution.value) : pendingImports.value.length)
    && !busy.value && !state.uncertain))

  function unavailable(error) {
    if (!(error instanceof ApiError) || error.status !== 404) return false
    state.unavailable = true
    state.open = false
    app.markUpdateRequired()
    return true
  }

  async function readState() {
    if (!supported.value) return null
    const generation = ++loadGeneration
    state.loading = true
    state.error = ''
    try {
      const result = await request('/launcher-import-state')
      if (generation !== loadGeneration || !supported.value) return null
      if (result?.success === false || !Array.isArray(result?.candidates) || !Array.isArray(result?.active_tasks)) throw new Error('导入状态数据不完整')
      state.candidates = result.candidates.filter(item => item?.source === 'fever' && item.game_id && item.path)
      const validTask = item => item?.kind === 'game-import' && item.task_id && ['pending', 'done'].includes(item.status)
      const active = result.active_tasks.filter(validTask)
      for (const task of active) {
        // Keep the active poll as the source of progress and its final outcome.
        if (pollers.has(task.task_id)) continue
        const previous = state.tasks.find(item => item.task_id === task.task_id)
        if (previous?.status === 'done') continue
        if (task.status === 'pending') monitorTask(rememberTask(task))
        else if (!state.submitting && !state.uncertain) completeTask(rememberTask(task))
      }
      const activeIds = new Set(active.map(task => task.task_id))
      state.tasks = state.tasks.filter(task => activeIds.has(task.task_id) || pollers.has(task.task_id))
      state.recentTasks = (Array.isArray(result.recent_tasks) ? result.recent_tasks : []).filter(validTask)
      return result
    } catch (error) {
      if (generation === loadGeneration && !unavailable(error)) state.error = '无法查看导入状态，请确认工具仍在运行。'
      return null
    } finally {
      if (generation === loadGeneration) state.loading = false
    }
  }

  async function refreshGames(task) {
    // Refresh records without changing the game/page the user is viewing.
    await app.loadGames()
    const gameIds = [task?.game_id, ...(task?.results || []).map(item => item.game_id)].filter(Boolean)
    const refreshed = await app.loadInstalledRail({ forceGameIds: gameIds })
    await app.refreshCurrent()
    if (refreshed?.some(item => item.status === 'rejected')) throw new Error('部分游戏记录刷新失败')
  }

  async function readManualDistributions() {
    if (!stableRouting.value || !state.open || state.step !== 0 || state.mode !== 'manual' || !state.draft.game_id) return
    const generation = ++loadGeneration
    state.loading = true
    state.error = ''
    try {
      const data = await app.requestLauncher(state.draft.game_id)
      if (data?.success === false) throw new Error(data.error)
    } catch {
      if (generation === loadGeneration) state.error = '无法加载游戏版本，请重试。'
    } finally {
      if (generation === loadGeneration) state.loading = false
    }
  }

  async function refreshSources() {
    if (await readState()) await readManualDistributions()
  }

  function restore() { return readState() }

  function acceptTask(task, fromPage) {
    const showTarget = state.open && fromPage
      && app.state.view === fromPage.view && cmpGameId(app.state.gameId, fromPage.gameId)
      && app.state.distributionId === fromPage.distributionId
    state.open = false
    state.uncertain = false
    state.error = ''
    if (task.status === 'done') {
      completeTask(task)
      return
    }
    monitorTask(rememberTask(task))
    app.notify('导入已经开始')
    if (showTarget && task.game_id && (app.state.view !== 'launcher'
      || !cmpGameId(app.state.gameId, task.game_id) || app.state.distributionId !== String(task.distribution_id))) {
      app.selectRailTab({ game_id: task.game_id, distribution_id: task.distribution_id })
        .catch(() => app.notify('无法加载游戏页面，请在顶部选择游戏。', 'warning'))
    }
  }

  async function openWizard({ source = 'manual', gameId, distributionId = -1, path = '' } = {}) {
    if (!supported.value || state.submitting || state.picking || state.controlling) return
    state.open = true
    if (state.uncertain) return
    openingPage = { view: app.state.view, gameId: app.state.gameId, distributionId: app.state.distributionId }
    state.mode = source === 'fever' ? 'fever' : 'manual'
    state.step = 0
    state.draft = {
      source: 'manual', game_id: gameId || app.state.gameId || '', path: '',
      distribution_id: stableRouting.value && state.mode === 'manual' && distributionId !== '' ? distributionId ?? -1 : -1,
    }
    const result = await readState()
    if (!result || !state.open) return
    if (state.mode === 'fever') {
      const preferred = state.candidates.find(item => (
        cmpGameId(item.game_id, gameId)
        && (String(distributionId) === '-1' || String(item.distribution_id) === String(distributionId))
        && (!path || item.path === path)
      ))
      if (preferred) selectCandidate(preferred)
    } else await readManualDistributions()
  }

  function setMode(mode) {
    if (busy.value || state.step !== 0 || state.mode === mode) return
    state.mode = mode === 'fever' ? 'fever' : 'manual'
    state.draft = { source: 'manual', game_id: app.state.gameId || '', path: '', distribution_id: -1 }
    state.error = ''
    return readManualDistributions()
  }
  function setGame(gameId) {
    if (busy.value || state.step !== 0 || state.mode !== 'manual' || cmpGameId(gameId, state.draft.game_id)) return
    state.draft.game_id = gameId
    state.draft.distribution_id = -1
    return readManualDistributions()
  }
  function setDistribution(distributionId) {
    if (stableRouting.value && !busy.value && state.step === 0 && state.mode === 'manual') state.draft.distribution_id = distributionId
  }
  function selectCandidate(candidate) {
    if (busy.value || state.step !== 0) return
    const selected = state.candidates.find(item => cmpGameId(item.game_id, candidate?.game_id)
      && item.path === candidate.path && String(item.distribution_id) === String(candidate.distribution_id))
    if (!selected) return
    state.draft = { source: 'fever', game_id: selected.game_id, path: selected.path, distribution_id: selected.distribution_id ?? -1, display_name: selected.display_name || '' }
  }
  async function chooseExecutable() {
    if (!supported.value || busy.value || state.step !== 0 || state.mode !== 'manual') return
    const generation = ++pickerGeneration
    state.picking = true
    state.error = ''
    try {
      const task = await request('/native/pick-executable', { method: 'POST', body: { title: '选择游戏启动程序（EXE）', file_filter: '游戏程序 (*.exe)' } })
      const result = await resolveTask(task, '/native/task-status')
      if (generation !== pickerGeneration || !state.open) return
      if (result?.cancelled) return
      if (result?.success === false || !result?.path) throw new Error(result?.error || '没有读到所选路径')
      if (!/\.exe$/i.test(result.path)) throw new Error('请选择游戏的 EXE 启动程序，暂不支持快捷方式或目录')
      state.draft.path = result.path
    } catch (error) {
      if (generation === pickerGeneration && !unavailable(error)) {
        state.error = /EXE|权限/.test(error.message) ? importErrorMessage(error.message) : '无法选择文件，请重试。'
      }
    } finally {
      if (generation === pickerGeneration) state.picking = false
    }
  }

  function next() { if (state.step === 0 && canConfirm.value) state.step = 1 }
  function back() {
    if (busy.value || state.uncertain) return
    if (state.step === 1) state.step = 0
  }

  async function completeTask(task) {
    // Keep the temporary progress target until a successful import is on the installed rail.
    if (task.success) {
      try { await refreshGames(task) } catch { app.notify('无法刷新游戏列表，请稍后重试。', 'warning') }
    }
    rememberTask(task)
    if (task.acknowledged) return
    const results = task.results?.length ? task.results : [task]
    for (const result of results) {
      const game = app.state.games.find(item => cmpGameId(item.game_id, result.game_id))
      const title = result.game_id ? gameTitle(game || result, result.game_id) : '游戏'
      if (result.success) {
        const warning = importResultWarning(result)
        app.notify([`${title}已导入`, resultCorrection(result, task), warning].filter(Boolean).join('。'), warning ? 'warning' : 'success')
      } else if (!result.cancelled && task.phase !== 'cancelled') {
        app.notify(`${title}：${importErrorMessage(result.error || task.error)}`, 'error')
      }
    }
    // Keep the result locally for the launcher to pick up any following update.
    await request('/native/import-control', { method: 'POST', body: { task_id: task.task_id, action: 'acknowledge' } }).catch(() => {})
  }

  async function monitorTask(task) {
    if (!supported.value || !task?.task_id || pollers.has(task.task_id)) return
    const taskId = task.task_id
    const token = Symbol()
    pollers.set(taskId, token)
    try {
      while (pollers.get(taskId) === token && supported.value) {
        const result = await request('/native/task-status', { query: { task_id: taskId } }).catch(error => {
          // A failed poll does not end the backend task.
          if (error instanceof ApiError && error.status === 404) throw error
          return null
        })
        if (pollers.get(taskId) !== token) return
        if (result?.task_id === taskId && result.kind === 'game-import' && ['pending', 'done'].includes(result.status)) {
          const current = state.tasks.find(item => item.task_id === taskId)
          if (result.status === 'done' || current?.status === 'done') {
            await completeTask(result.status === 'done' ? { ...current, ...result } : current)
            return
          }
          rememberTask(result)
        }
        await new Promise(resolve => setTimeout(resolve, document.visibilityState !== 'hidden' ? 750 : 1800))
      }
    } catch (error) {
      if (pollers.get(taskId) !== token) return
      if (error instanceof ApiError && error.status === 404) {
        rememberTask({ task_id: taskId, status: 'done', success: false })
        app.notify('无法查看导入结果，请重新导入。', 'warning')
      } else app.notify('无法查看导入进度，请刷新。', 'warning')
    } finally {
      if (pollers.get(taskId) === token) pollers.delete(taskId)
    }
  }

  async function recoverSubmission() {
    const result = await readState()
    if (!result) return
    const task = [...state.tasks, ...state.recentTasks, ...result.active_tasks].find(item => item?.kind === 'game-import' && item.task_id
      && !submissionBaselineIds.has(item.task_id)
      && cmpGameId(item.game_id, state.draft.game_id) && importPathKey(item.path) === importPathKey(state.draft.path)
      && (state.draft.source !== 'fever' || state.draft.distribution_id === -1
        || String(item.distribution_id) === String(state.draft.distribution_id)))
    if (task) acceptTask({ ...task, requested_distribution_id: state.draft.distribution_id })
    else state.error = '无法确认是否已导入，请刷新。'
  }

  async function submit() {
    if (!supported.value || state.step !== 1 || !canConfirm.value) return
    const draft = { ...state.draft, distribution_id: Number(selectedDistribution.value) }
    const fromPage = openingPage
    state.draft.distribution_id = draft.distribution_id
    submissionBaselineIds = new Set([...state.tasks, ...state.recentTasks].map(item => item.task_id))
    state.submitting = true
    state.error = ''
    try {
      const path = draft.source === 'fever' ? '/launcher-import-fever' : '/launcher-locate'
      const result = await request(path, {
        method: 'POST',
        body: {
          game_id: draft.game_id, path: draft.path, distribution_id: draft.distribution_id, async_import: true,
          ...(app.supportsFeverUpdateModes.value ? { update_after_import: true } : {}),
        },
      })
      if (!result?.task_id || !['pending', 'done'].includes(result.status)) {
        if (result?.success === false) throw new ApiError(result.error || '无法开始导入', 400, result)
        throw new Error('未确认导入任务')
      }
      acceptTask({
        source: draft.source, ...result, kind: 'game-import', game_id: result.game_id || draft.game_id,
        path: result.path || draft.path, distribution_id: result.distribution_id ?? draft.distribution_id,
        requested_distribution_id: draft.distribution_id,
      }, fromPage)
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        if (!unavailable(error)) state.error = importErrorMessage(error.message)
      } else {
        // A lost response is not a failed write. Reattach before allowing any retry.
        state.uncertain = true
        await recoverSubmission()
      }
    } finally { state.submitting = false }
  }

  async function cancel(task) {
    if (task?.status !== 'pending' || !task.cancelable || task.cancel_requested || state.controlling) return
    state.controlling = true
    try {
      const result = await request('/native/import-control', { method: 'POST', body: { task_id: task.task_id, action: 'cancel' } })
      if (result?.success !== true) throw new Error(result?.error || '未确认取消请求')
      const current = state.tasks.find(item => item.task_id === task.task_id)
      if (current?.status !== 'pending') return
      monitorTask(result.task?.task_id === task.task_id ? rememberTask(result.task) : current)
    } catch { app.notify('无法取消导入，请刷新。', 'error') }
    finally { state.controlling = false }
  }

  function close() {
    if (state.submitting || state.picking || state.controlling) return
    state.open = false
    loadGeneration += 1
    state.loading = false
  }
  function dispose() {
    loadGeneration += 1; pickerGeneration += 1; pollers.clear()
    state.loading = false; state.picking = false
  }

  return { state: readonly(state), supported, stableRouting, busy, pendingImports, pendingFor, canConfirm, manualDistributions, selectedDistribution, distributionTitle, distributionCorrection, restore, openWizard, refreshSources, setMode, setGame, setDistribution, selectCandidate, chooseExecutable, next, back, submit, cancel, close, recoverSubmission, dispose }
}
