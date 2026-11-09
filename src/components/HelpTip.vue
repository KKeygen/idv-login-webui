<script setup>
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue'
import { CircleHelp } from '@lucide/vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { claimTooltip, inTooltipSafeZone, markTooltipVisible, registerTooltip, releaseTooltip, TOOLTIP_TIMING, unregisterTooltip } from './tooltipCoordinator'

const props = defineProps({
  text: { type: String, required: true },
  label: { type: String, default: '查看说明' },
  disabled: Boolean,
  // WinUI ToolTipService: 2 × SPI_GETMOUSEHOVERTIME (default 400 ms)
  // for first mouse/keyboard entry. Browsers cannot read that OS preference.
  delay: { type: Number, default: undefined },
})
const id = `help-tip-${useId()}`
const trigger = ref(null)
const tooltip = ref(null)
const shown = ref(false)
const portal = ref('body')
const position = ref({})
let showTimer
let safeZoneTimer
let pointer = null
let pointerAtOpen = null
let inputMode = 'mouse'
const token = Symbol('help-tip')
let dismissed = false
let alive = false
let listening = false

function clearTimers() { clearTimeout(showTimer); clearInterval(safeZoneTimer); showTimer = undefined; safeZoneTimer = undefined }
function hide(suppress = false) { clearTimers(); releaseTooltip(token); shown.value = false; if (suppress) dismissed = true }
async function show() {
  clearTimers()
  if (props.disabled || !props.text || !alive || dismissed) return
  portal.value = trigger.value?.closest('.modal-backdrop') || 'body'
  if (!markTooltipVisible(token)) return
  shown.value = true
  pointerAtOpen = pointer && { ...pointer }
  safeZoneTimer = setInterval(checkSafeZone, TOOLTIP_TIMING.safeZoneCheck)
  await nextTick()
  if (!alive || !shown.value || !trigger.value || !tooltip.value) return
  const rect = trigger.value.getBoundingClientRect()
  const box = tooltip.value.getBoundingClientRect()
  const width = document.documentElement.clientWidth || window.innerWidth
  const height = document.documentElement.clientHeight || window.innerHeight
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - box.width / 2, width - box.width - 8))
  const top = rect.top - box.height - 8 >= 8 ? rect.top - box.height - 8 : Math.min(rect.bottom + 8, height - box.height - 8)
  position.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
}
function schedule(mode = inputMode) {
  if (!alive || shown.value || dismissed || props.disabled || !props.text) return
  inputMode = mode
  const delay = claimTooltip(token, () => hide(true), mode, props.delay)
  if (delay === null) return
  clearTimeout(showTimer)
  showTimer = setTimeout(show, delay)
}
function checkSafeZone() {
  if (!shown.value || !pointer || !trigger.value || !tooltip.value) return
  // The source keeps a keyboard-opened tooltip if the cursor has not moved.
  if (pointerAtOpen && pointer.x === pointerAtOpen.x && pointer.y === pointerAtOpen.y) return
  if (!inTooltipSafeZone(pointer, trigger.value.getBoundingClientRect(), tooltip.value.getBoundingClientRect())) hide()
}
function handlePointerMove(event) {
  pointer = { x: event.clientX, y: event.clientY }
  checkSafeZone()
}
function handlePointerEnter(event) {
  pointer = { x: event.clientX, y: event.clientY }
  schedule(event.pointerType === 'touch' ? 'touch' : 'mouse')
}
function handlePointerLeave(event) {
  pointer = { x: event.clientX, y: event.clientY }
  if (!shown.value) hide()
  dismissed = false
  // Open tips stay alive inside the native convex safe zone, not a time bridge.
}

function handleClick(event) {
  event.preventDefault()
  event.stopPropagation()
  if (!alive || props.disabled) return
  if (shown.value) hide(true)
  else { dismissed = false; claimTooltip(token, () => hide(true), 'keyboard', 0); show() }
}
function handleKeydown(event) {
  if (event.key === 'Escape' && (shown.value || showTimer !== undefined)) {
    event.preventDefault()
    event.stopImmediatePropagation()
    hide(true)
  }
}
function handleFocus() { schedule('keyboard') }
function handleBlur() { hide(); dismissed = false }
function handleOutside(event) {
  if ((shown.value || showTimer !== undefined) && !trigger.value?.contains(event.target) && !tooltip.value?.contains(event.target)) hide(true)
}
function handleWindowBlur() { hide(); dismissed = false }
function handleVisibility() { if (document.hidden) handleWindowBlur() }
function handleViewportChange(event) {
  if (shown.value && !tooltip.value?.contains(event.target)) hide()
}
watch(() => props.disabled, disabled => { if (disabled) hide() })
watch(() => props.text, text => { if (!text) hide(); else if (shown.value) show() })
function activate() {
  alive = true
  registerTooltip(token)
  if (listening) return
  listening = true
  document.addEventListener('keydown', handleKeydown, true)
  document.addEventListener('pointermove', handlePointerMove, true)
  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('visibilitychange', handleVisibility)
  document.addEventListener('pointerdown', handleOutside, true)
  document.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
}
function suspend() {
  alive = false
  hide()
  pointer = null
  pointerAtOpen = null
  unregisterTooltip(token)
  dismissed = false
  if (!listening) return
  listening = false
  document.removeEventListener('keydown', handleKeydown, true)
  document.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('blur', handleWindowBlur)
  document.removeEventListener('visibilitychange', handleVisibility)
  document.removeEventListener('pointerdown', handleOutside, true)
  document.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
}
onMounted(activate)
onActivated(activate)
onDeactivated(suspend)
onBeforeUnmount(suspend)
</script>

<template>
  <button ref="trigger" class="help-tip win-help-tip" type="button" :aria-label="label" :aria-describedby="shown ? id : undefined" :disabled="disabled" @pointerenter="handlePointerEnter" @pointerleave="handlePointerLeave" @pointercancel="handlePointerLeave" @focus="handleFocus" @blur="handleBlur" @click="handleClick">
    <CircleHelp :size="14" aria-hidden="true" />
  </button>
  <Teleport :to="portal">
    <span v-if="shown" :id="id" ref="tooltip" class="win-help-tip-content win-acrylic-host" :style="position" role="tooltip"><AcrylicSurface variant="default" />{{ text }}</span>
  </Teleport>
</template>

<style scoped>
.help-tip.win-help-tip { min-width: 18px; min-height: 18px; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: none; vertical-align: middle; }
.help-tip.win-help-tip:hover:not(:disabled), .help-tip.win-help-tip:focus-visible { color: #fff; background: #ffffff14; }
.help-tip.win-help-tip:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.help-tip.win-help-tip:disabled { opacity: .4; cursor: default; }
.win-help-tip-content.win-acrylic-host { position: fixed; z-index: 1100; box-sizing: border-box; width: max-content; max-width: min(320px, calc(100vw - 16px)); max-height: calc(100vh - 16px); overflow: auto; padding: 6px 9px 8px; border: 1px solid #00000033; border-radius: 4px; background: transparent; color: #fff; box-shadow: 0 4px 12px #0004; font-size: 12px; font-weight: 400; line-height: 1.5; text-align: start; white-space: normal; }
@media (forced-colors: active) { .win-help-tip-content { background: Canvas; color: CanvasText; border-color: CanvasText; } }
</style>
