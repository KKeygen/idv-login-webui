<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue'
import { switchDragOffset, switchDragResult, switchKnobGeometry } from '../winSwitchState'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: Boolean,
  disabled: Boolean,
  readonly: Boolean,
})
// change(requestedBoolean, originalEvent), with originalEvent.target.checked
// restored to the confirmed prop before delivery. Server-controlled settings
// use :model-value + @change; local settings can use v-model directly.
const emit = defineEmits(['update:modelValue', 'change'])
const attrs = useAttrs()
const input = ref(null)
const hover = ref(false)
const pressed = ref(false)
const dragging = ref(false)
const dragOffset = ref(0)
const knob = computed(() => switchKnobGeometry(props.modelValue, props.disabled ? 'normal' : pressed.value ? 'pressed' : hover.value ? 'hover' : 'normal'))
const knobStyle = computed(() => ({ width: `${knob.value.width}px`, height: `${knob.value.height}px`, left: `${knob.value.left}px` }))
const translation = computed(() => dragging.value ? dragOffset.value : props.modelValue ? 20 : 0)
const inputAttrs = computed(() => {
  const { class: ignoredClass, style: ignoredStyle, ...rest } = attrs
  return rest
})
let pointer = null
let heldSpace = false
let suppressClick = false
let suppressTimer = null
let form = null
let mounted = false
const initialValue = props.modelValue

function syncInput() {
  if (input.value) input.value.checked = props.modelValue
}
function requestChange(next, event) {
  syncInput()
  if (props.disabled || props.readonly || next === props.modelValue) return
  emit('update:modelValue', next)
  emit('change', next, event)
  // Vue may not patch `checked` if the controlled value was deliberately kept
  // unchanged (confirmation dialogs, failed POST, unsupported capability).
  nextTick(syncInput)
}
function onChange(event) {
  requestChange(event.target.checked, event)
}
function onClick(event) {
  if (!props.disabled && !props.readonly && !suppressClick) return
  event.preventDefault()
  syncInput()
  nextTick(syncInput)
}
function blockNextClick() {
  suppressClick = true
  clearTimeout(suppressTimer)
  // Pointer-generated click is dispatched in the same task as pointerup.
  suppressTimer = setTimeout(() => { suppressClick = false; suppressTimer = null }, 0)
}
function clearPointer() {
  const previous = pointer
  pointer = null
  dragging.value = false
  pressed.value = false
  if (previous && input.value?.hasPointerCapture?.(previous.id)) input.value.releasePointerCapture(previous.id)
}
function cancelInteraction() {
  if (pointer?.moved) blockNextClick()
  clearPointer()
  heldSpace = false
}
function onPointerDown(event) {
  if (props.disabled || props.readonly || event.button !== 0 || event.isPrimary === false || pointer) return
  heldSpace = false
  pointer = { id: event.pointerId, x: event.clientX, checked: props.modelValue, moved: false }
  dragOffset.value = props.modelValue ? 20 : 0
  pressed.value = true
  input.value?.focus({ preventScroll: true })
  input.value?.setPointerCapture?.(event.pointerId)
}
function onPointerMove(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  const delta = event.clientX - pointer.x
  if (!pointer.moved && Math.abs(delta) < 2) return
  pointer.moved = true
  dragging.value = true
  dragOffset.value = switchDragOffset(pointer.checked, delta)
}
function onPointerUp(event) {
  if (!pointer || pointer.id !== event.pointerId) return
  const current = pointer
  const next = switchDragResult(current.checked, dragOffset.value)
  if (current.moved) blockNextClick()
  clearPointer()
  if (current.moved) requestChange(next, event)
}
function onPointerCancel(event) {
  if (pointer?.id === event.pointerId) cancelInteraction()
}
function onKeyDown(event) {
  if (event.key !== ' ' || props.disabled || props.readonly || pointer) return
  event.preventDefault()
  if (event.repeat || heldSpace) return
  heldSpace = true
  pressed.value = true
}
function onKeyUp(event) {
  if (event.key !== ' ') return
  event.preventDefault()
  const shouldToggle = heldSpace && !props.disabled && !props.readonly
  heldSpace = false
  pressed.value = false
  if (shouldToggle) input.value?.click()
}
function onBlur() {
  cancelInteraction()
  hover.value = false
}
function onFormReset(event) {
  nextTick(() => {
    if (!mounted || event.defaultPrevented) return
    cancelInteraction()
    requestChange(initialValue, event)
  })
}
watch(() => [props.modelValue, props.disabled, props.readonly], () => {
  cancelInteraction()
  if (props.disabled) hover.value = false
  nextTick(syncInput)
})
onMounted(() => {
  mounted = true
  form = input.value?.form
  form?.addEventListener('reset', onFormReset)
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  mounted = false
  cancelInteraction()
  clearTimeout(suppressTimer)
  form?.removeEventListener('reset', onFormReset)
  window.removeEventListener('blur', onBlur)
})
defineExpose({ focus: () => input.value?.focus(), input })
</script>

<template>
  <span class="win-switch" :class="[attrs.class, { 'is-on': modelValue, 'is-hover': hover && !disabled, 'is-pressed': pressed && !disabled, 'is-disabled': disabled, 'is-dragging': dragging }]" :style="attrs.style">
    <input
      ref="input" v-bind="inputAttrs" class="win-switch-input" type="checkbox" role="switch"
      :checked="modelValue" :disabled="disabled" :aria-checked="modelValue" :aria-readonly="readonly || undefined"
      data-reveal="off" @change="onChange" @click="onClick" @blur="onBlur"
      @pointerenter="hover = $event.pointerType !== 'touch'" @pointerleave="hover = false"
      @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
      @pointercancel="onPointerCancel" @lostpointercapture="onPointerCancel"
      @keydown="onKeyDown" @keyup="onKeyUp"
    >
    <span class="win-switch-track" aria-hidden="true">
      <span class="win-switch-on-track" />
      <span class="win-switch-knob-position" :style="{ transform: `translateX(${translation}px)` }">
        <span class="win-switch-knob" :style="knobStyle" />
      </span>
    </span>
  </span>
</template>

<style scoped>
.win-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 40px;
  width: 40px;
  height: 32px;
  vertical-align: middle;
  isolation: isolate;
}
.win-switch > .win-switch-input {
  position: absolute;
  inset: 0;
  z-index: 2;
  appearance: none;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  opacity: 0;
  background: transparent;
  box-shadow: none;
  cursor: default;
  transform: none;
  transition: none;
  touch-action: pan-y;
}
.win-switch > .win-switch-input::before,
.win-switch > .win-switch-input::after { content: none; }
.win-switch-track {
  position: relative;
  display: block;
  width: 40px;
  height: 20px;
  border: 0;
  border-radius: 10px;
  background: var(--win-switch-off, rgba(0, 0, 0, .1));
  box-shadow: inset 0 0 0 1px var(--win-switch-stroke, rgba(255, 255, 255, .5442));
  pointer-events: none;
  transition: background-color 83ms linear, box-shadow 83ms linear;
}
.win-switch-on-track { position: absolute; inset: 0; display: block; border-radius: inherit; background: var(--accent, #60cdff); opacity: 0; transition: opacity 83ms linear; }
.is-on .win-switch-on-track { opacity: 1; }
.is-hover .win-switch-track { background: var(--win-switch-off-hover, rgba(255, 255, 255, .0419)); }
.is-hover .win-switch-on-track { background: color-mix(in srgb, var(--accent, #60cdff) 90%, transparent); }
.is-pressed .win-switch-track { background: var(--win-switch-off-pressed, rgba(255, 255, 255, .0698)); }
.is-pressed .win-switch-on-track { background: color-mix(in srgb, var(--accent, #60cdff) 80%, transparent); }
.win-switch-knob-position {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  width: 20px;
  height: 20px;
  transition: transform 167ms cubic-bezier(0.1, 0.9, 0.2, 1);
}
.win-switch-knob {
  position: absolute;
  display: block;
  top: 50%;
  border-radius: 7px;
  background: var(--win-switch-knob-off, rgba(255, 255, 255, .786));
  transform: translateY(-50%);
  transition: width 83ms cubic-bezier(0, 0, 0, 1), height 83ms cubic-bezier(0, 0, 0, 1), left 83ms cubic-bezier(0, 0, 0, 1), background-color 83ms linear;
}
.is-on .win-switch-knob { background: var(--accent-ink, #000); }
.is-dragging .win-switch-knob-position { transition: none; }
.is-disabled .win-switch-track { background: var(--win-switch-off-disabled, transparent); box-shadow: inset 0 0 0 1px var(--win-switch-stroke-disabled, rgba(255, 255, 255, .1581)); }
.is-disabled .win-switch-on-track { background: var(--win-switch-on-disabled, rgba(255, 255, 255, .1581)); }
.is-disabled .win-switch-knob { background: var(--win-text-disabled, rgba(255, 255, 255, .3628)); }
.win-switch-input:focus-visible + .win-switch-track { outline: 2px solid var(--win-focus, #fff); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .win-switch-track, .win-switch-on-track, .win-switch-knob-position, .win-switch-knob { transition: none; }
}
@media (forced-colors: active) {
  .win-switch-track { background: ButtonFace; box-shadow: inset 0 0 0 1px ButtonText; forced-color-adjust: none; }
  .win-switch-knob { background: ButtonText; }
  .is-on .win-switch-on-track { background: Highlight; }
  .is-on .win-switch-knob { background: HighlightText; }
  .is-disabled .win-switch-track { box-shadow: inset 0 0 0 1px GrayText; }
  .is-disabled .win-switch-on-track { background: ButtonFace; }
  .is-disabled .win-switch-knob { background: GrayText; }
  .win-switch-input:focus-visible + .win-switch-track { outline-color: ButtonText; }
}
</style>
