<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue'
import { checkboxCheckAnimation, CHECKBOX_CHECK_PATH, CHECKBOX_MIXED_PATH, CHECKBOX_CHECK_TRANSFORM, CHECKBOX_MIXED_TRANSFORM } from '../checkboxMotion'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [Boolean, Array], default: undefined },
  checked: { type: Boolean, default: undefined },
  value: { default: 'on' },
  indeterminate: Boolean,
  disabled: Boolean,
  readonly: Boolean,
})
const emit = defineEmits(['update:modelValue', 'update:checked', 'update:indeterminate', 'change'])
const attrs = useAttrs()
const input = ref(null)
const checkPath = ref(null)
const pressed = ref(false)
const isChecked = computed(() => Array.isArray(props.modelValue)
  ? props.modelValue.includes(props.value)
  : props.modelValue !== undefined ? props.modelValue : Boolean(props.checked))
const inputAttrs = computed(() => {
  const { class: ignoredClass, style: ignoredStyle, ...rest } = attrs
  return rest
})
let heldSpace = false
let pointerId = null
let form = null
let mounted = false
let media = null
let animation = null
const initialChecked = isChecked.value
const initialIndeterminate = props.indeterminate

function syncInput() {
  if (!input.value) return
  input.value.checked = isChecked.value
  input.value.indeterminate = props.indeterminate
}
function stopMotion() {
  const previous = animation
  animation = null
  if (!previous) return
  previous.onfinish = null
  previous.oncancel = null
  previous.cancel()
}
function animateCheck(checked) {
  stopMotion()
  if (!mounted || props.disabled || props.indeterminate || media?.matches || !checkPath.value?.animate) return
  const { frames, options } = checkboxCheckAnimation(checked, pressed.value)
  try {
    animation = checkPath.value.animate(frames, options)
    const current = animation
    current.onfinish = current.oncancel = () => { if (animation === current) stopMotion() }
  } catch { stopMotion() }
}
function requestChange(checked, event, indeterminate = false) {
  syncInput()
  if (props.disabled || props.readonly) return
  if (checked === isChecked.value && indeterminate === props.indeterminate) return
  // Arrays are replaced, never mutated. `value` is a stable id or object identity.
  let next = checked
  if (Array.isArray(props.modelValue)) {
    next = checked
      ? isChecked.value ? [...props.modelValue] : [...props.modelValue, props.value]
      : props.modelValue.filter(value => value !== props.value)
  }
  emit('update:modelValue', next)
  emit('update:checked', checked)
  if (props.indeterminate !== indeterminate) emit('update:indeterminate', indeterminate)
  emit('change', next, event)
  nextTick(syncInput)
}
function onChange(event) {
  requestChange(event.target.checked, event)
}
function onClick(event) {
  if (!props.disabled && !props.readonly) return
  event.preventDefault()
  syncInput()
  nextTick(syncInput)
}
function clearPressed() {
  heldSpace = false
  pointerId = null
  pressed.value = false
}
function onPointerDown(event) {
  if (props.disabled || props.readonly || event.button !== 0 || event.isPrimary === false) return
  pointerId = event.pointerId
  pressed.value = true
}
function onPointerEnd(event) {
  if (pointerId === event.pointerId) clearPressed()
}
function onKeyDown(event) {
  if (event.key !== ' ' || props.disabled || props.readonly) return
  event.preventDefault()
  if (event.repeat || heldSpace) return
  heldSpace = true
  pressed.value = true
}
function onKeyUp(event) {
  if (event.key !== ' ') return
  event.preventDefault()
  const shouldToggle = heldSpace && !props.disabled && !props.readonly
  clearPressed()
  if (shouldToggle) input.value?.click()
}
function onFormReset(event) {
  nextTick(() => {
    if (!mounted || event.defaultPrevented) return
    clearPressed()
    requestChange(initialChecked, event, initialIndeterminate)
  })
}
watch(() => [isChecked.value, props.indeterminate], ([checked, mixed], [previous, wasMixed]) => {
  syncInput()
  if (mixed || wasMixed) stopMotion()
  else if (checked !== previous) animateCheck(checked)
}, { flush: 'post' })
watch(() => [props.disabled, props.readonly], () => {
  clearPressed()
  stopMotion()
  nextTick(syncInput)
})
onMounted(() => {
  mounted = true
  media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', stopMotion)
  syncInput()
  form = input.value?.form
  form?.addEventListener('reset', onFormReset)
  window.addEventListener('blur', clearPressed)
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
})
onBeforeUnmount(() => {
  mounted = false
  stopMotion()
  media?.removeEventListener?.('change', stopMotion)
  form?.removeEventListener('reset', onFormReset)
  window.removeEventListener('blur', clearPressed)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
})
defineExpose({ focus: () => input.value?.focus(), input })
</script>

<template>
  <span class="win-checkbox" :class="[attrs.class, { 'is-checked': isChecked, 'is-mixed': indeterminate, 'is-pressed': pressed, 'is-disabled': disabled }]" :style="attrs.style">
    <input
      ref="input" v-bind="inputAttrs" class="win-checkbox-input" type="checkbox" :value="value"
      :checked="isChecked" :indeterminate="indeterminate" :disabled="disabled" :aria-checked="indeterminate ? 'mixed' : isChecked"
      :aria-readonly="readonly || undefined" data-reveal="off"
      @change="onChange" @click="onClick" @blur="clearPressed"
      @pointerdown="onPointerDown" @pointerleave="clearPressed" @pointercancel="onPointerEnd"
      @keydown="onKeyDown" @keyup="onKeyUp"
    >
    <span class="win-checkbox-box" aria-hidden="true">
      <svg class="win-checkbox-mark" :class="{ 'is-mixed': indeterminate }" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path ref="checkPath" class="win-checkbox-check" :d="CHECKBOX_CHECK_PATH" :transform="CHECKBOX_CHECK_TRANSFORM" pathLength="1" />
        <path class="win-checkbox-mixed" :d="CHECKBOX_MIXED_PATH" :transform="CHECKBOX_MIXED_TRANSFORM" pathLength="1" />
      </svg>
    </span>
  </span>
</template>

<style scoped>
/* CheckBox_themeresources.xaml, WindowsAppSDK 1.8.11: 20px box in a 32px
   target, 1px border, 4px radius. Glyph geometry, trim direction, frame counts
   and draw curve are translated from AnimatedAcceptVisualSource.cpp. */
.win-checkbox { position: relative; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 20px; width: 20px; height: 32px; vertical-align: middle; isolation: isolate; }
.win-checkbox > .win-checkbox-input {
  position: absolute; inset: 0; z-index: 2; appearance: none;
  width: 100%; min-width: 0; height: 100%; min-height: 0;
  margin: 0; padding: 0; border: 0; border-radius: 4px; opacity: 0;
  background: transparent; box-shadow: none; cursor: default; transform: none; transition: none;
}
.win-checkbox > .win-checkbox-input::before,
.win-checkbox > .win-checkbox-input::after { content: none; }
.win-checkbox-box {
  display: block; position: relative; width: 20px; height: 20px;
  border: 1px solid var(--win-control-stroke-strong, rgba(255, 255, 255, .5442)); border-radius: 4px;
  background: var(--win-control-alt-fill, rgba(0, 0, 0, .1));
  color: var(--accent-ink, #000); pointer-events: none;
  transition: background-color 83ms linear, border-color 83ms linear;
}
.win-checkbox:not(.is-disabled):hover .win-checkbox-box { background: var(--win-control-alt-hover, rgba(255, 255, 255, .0419)); }
.win-checkbox.is-checked .win-checkbox-box,
.win-checkbox.is-mixed .win-checkbox-box { background: var(--accent, #60cdff); border-color: transparent; }
.win-checkbox.is-checked:not(.is-disabled):hover .win-checkbox-box,
.win-checkbox.is-mixed:not(.is-disabled):hover .win-checkbox-box { background: color-mix(in srgb, var(--accent, #60cdff) 90%, transparent); }
.win-checkbox.is-pressed:not(.is-disabled) .win-checkbox-box { background: var(--win-control-alt-pressed, rgba(255, 255, 255, .0698)); border-color: var(--win-control-stroke-disabled, rgba(255, 255, 255, .1581)); }
.win-checkbox.is-pressed:is(.is-checked, .is-mixed):not(.is-disabled) .win-checkbox-box { background: color-mix(in srgb, var(--accent, #60cdff) 80%, transparent); border-color: transparent; }
.win-checkbox-mark { position: absolute; width: 20px; height: 20px; left: -1px; top: 0; }
.win-checkbox-mark.is-mixed { top: -1px; }
.win-checkbox-check, .win-checkbox-mixed { stroke: currentColor; stroke-width: 4px; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; }
.is-checked:not(.is-mixed) .win-checkbox-check,
.is-mixed .win-checkbox-mixed { stroke-dashoffset: 0; opacity: 1; }
.win-checkbox.is-disabled .win-checkbox-box { background: transparent; border-color: var(--win-control-stroke-disabled, rgba(255, 255, 255, .1581)); color: var(--win-text-disabled, rgba(255, 255, 255, .3628)); }
.win-checkbox.is-disabled:is(.is-checked, .is-mixed) .win-checkbox-box { background: var(--win-control-stroke-disabled, rgba(255, 255, 255, .1581)); border-color: transparent; }
.win-checkbox-input:focus-visible + .win-checkbox-box { outline: 2px solid var(--win-focus, #fff); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .win-checkbox-box, .win-checkbox-check, .win-checkbox-mixed { transition: none; } }
@media (forced-colors: active) {
  .win-checkbox-box { background: ButtonFace; border-color: ButtonText; color: ButtonText; forced-color-adjust: none; }
  .win-checkbox:is(.is-checked, .is-mixed):not(.is-disabled) .win-checkbox-box { background: Highlight; border-color: Highlight; color: HighlightText; }
  .win-checkbox.is-disabled .win-checkbox-box { background: ButtonFace; border-color: GrayText; color: GrayText; }
  .win-checkbox-input:focus-visible + .win-checkbox-box { outline-color: ButtonText; }
}
</style>
