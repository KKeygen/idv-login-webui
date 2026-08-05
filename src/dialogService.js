import { readonly, shallowReactive } from 'vue'

const state = shallowReactive({ current: null })
const queue = []
let activeResolve = null
let nextId = 0

function showNext() {
  if (state.current || !queue.length) return
  const item = queue.shift()
  activeResolve = item.resolve
  state.current = item.dialog
}

function enqueue(kind, message, options = {}) {
  return new Promise(resolve => {
    queue.push({
      resolve,
      dialog: {
        id: ++nextId,
        kind,
        message: String(message || ''),
        title: options.title || (kind === 'prompt' ? '请输入' : '请确认'),
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        defaultValue: String(options.defaultValue ?? ''),
        placeholder: String(options.placeholder || ''),
        inputLabel: String(options.inputLabel || ''),
        danger: Boolean(options.danger),
      },
    })
    showNext()
  })
}

export const dialogState = readonly(state)

export function showConfirm(message, options = {}) {
  return enqueue('confirm', message, options)
}

export function showPrompt(message, options = {}) {
  return enqueue('prompt', message, options)
}

export function settleDialog(value) {
  if (!state.current) return false
  const resolve = activeResolve
  state.current = null
  activeResolve = null
  resolve(value)
  Promise.resolve().then(showNext)
  return true
}

export function cancelDialog() {
  if (!state.current) return false
  return settleDialog(state.current.kind === 'prompt' ? null : false)
}
