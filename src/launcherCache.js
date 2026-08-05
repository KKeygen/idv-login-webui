import { resourceUrl } from './api.js'

const CACHE_KEY = 'idv.launcher.visual-cache.v1'
const CACHE_SCHEMA = 1
const retainedImages = new Map()
const MAX_RETAINED_IMAGES = 24

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

/**
 * Start decoding launcher artwork as soon as its metadata arrives and retain a
 * small process-lifetime cache.  The launcher payload uses stable image URLs
 * for one run, so this prevents a KeepAlive remount or rail/catalog switch
 * from repeatedly allocating and decoding the same image.
 */
export function preloadLauncherImages(data, options = {}) {
  const ImageCtor = options.ImageCtor || globalThis.Image
  if (typeof ImageCtor !== 'function') return 0
  const locationLike = options.location || globalThis.window?.location
  const requestedLimit = options.limit ?? 12
  const limit = Math.max(0, Number(requestedLimit) || 0)
  const urls = [...collectImageUrls(data)]
    .map(url => resourceUrl(url, locationLike))
    .filter(url => url && !retainedImages.has(url))
    .slice(0, limit)

  for (const url of urls) {
    while (retainedImages.size >= MAX_RETAINED_IMAGES) {
      retainedImages.delete(retainedImages.keys().next().value)
    }
    const image = new ImageCtor()
    image.decoding = 'async'
    image.onerror = () => retainedImages.delete(url)
    retainedImages.set(url, image)
    image.src = url
    if (typeof image.decode === 'function') Promise.resolve(image.decode()).catch(() => {})
  }
  return urls.length
}
