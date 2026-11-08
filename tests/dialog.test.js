import { describe, expect, it } from 'vitest'
import { cancelDialog, dialogState, settleDialog, showConfirm, showPrompt } from '../src/dialogService'

describe('non-blocking dialog service', () => {
  it('resolves confirmations asynchronously', async () => {
    const result = showConfirm('继续吗？', { title: '确认操作' })
    expect(dialogState.current.message).toBe('继续吗？')
    settleDialog(true)
    await expect(result).resolves.toBe(true)
  })

  it('queues dialogs and returns null when a prompt is cancelled', async () => {
    const first = showConfirm('第一个')
    const second = showPrompt('第二个', { defaultValue: '原值' })
    expect(dialogState.current.message).toBe('第一个')
    settleDialog(false)
    await expect(first).resolves.toBe(false)
    await Promise.resolve()
    expect(dialogState.current.message).toBe('第二个')
    expect(dialogState.current.defaultValue).toBe('原值')
    cancelDialog()
    await expect(second).resolves.toBe(null)
  })
})
