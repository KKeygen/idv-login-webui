/**
 * Resolve the amount of free disk space that must exist before installation.
 *
 * A backend-provided required_bytes value is authoritative because it may
 * already include temporary files or platform-specific overhead. Older
 * backends only expose download_bytes/unzip_bytes, in which case the larger
 * value is the safest compatible lower bound.
 */
export function requiredInstallBytes(requirements = {}) {
  const explicit = Number(requirements?.required_bytes)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  return Math.max(
    Number(requirements?.unzip_bytes) || 0,
    Number(requirements?.download_bytes) || 0,
  )
}

export function availableInstallBytes(pathStatus) {
  return Number(pathStatus?.disk_free_bytes)
}

export function hasKnownInstallCapacity(path, pathStatus) {
  return Boolean(path && pathStatus && Number.isFinite(availableInstallBytes(pathStatus)))
}
