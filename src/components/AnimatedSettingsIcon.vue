<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { createSettingsIconMotion, settingsIconState, SETTINGS_ICON_PATH, SETTINGS_ICON_TRANSFORM } from '../settingsIconMotion'

const props = defineProps({
  size: { type: [Number, String], default: 20 },
  state: { type: String, default: undefined },
  disabled: Boolean,
})
const svg = ref(null)
const rotor = ref(null)
const pointerOver = ref(false)
const focused = ref(false)
const pressed = ref(false)
const parentDisabled = ref(false)
const visualState = computed(() => props.disabled || parentDisabled.value ? 'Disabled'
  : props.state !== undefined ? settingsIconState(props.state)
    : pressed.value ? 'Pressed' : pointerOver.value || focused.value ? 'PointerOver' : 'Normal')
let button = null
let media = null
let motion = null
let observer = null
let frame = 0
let activePointer = null
let activeKey = null
let active = false
let mounted = false

function schedule() {
  if (!active || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    if (active) motion?.select(visualState.value)
  })
}
function clearInteraction() {
  activePointer = null
  activeKey = null
  pressed.value = false
}
function onEnter(event) {
  if (event.pointerType === 'touch') return
  pointerOver.value = true
  if (activePointer === event.pointerId && event.buttons === 1) pressed.value = true
}
function onLeave() {
  pointerOver.value = false
  pressed.value = false
}
function onDown(event) {
  if (parentDisabled.value || props.disabled || event.button !== 0 || event.isPrimary === false) return
  activePointer = event.pointerId
  pressed.value = true
}
function onUp(event) {
  if (activePointer !== event.pointerId) return
  clearInteraction()
}
function onFocus() { focused.value = true }
function onBlur(event) {
  if (button?.contains(event.relatedTarget)) return
  focused.value = false
  clearInteraction()
}
function onKeyDown(event) {
  if (parentDisabled.value || props.disabled || event.repeat || activeKey || ![' ', 'Enter'].includes(event.key)) return
  activeKey = event.key
  pressed.value = true
}
function onKeyUp(event) {
  if (activeKey === event.key) clearInteraction()
}
function syncDisabled() {
  parentDisabled.value = Boolean(button?.disabled || button?.getAttribute('aria-disabled') === 'true')
  if (parentDisabled.value) clearInteraction()
}
function stopImmediately() {
  clearInteraction()
  pointerOver.value = false
  focused.value = false
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  motion?.select('Normal', { immediate: true })
}
function onMotionPreference() {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  motion?.select(visualState.value, { immediate: true })
}
const buttonListeners = {
  pointerenter: onEnter, pointerleave: onLeave, pointerdown: onDown,
  focusin: onFocus, focusout: onBlur, keydown: onKeyDown, keyup: onKeyUp,
}
watch(visualState, state => {
  if (state === 'Disabled') {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    motion?.select(state, { immediate: true })
  } else schedule()
}, { flush: 'post' })
onMounted(() => {
  mounted = true
  active = true
  button = svg.value?.closest('button, [role="button"]')
  media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  motion = createSettingsIconMotion({ element: rotor.value, reducedMotion: () => Boolean(media?.matches) })
  if (button) {
    for (const [name, listener] of Object.entries(buttonListeners)) button.addEventListener(name, listener)
    focused.value = button.contains(document.activeElement)
    syncDisabled()
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(syncDisabled)
      observer.observe(button, { attributes: true, attributeFilter: ['disabled', 'aria-disabled'] })
    }
  }
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  window.addEventListener('blur', stopImmediately)
  media?.addEventListener?.('change', onMotionPreference)
  motion.select(visualState.value, { immediate: true })
})
onActivated(() => {
  if (!mounted) return
  active = true
  syncDisabled()
  schedule()
})
onDeactivated(() => {
  active = false
  stopImmediately()
})
onBeforeUnmount(() => {
  mounted = false
  active = false
  if (frame) cancelAnimationFrame(frame)
  motion?.dispose()
  observer?.disconnect()
  for (const [name, listener] of Object.entries(buttonListeners)) button?.removeEventListener(name, listener)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  window.removeEventListener('blur', stopImmediately)
  media?.removeEventListener?.('change', onMotionPreference)
})
</script>

<template>
  <svg ref="svg" class="win-animated-settings" :width="size" :height="size" viewBox="0 0 48 48" fill="currentColor" aria-hidden="true" focusable="false">
    <g ref="rotor" class="win-settings-rotor">
      <path :d="SETTINGS_ICON_PATH" :transform="SETTINGS_ICON_TRANSFORM" fill-rule="nonzero" />
    </g>
  </svg>
</template>

<style scoped>
.win-animated-settings { display: block; flex: 0 0 auto; overflow: visible; transform: none; transition: none; pointer-events: none; }
.win-settings-rotor { transform-box: view-box; transform-origin: 50% 50%; }
</style>
