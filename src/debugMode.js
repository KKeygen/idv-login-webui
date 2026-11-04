export const FEEDBACK_URL = 'https://idv-feedback.keygen.eu.org/index.php/82556'

export function debugConfirmation(enabled) {
  return enabled
    ? '开启调试模式后，工具将立即重启。正式版本会将经过安全筛选的运行日志上传到工具作者的平台，上传内容不包含账号登录凭据；开发版本仅开启本地调试，不上传。\n\n如果你不知道自己在做什么，请不要打开。'
    : '关闭调试模式后，工具将立即重启，并停止上传调试日志。'
}

export async function changeDebugMode(enabled, { askConfirmation, request }) {
  const confirmed = await askConfirmation(debugConfirmation(enabled), {
    title: enabled ? '开启调试模式' : '关闭调试模式',
    confirmText: enabled ? '开启并重启' : '关闭并重启',
    danger: enabled,
  })
  if (!confirmed) return null
  const result = await request('/debug-mode', { method: 'POST', body: { enabled } })
  if (result?.success !== true || result.enabled !== enabled || typeof result.upload_enabled !== 'boolean') {
    throw new Error('Debug mode change was not confirmed')
  }
  return result
}
