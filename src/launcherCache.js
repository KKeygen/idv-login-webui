const CACHE_KEY = 'idv.launcher.visual-cache.v1'
const CACHE_SCHEMA = 1
const warmedImages = new Set()

function isLocalFrontend(locationLike = globalThis.location) {
  const hostname = String(locationLike?.hostname || '').toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function storageFor(locationLike = globalThis.location, storage = globalThis.localStorage) {
  return isLocalFrontend(locationLike) && storage ? storage : null
}

function readCache(locationLike = globalThis.location, storage = globalThis.localStorage) {
  const target = storageFor(locationLike, storage)
  if (!target) return null
  try {
    const value = JSON.parse(target.getItem(CACHE_KEY) || 'null')
    return value?.schema_version === CACHE_SCHEMA ? value : null
  } catch {
    return null
  }
}

function writeCache(value, locationLike = globalThis.location, storage = globalThis.localStorage) {
  const target = storageFor(locationLike, storage)
  if (!target) return false
  try {
    target.setItem(CACHE_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function sameGameId(a = '', b = '') {
  const left = String(a)
  const right = String(b)
  return left === right || (left && right && left.split('-').pop() === right.split('-').pop())
}

function mergeVisualLaunchers(data = {}) {
  const distributions = Array.isArray(data.distributions) ? data.distributions : []
  const preferredId = data.game?.default_distribution
  const preferred = distributions.find(item => String(item.distribution_id) === String(preferredId)) || distributions[0]
  const merged = {}
  for (const item of distributions) {
    for (const [key, value] of Object.entries(item.launcher || {})) {
      if (merged[key] === undefined || merged[key] === null || merged[key] === '') merged[key] = value
    }
  }
  return { ...merged, ...(preferred?.launcher || {}) }
}

export function readCatalogCache(options = {}) {
  const cache = readCache(options.location, options.storage)
  if (!cache?.catalog?.length && !cache?.catalog_all?.length) return null
  return {
    catalog: cache.catalog || [],
    catalog_all: cache.catalog_all || cache.catalog || [],
  }
}

export function cacheCatalog(data = {}, options = {}) {
  const current = readCache(options.location, options.storage) || { schema_version: CACHE_SCHEMA, launchers: {} }
  current.catalog = Array.isArray(data.catalog) ? data.catalog : []
  current.catalog_all = Array.isArray(data.catalog_all) ? data.catalog_all : current.catalog
  current.updated_at = Date.now()
  return writeCache(current, options.location, options.storage)
}

export function readLauncherVisual(gameId, options = {}) {
  const cache = readCache(options.location, options.storage)
  const entry = Object.entries(cache?.launchers || {}).find(([key]) => sameGameId(key, gameId))
  return entry?.[1]?.launcher || null
}

export function cacheLauncherVisual(data = {}, options = {}) {
  if (!data.game_id) return false
  const current = readCache(options.location, options.storage) || { schema_version: CACHE_SCHEMA, launchers: {} }
  current.launchers ||= {}
  current.launchers[data.game_id] = {
    updated_at: Date.now(),
    launcher: mergeVisualLaunchers(data),
  }
  return writeCache(current, options.location, options.storage)
}

function collectImageUrls(value, key = '', result = new Set()) {
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value) && (
      /(?:image|icon|logo|cover|background|banner|poster|thumb)/i.test(key)
      || /\.(?:avif|gif|jpe?g|png|webp)(?:\?|$)/i.test(value)
    )) result.add(value)
    return result
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, key, result)
  } else if (value && typeof value === 'object') {
    for (const [childKey, item] of Object.entries(value)) collectImageUrls(item, childKey, result)
  }
  return result
}

export function warmLauncherImages(data, options = {}) {
  if (!isLocalFrontend(options.location || globalThis.location)) return 0
  const fetcher = options.fetcher || globalThis.fetch
  if (typeof fetcher !== 'function') return 0
  const urls = [...collectImageUrls(data)].filter(url => !warmedImages.has(url)).slice(0, 32)
  for (const url of urls) {
    warmedImages.add(url)
    Promise.resolve(fetcher(url, { mode: 'no-cors', cache: 'force-cache', credentials: 'omit' })).catch(() => {})
  }
  return urls.length
}
