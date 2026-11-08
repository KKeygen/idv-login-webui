const modalStack = []

const MODAL_Z_INDEX_BASE = 200
const MODAL_Z_INDEX_STEP = 2
let nextLayer = 0

function removeToken(token) {
  const index = modalStack.lastIndexOf(token)
  if (index !== -1) modalStack.splice(index, 1)
}

function resetLayerSequenceIfIdle() {
  if (!modalStack.length) nextLayer = 0
}

export function openModal(token) {
  removeToken(token)
  modalStack.push(token)
  nextLayer += 1
  return MODAL_Z_INDEX_BASE + (nextLayer * MODAL_Z_INDEX_STEP)
}

export function removeModal(token) {
  removeToken(token)
  resetLayerSequenceIfIdle()
}

export function isTopModal(token) {
  return modalStack.at(-1) === token
}
