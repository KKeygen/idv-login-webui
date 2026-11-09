<script setup>
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { isTopModal, openModal, removeModal } from '../modalStack'
import { activateModalLayer, deactivateModalLayer, focusableElements } from './modalAccessibility'
import { animateStyles, DIALOG_MOTION, reducedMotion } from './winControlUtils'

const props = defineProps({
  title: { type: String, default: '' },
  open: Boolean,
  headerless: Boolean,
  dismissible: { type: Boolean, default: true },
  modalClass: { type: [String, Array, Object], default: '' },
  motionMode: { type: String, default: 'dialog' },
  smokeBackground: { type: String, default: '#0000004d' },
})
const emit = defineEmits(['close'])
const modalToken = Symbol('modal-shell')
const modalZIndex = ref(200)
const backdrop = ref(null)
const dialog = ref(null)
const active = ref(true)
let closeRequested = false
let backdropPress = false
let motion = []
let generation = 0
let leased = false
let mounted = false
let mediaQuery
let motionDone
let listening = false
let returnFocusTarget

function requestClose() {
  if (!active.value || !props.open || !props.dismissible || !isTopModal(modalToken) || closeRequested) return false
  closeRequested = true
  emit('close')
  // A controlled parent may veto a close. Do not emit twice in the same turn.
  nextTick(() => { if (props.open) closeRequested = false })
  return true
}

function focusInitial() {
  if (!isTopModal(modalToken) || !dialog.value) return
  const preferred = dialog.value.querySelector('[autofocus]')
  const focusables = focusableElements(dialog.value)
  if (focusables.includes(preferred)) preferred.focus({ preventScroll: true })
  // A prompt/confirm host may already have focused and selected its field in
  // the same render. Keep that deliberate focus rather than stealing it.
  else if (!focusables.includes(document.activeElement)) (focusables[0] || dialog.value).focus({ preventScroll: true })
}

function handleFocus(event) {
  if (isTopModal(modalToken) && backdrop.value && !backdrop.value.contains(event.target)) focusInitial()
}

function handleKeydown(event) {
  if (!isTopModal(modalToken) || !backdrop.value || event.defaultPrevented) return
  if (event.key === 'Escape') {
    // Consume Escape throughout leave, so it cannot dismiss the layer below.
    event.preventDefault()
    event.stopImmediatePropagation()
    requestClose()
  } else if (event.key === 'Tab') {
    const items = focusableElements(dialog.value)
    const current = document.activeElement
    if (!items.length || !items.includes(current) || (!event.shiftKey && current === items.at(-1)) || (event.shiftKey && current === items[0])) {
      event.preventDefault()
      ;((event.shiftKey ? items.at(-1) : items[0]) || dialog.value)?.focus({ preventScroll: true })
    }
  }
}

function blockLeavingClick(event) { if (!active.value || !props.open) { event.preventDefault(); event.stopImmediatePropagation() } }
function handlePointerDown(event) { backdropPress = event.target === event.currentTarget && event.button === 0 }
function handleBackdropClick(event) {
  if (event.target !== event.currentTarget) return
  // A drag starting inside the dialog is not a light-dismiss gesture.
  if (backdropPress || event.detail === 0) requestClose()
  backdropPress = false
  event.stopPropagation()
}

function cancelMotion() {
  generation += 1
  motion.forEach(animation => animation.cancel())
  motion = []
  motionDone = undefined
}

function runMotion(element, entering, done) {
  if (!active.value) { cancelMotion(); done(); return }
  const panel = element.querySelector('.modal')
  if (props.motionMode === 'selector') {
    const fromOpacity = motion.length ? getComputedStyle(panel).opacity : '0'
    cancelMotion()
    const id = generation
    panel.style.transform = 'none'
    if (!entering) { done(); return }
    motionDone = done
    motion = [animateStyles(panel, { opacity: fromOpacity }, { opacity: '1' }, { duration: reducedMotion() ? 0 : 300 })]
    motion[0].finished.then(() => {
      if (id !== generation) return
      motion = []
      motionDone = undefined
      done()
    })
    return
  }
  const smoke = element.querySelector('.win-dialog-smoke')
  const existing = motion.length > 0
  const panelStyle = getComputedStyle(panel)
  const fromOpacity = existing ? panelStyle.opacity : entering ? '0' : '1'
  const fromSmoke = existing ? getComputedStyle(smoke).opacity : entering ? '0' : '1'
  const fromTransform = existing ? panelStyle.transform : entering ? 'scale(1.05)' : 'scale(1)'
  cancelMotion()
  const id = generation
  motionDone = done
  const duration = reducedMotion() ? 0 : DIALOG_MOTION[entering ? 'enter' : 'leave']
  const opacityDuration = reducedMotion() ? 0 : DIALOG_MOTION.opacity
  // Native opacity tracks are 83ms, independent of the 250/167ms scale.
  // Smoke is a sibling: fading the parent would multiply panel opacity twice.
  motion = [
    animateStyles(smoke, { opacity: fromSmoke }, { opacity: entering ? '1' : '0' }, { duration: opacityDuration }),
    animateStyles(panel, { opacity: fromOpacity }, { opacity: entering ? '1' : '0' }, { duration: opacityDuration }),
    animateStyles(panel, { transform: fromTransform }, { transform: entering ? 'scale(1)' : 'scale(1.05)' }, { duration, easing: DIALOG_MOTION.easing }),
  ]
  Promise.all(motion.map(animation => animation.finished)).then(() => {
    if (id !== generation) return
    motion = []
    motionDone = undefined
    done()
  })
}

async function activate() {
  await nextTick()
  if (!mounted || !active.value || !props.open || !backdrop.value) return
  activateModalLayer(modalToken, backdrop.value, dialog.value, returnFocusTarget)
  focusInitial()
}

watch(() => props.open, open => {
  closeRequested = false
  if (open && active.value) {
    if (!leased && typeof document !== 'undefined') returnFocusTarget = document.activeElement
    modalZIndex.value = openModal(modalToken)
    leased = true
    if (mounted) activate()
  }
}, { immediate: true, flush: 'sync' })

function release() {
  if (!leased) return
  leased = false
  removeModal(modalToken)
  deactivateModalLayer(modalToken)
}
function handleAfterLeave() { if (!props.open || !active.value) release() }
function handleMotionPreference() {
  // Re-run from the current frame at duration zero, preserving completion hooks.
  if (motion.length && reducedMotion()) motion.forEach(animation => animation.finish?.())
}
function startListening() {
  if (listening) return
  listening = true
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('focusin', handleFocus)
  mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  mediaQuery?.addEventListener?.('change', handleMotionPreference)
}
function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('focusin', handleFocus)
  mediaQuery?.removeEventListener?.('change', handleMotionPreference)
}
function suspend() {
  active.value = false
  closeRequested = false
  backdropPress = false
  stopListening()
  const done = motionDone
  cancelMotion()
  done?.()
  release()
}
onMounted(() => {
  mounted = true
  startListening()
  if (props.open) activate()
})
onActivated(() => {
  if (active.value) return
  active.value = true
  startListening()
  if (props.open) {
    returnFocusTarget = document.activeElement
    modalZIndex.value = openModal(modalToken)
    leased = true
    activate()
  }
})
onDeactivated(suspend)
onBeforeUnmount(() => { mounted = false; suspend() })
</script>

<template>
  <Teleport to="body">
    <Transition :css="false" appear @enter="(el, done) => runMotion(el, true, done)" @leave="(el, done) => runMotion(el, false, done)" @after-leave="handleAfterLeave">
      <div v-if="open && active" ref="backdrop" class="modal-backdrop win-dialog-backdrop" :style="{ zIndex: modalZIndex }" @click.capture="blockLeavingClick" @pointerdown="handlePointerDown" @pointercancel="backdropPress = false" @click="handleBackdropClick">
        <div v-if="motionMode !== 'selector'" class="win-dialog-smoke" :style="{ backgroundColor: smokeBackground }" aria-hidden="true" />
        <section ref="dialog" class="modal" :class="[modalClass, { 'modal-headerless': headerless, 'win-acrylic-host': motionMode !== 'selector' }]" role="dialog" aria-modal="true" :aria-label="title || '对话框'" tabindex="-1">
          <AcrylicSurface v-if="motionMode !== 'selector'" />
          <header>
            <h2 v-if="!headerless">{{ title }}</h2>
            <button class="icon-button modal-close-button" type="button" title="关闭" aria-label="关闭" :disabled="!dismissible" @click="requestClose"><X :size="16" /></button>
          </header>
          <div class="modal-body"><slot /></div>
          <footer v-if="$slots.footer"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.win-dialog-backdrop { overscroll-behavior: contain; background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
.win-dialog-smoke { position: absolute; inset: 0; pointer-events: none; background: var(--dialog-smoke-background, #0000004d); }
.win-dialog-backdrop > .modal { position: relative; z-index: 1; transform-origin: center; }
.win-dialog-backdrop > .modal:focus { outline: none; }
</style>
