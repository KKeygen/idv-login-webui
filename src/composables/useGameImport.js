import { computed, reactive, readonly } from 'vue'
import { ApiError, request, resolveTask } from '../api'
import { supportsNextFeverFeatures } from '../featureVersions'
import { cmpGameId, useAppStore } from './useAppStore'

const state = reactive({
  open: false, loading: false, picking: false, submitting: false, controlling: false,
  polling: false, unavailable: false, uncertain: false, step: 0, mode: 'manual', error: '',
  candidates: [], tasks: [], recentTasks: [], task: null, draft: { source: 'manual', game_id: '', path: '', distribution_id: -1 },
})
let loadGeneration = 0
let pickerGeneration = 0
let taskGeneration = 0
let pollingTaskId = ''
let submissionBaselineIds = new Set()

export function useGameImport() {
  const app = useAppStore()
  const supported = computed(() => supportsNextFeverFeatures(app.state.backendVersion)
    && app.state.nativeCapabilities?.import_tasks_v1 === true && !state.unavailable)
  const busy = computed(() => state.loading || state.picking || state.submitting || state.controlling)
  const pending = computed(() => state.task?.status === 'pending')
  const canConfirm = computed(() => Boolean(state.draft.game_id && state.draft.path
    && (state.draft.source === 'fever' || /\.exe$/i.test(state.draft.path))
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
      state.tasks = result.active_tasks.filter(validTask)
      state.recentTasks = (Array.isArray(result.recent_tasks) ? result.recent_tasks : []).filter(validTask)
      return result
    } catch (error) {
      if (generation === loadGeneration && !unavailable(error)) state.error = '无法读取导入状态，请确认工具仍在运行后重试'
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

  function adoptTask(task) {
    // A state-list response may predate the poll that already finished this task.
    if (state.task?.task_id === task.task_id && state.task.status === 'done' && task.status === 'pending') task = state.task
    state.task = { ...task }
    state.step = 2
    state.uncertain = false
    state.error = ''
    if (task.status === 'pending') monitorTask(task)
    else {
      taskGeneration += 1
      state.polling = false
      pollingTaskId = ''
      refreshGames(task).catch(() => app.notify('导入结果已读取，但游戏列表刷新失败，请稍后刷新', 'warning'))
    }
  }

  async function restore({ autoOpen = false } = {}) {
    const result = await readState()
    if (!result || state.submitting) return
    const task = state.tasks.find(item => item.task_id === state.task?.task_id)
      || state.tasks.find(item => item.status === 'pending') || state.tasks[0]
    if (!task) return
    if (autoOpen) state.open = true
    adoptTask(task)
  }

  async function openWizard({ source = 'manual', gameId = app.state.gameId, distributionId = -1, path = '' } = {}) {
    if (!supported.value || state.submitting || state.picking || state.controlling) return
    state.open = true
    if (pending.value || state.uncertain) {
      state.step = 2
      if (!state.polling && state.task?.task_id) monitorTask(state.task)
      return
    }
    state.mode = source === 'fever' ? 'fever' : 'manual'
    state.step = 0
    state.draft = { source: 'manual', game_id: gameId || '', path: '', distribution_id: -1 }
    const result = await readState()
    if (!result || !state.open) return
    const existing = state.tasks.find(item => item.status === 'pending') || state.tasks[0]
    if (existing) { adoptTask(existing); return }
    state.task = null
    if (state.mode === 'fever') {
      const preferred = state.candidates.find(item => (
        cmpGameId(item.game_id, gameId)
        && (distributionId === -1 || String(item.distribution_id) === String(distributionId))
        && (!path || item.path === path)
      ))
      if (preferred) selectCandidate(preferred)
    }
  }

  function setMode(mode) {
    if (busy.value || state.step !== 0) return
    state.mode = mode === 'fever' ? 'fever' : 'manual'
    state.draft = { source: 'manual', game_id: app.state.gameId || '', path: '', distribution_id: -1 }
    state.error = ''
  }
  function setGame(gameId) {
    if (!busy.value && state.step === 0 && state.mode === 'manual') state.draft.game_id = gameId
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
      if (generation === pickerGeneration && !unavailable(error)) state.error = error.message || '选择游戏路径失败'
    } finally {
      if (generation === pickerGeneration) state.picking = false
    }
  }

  function next() { if (state.step === 0 && canConfirm.value) state.step = 1 }
  function back() {
    if (busy.value || pending.value || state.uncertain) return
    if (state.step === 1) state.step = 0
  }

  async function monitorTask(task) {
    if (!supported.value || !task?.task_id || (state.polling && pollingTaskId === task.task_id)) return
    const generation = ++taskGeneration
    const taskId = task.task_id
    pollingTaskId = taskId
    state.task = { ...task }
    state.polling = true
    state.error = ''
    try {
      while (generation === taskGeneration && supported.value) {
        const result = await request('/native/task-status', { query: { task_id: taskId } })
        if (generation !== taskGeneration) return
        if (result?.task_id !== taskId || result.kind !== 'game-import' || !['pending', 'done'].includes(result?.status)) throw new Error('后台任务状态不完整')
        state.task = { ...state.task, ...result }
        state.uncertain = false
        if (result.status === 'done') {
          state.tasks = state.tasks.map(item => item.task_id === taskId ? state.task : item)
          try { await refreshGames(state.task) } catch { app.notify('导入任务已结束，但游戏列表刷新失败，请稍后刷新', 'warning') }
          return
        }
        await new Promise(resolve => setTimeout(resolve, state.open && document.visibilityState !== 'hidden' ? 750 : 1800))
      }
    } catch {
      if (generation === taskGeneration) state.error = '无法确认导入进度。后台任务可能仍在继续，请重新读取状态，不要重复导入'
    } finally {
      if (generation === taskGeneration) { state.polling = false; pollingTaskId = '' }
    }
  }

  async function recoverSubmission() {
    const result = await readState()
    if (!result) return
    const pathKey = path => String(path || '').replaceAll('\\', '/').toLowerCase()
    const task = [...state.tasks, ...state.recentTasks].find(item => !submissionBaselineIds.has(item.task_id)
      && cmpGameId(item.game_id, state.draft.game_id) && pathKey(item.path) === pathKey(state.draft.path)
      && (state.draft.source !== 'fever' || state.draft.distribution_id === -1
        || String(item.distribution_id) === String(state.draft.distribution_id)))
    if (task) adoptTask(task)
    else state.error = '尚未找到本次任务，请先检查游戏记录并重新读取状态；为避免重复提交，当前不会再次发起导入'
  }

  async function submit() {
    if (!supported.value || state.step !== 1 || !canConfirm.value) return
    const draft = { ...state.draft }
    submissionBaselineIds = new Set([...state.tasks, ...state.recentTasks].map(item => item.task_id))
    state.submitting = true
    state.error = ''
    try {
      const path = draft.source === 'fever' ? '/launcher-import-fever' : '/launcher-locate'
      const result = await request(path, { method: 'POST', body: { game_id: draft.game_id, path: draft.path, distribution_id: draft.distribution_id, async_import: true } })
      if (!result?.task_id || !['pending', 'done'].includes(result.status)) {
        if (result?.success === false) throw new ApiError(result.error || '无法开始导入', 400, result)
        throw new Error('未确认导入任务')
      }
      adoptTask({ ...draft, ...result, kind: 'game-import' })
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        if (!unavailable(error)) state.error = error.message || '导入请求被拒绝，请检查所选游戏与路径'
      } else {
        // A lost response is not a failed write. Reattach before allowing any retry.
        state.uncertain = true
        state.step = 2
        await recoverSubmission()
      }
    } finally { state.submitting = false }
  }

  async function cancel() {
    if (!pending.value || !state.task.cancelable || state.task.cancel_requested || busy.value) return
    state.controlling = true
    state.error = ''
    try {
      const result = await request('/native/import-control', { method: 'POST', body: { task_id: state.task.task_id, action: 'cancel' } })
      if (result?.success !== true) throw new Error(result?.error || '未确认取消请求')
      if (result.task?.task_id === state.task?.task_id) state.task = { ...state.task, ...result.task }
      if (!state.polling) monitorTask(state.task)
    } catch (error) { state.error = error.message || '未确认取消，请重新读取任务状态' }
    finally { state.controlling = false }
  }

  async function acknowledge(task) {
    if (!task?.task_id || task.status !== 'done') return true
    state.controlling = true
    try {
      const result = await request('/native/import-control', { method: 'POST', body: { task_id: task.task_id, action: 'acknowledge' } })
      if (result?.success !== true) throw new Error('未确认结果已读')
      state.tasks = state.tasks.filter(item => item.task_id !== task.task_id)
      if (!state.open && state.task?.task_id === task.task_id) state.task = null
      return true
    } catch { app.notify('结果已读状态未保存，下次打开可能再次展示', 'warning'); return false }
    finally { state.controlling = false }
  }
  function close() {
    if (state.submitting || state.picking || state.controlling) return
    state.open = false
    loadGeneration += 1
    state.loading = false
    if (state.task?.status === 'done') acknowledge({ ...state.task })
  }
  async function continueImport() {
    if (busy.value || pending.value || state.uncertain) return
    if (!await acknowledge(state.task)) return
    state.task = null
    await openWizard({ source: state.mode })
  }
  function retryStatus() {
    if (busy.value || state.polling) return
    if (state.task?.task_id) return monitorTask(state.task)
    if (state.uncertain) return recoverSubmission()
    return readState()
  }
  function dispose() {
    taskGeneration += 1; loadGeneration += 1; pickerGeneration += 1
    state.polling = false; state.loading = false; state.picking = false; pollingTaskId = ''
  }

  return { state: readonly(state), supported, busy, pending, canConfirm, restore, openWizard, readState, setMode, setGame, selectCandidate, chooseExecutable, next, back, submit, cancel, close, continueImport, retryStatus, dispose }
}
