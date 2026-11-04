import { describe, expect, it, vi } from 'vitest'
import { changeDebugMode, debugConfirmation, FEEDBACK_URL } from '../src/debugMode'

describe('debug mode consent', () => {
  it('explains restart, the upload boundary and the warning before enabling', () => {
    const message = debugConfirmation(true)
    expect(message).toContain('重启')
    expect(message).toContain('正式版本')
    expect(message).toContain('运行日志上传到工具作者的平台')
    expect(message).toContain('不包含账号登录凭据')
    expect(message).toContain('开发版本仅开启本地调试，不上传')
    expect(message).toContain('如果你不知道自己在做什么，请不要打开')
  })

  it('does not change the setting or trigger restart if the user cancels', async () => {
    const confirm = vi.fn().mockResolvedValue(false)
    const request = vi.fn()
    expect(await changeDebugMode(true, { askConfirmation: confirm, request })).toBeNull()
    expect(confirm).toHaveBeenCalledOnce()
    expect(request).not.toHaveBeenCalled()
  })

  it('sends the intended setting only after explicit confirmation', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    const request = vi.fn().mockResolvedValue({ success: true, enabled: true, upload_enabled: true, upload_supported: true })
    const result = await changeDebugMode(true, { askConfirmation: confirm, request })
    expect(request).toHaveBeenCalledWith('/debug-mode', { method: 'POST', body: { enabled: true } })
    expect(result.enabled).toBe(true)
    expect(result.upload_enabled).toBe(true)
  })

  it('does not treat an ambiguous response as a successful change', async () => {
    const confirm = vi.fn().mockResolvedValue(true)
    await expect(changeDebugMode(false, { askConfirmation: confirm, request: vi.fn().mockResolvedValue({ success: true, enabled: true }) }))
      .rejects.toThrow('not confirmed')
  })

  it('uses the deployed user feedback survey', () => {
    expect(FEEDBACK_URL).toBe('https://idv-feedback.keygen.eu.org/index.php/82556')
  })
})
