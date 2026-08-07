const API_ROOT = '/_idv-login'
const resourceUrlCache = new Map()

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export async function request(path, { query, body, method = body ? 'POST' : 'GET', signal } = {}) {
  const url = new URL(`${API_ROOT}${path}`, window.location.href)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try { payload = await response.json() } catch { payload = {} }
  if (!response.ok) throw new ApiError(payload?.error || `HTTP ${response.status}`, response.status, payload)
  return payload
}

export async function pollTask(path, taskId, { interval = 750, timeout = 24 * 60 * 60_000, onUpdate } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const result = await request(path, { query: { task_id: taskId } })
    if (onUpdate) onUpdate(result)
    if (result.status !== 'pending') return result
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  throw new Error('操作超时，请检查工具日志')
}

export async function resolveTask(result, statusPath = '/import-status') {
  return result?.status === 'pending' && result.task_id ? pollTask(statusPath, result.task_id) : result
}

export function resourceUrl(url, locationLike = globalThis.window?.location) {
  if (!url) return url
  const protocol = String(locationLike?.protocol || '')
  const cacheKey = `${protocol}|${url}`
  if (resourceUrlCache.has(cacheKey)) return resourceUrlCache.get(cacheKey)
  const resolved = protocol === 'idvlogin:' && /^https?:\/\//i.test(url)
    ? `idvlogin://cdn/${url.replace('://', '/')}`
    : url
  resourceUrlCache.set(cacheKey, resolved)
  return resolved
}

export function installIdvWindowOpenRewrite(windowLike = globalThis.window) {
  if (
    !windowLike ||
    (
      windowLike.location?.protocol !== 'idvlogin:' &&
      windowLike.location?.hostname !== 'localhost'
    )
  ) {
    return false
  }
  const OPEN = 'idvlogin://open/'
  windowLike.open = function (url) {
    if (url && /^https?:\/\//i.test(url)) {
      windowLike.location.href = OPEN + url.replace('://', '/')
    }
    return null
  }
  return true
}

export function openExternal(url) {
  if (!url) return
  if (window.location.protocol === 'idvlogin:') {
    window.location.href = `idvlogin://open/${url.replace('://', '/')}`
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
