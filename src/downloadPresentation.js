// Backend enum is idv-login/download_binary.py, not Starward's enum values.
// Starward supplies the state/hover presentation contract; only existing
// pause/resume endpoints are actionable. No unsupported cancel is invented.
export function downloadPresentation(status = {}, pending = '') {
  const state = Number(status.state)
  const labels = {1:'等待中',2:'恢复下载',3:'下载索引',4:'下载中',5:'写入文件',6:'已暂停',7:'磁盘空间不足',8:'正在完成安装',9:'下载失败',11:'校验文件'}
  const phase = String(status.phase || '')
  const paused = state === 6 || phase === '下载已暂停' || phase === 'paused'
  const transferring = [3,4].includes(state)
  const action = paused ? 'resume' : [1,2,3,4].includes(state) ? 'pause' : null
  const label = pending === 'pause' ? '正在暂停' : pending === 'resume' ? '正在恢复' : labels[state] || (phase && /[^\x00-\x7f]/.test(phase) ? phase : '正在处理')
  return {label,action,transferring,actionLabel:pending ? label : action==='resume'?'继续下载':action==='pause'?'暂停':label}
}
export function hasStageAmount(stage) { return Number(stage?.total_bytes) > 0 }
export function hasStageRate(stage) { return Boolean(stage?.rate && stage.rate !== 'N/A' && stage.rate !== '—') }
