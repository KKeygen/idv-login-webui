// Pure display formatting, shared by launcher surfaces. No store or I/O.
export function formatNewsDate(value) { return value ? new Date(Number(value) * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '' }
export function formatSize(bytes) { if (!bytes) return '0 B'; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return `${(bytes / 1024 ** i).toFixed(1)} ${['B','KB','MB','GB','TB'][i]}` }
export function parseDownloadRate(value) {
  // downloadIPC's HumanizeBytes uses powers of 1024 for KB/MB/... .
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*(B|[KMGTPE]i?B)\s*\/\s*s$/)
  if (!match) return 0
  const rate = Number(match[1]) * 1024 ** ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'].indexOf(match[2].replace('i', ''))
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}
export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours, minutes, rest].map(value => String(value).padStart(2, '0')).join(':')
}
export function stageAmount(stage = {}) {
  if (Number(stage.total_bytes) > 0) return `${formatSize(stage.completed_bytes || 0)}/${formatSize(stage.total_bytes)}`
  return `${Math.round(Number(stage.percent) || 0)}%`
}
export function stageRate(stage = {}) {
  const rate = String(stage.rate || '')
  return rate && rate !== 'N/A' ? rate : '—'
}
