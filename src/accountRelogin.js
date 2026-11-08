export function createAccountRelogin({ taskId, gameId, request, onState, onError, onComplete }) {
  let task = null
  let timer = null
  let disposed = false
  let started = false
  let errorShown = false

  function publish(value) {
    if (!value || value.task_id !== taskId || typeof value.game_id !== 'string' || value.game_id.split('-').pop() !== gameId.split('-').pop() || !value.uuid || !['waiting', 'pending', 'done'].includes(value.status)) {
      throw Object.assign(new Error('重新登录任务与当前账号页面不匹配'), { status: 409 })
    }
    if (task && value.uuid !== task.uuid) throw Object.assign(new Error('重新登录账号已改变'), { status: 409 })
    task = value
    if (!disposed) onState(value)
  }

  async function cancelRequest() {
    if (!task || task.status === 'done') return
    await request('/relogin', { body: {
      task_id: taskId, game_id: gameId, uuid: task.uuid, action: 'cancel',
    }, keepalive: true })
  }

  async function poll() {
    try {
      const value = await request('/relogin', { query: { task_id: taskId, game_id: gameId } })
      publish(value)
      if (disposed) { await cancelRequest(); return }
      if (task.status === 'waiting') {
        publish(await request('/relogin', { body: {
          task_id: taskId, game_id: gameId, uuid: task.uuid, action: 'start',
        } }))
        if (disposed) { await cancelRequest(); return }
      }
      errorShown = false
      if (task.status === 'done') {
        onComplete(task)
        return
      }
    } catch (error) {
      if (disposed) return
      if (!errorShown) onError(error)
      errorShown = true
      if (error.status === 404 || error.status === 409) return
    }
    if (!disposed) timer = setTimeout(poll, 750)
  }

  return {
    start() {
      if (started || disposed || !taskId || !gameId) return
      started = true
      poll()
    },
    cancel() {
      if (disposed) return
      disposed = true
      clearTimeout(timer)
      cancelRequest().catch(() => {})
    },
  }
}
