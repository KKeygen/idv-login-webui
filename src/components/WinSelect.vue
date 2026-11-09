<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useAttrs, useId, watch } from 'vue'
import { ChevronDown } from '@lucide/vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { animateKeyframes, animateStyles, findTypeahead, nextEnabled, reducedMotion, selectPlacement, splitRect, SELECT_MOTION } from './winControlUtils'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, default: () => [] },
  disabled: Boolean,
  placeholder: { type: String, default: '' },
  name: { type: String, default: '' },
  maxHeight: { type: Number, default: 504 },
})
const emit = defineEmits(['update:modelValue', 'change', 'open', 'close'])
const attrs = useAttrs()
const uid = useId()
const listId = `win-select-${uid}-list`
const buttonId = computed(() => attrs.id || `win-select-${uid}`)
const button = ref(null)
const popup = ref(null)
const optionsViewport = ref(null)
const faceplate = ref(null)
const opened = ref(false)
const active = ref(true)
const activeIndex = ref(-1)
const keyboardNavigation = ref(false)
const pointerIndex = ref(-1)
const portal = ref('body')
const popupStyle = ref({})
const selectedIndex = computed(() => props.options.findIndex(option => Object.is(option.value, props.modelValue)))
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? props.placeholder)
let typeahead = ''
let typeaheadTimer
let motion = []
let motionGeneration = 0
let mounted = false
let mediaQuery
let motionDone
let rowHeight = 32
let anchor = 16
let popupHeight = 32
let popupWidth = 80
let openingPointer = null
let listening = false

function focus() { if (active.value) button.value?.focus({ preventScroll: true }) }
defineExpose({ focus, open: () => openPopup(), close: () => closePopup() })

function updatePosition(resetScroll = false, element = popup.value) {
  if (!active.value || !button.value || !element) return
  const rect = button.value.getBoundingClientRect()
  const triggerStyle = getComputedStyle(button.value)
  // Share the closed control's actual box model. Centering a fixed 32px row
  // over a font-sized 34px trigger shifts both its text and selected outline.
  rowHeight = rect.height || 32
  const inset = 5 // Popup's 4px padding plus its 1px border.
  const placement = selectPlacement(rect, { viewportWidth: document.documentElement.clientWidth || window.innerWidth, viewportHeight: document.documentElement.clientHeight || window.innerHeight, rowHeight, count: props.options.length, selectedIndex: selectedIndex.value, maxHeight: props.maxHeight, padding: inset, outset: inset, minWidth: 0 })
  // Native DropDownOffset follows the trigger center, even near viewport edges.
  anchor = rect.top + rect.height / 2 - placement.top
  popupHeight = placement.height
  popupWidth = placement.width
  popupStyle.value = { left: `${placement.left}px`, top: `${placement.top}px`, width: `${placement.width}px`, maxHeight: `${placement.height}px`, '--split-anchor': `${anchor}px`, '--split-row': `${rowHeight}px`, '--select-row-height': `${rowHeight}px`, '--select-option-padding': triggerStyle.padding, '--select-option-border-width': triggerStyle.borderWidth, '--select-option-radius': triggerStyle.borderRadius, fontFamily: triggerStyle.fontFamily, fontSize: triggerStyle.fontSize, fontWeight: triggerStyle.fontWeight, lineHeight: triggerStyle.lineHeight, letterSpacing: triggerStyle.letterSpacing }
  for (const [property, value] of Object.entries(popupStyle.value)) {
    if (property.startsWith('--')) element.style.setProperty(property, value)
    else element.style[property] = value
  }
  if (resetScroll && optionsViewport.value) optionsViewport.value.scrollTop = placement.scrollTop
}
async function scrollActive() {
  await nextTick()
  const viewport = optionsViewport.value
  if (!opened.value || !viewport || activeIndex.value < 0) return
  const option = viewport.querySelectorAll('[role="option"]')[activeIndex.value]
  if (!option) return
  const top = option.offsetTop
  const bottom = top + (option.offsetHeight || rowHeight)
  if (top < viewport.scrollTop) viewport.scrollTop = top
  else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = Math.max(0, bottom - viewport.clientHeight)
}
async function openPopup(preferredIndex) {
  if (!mounted || !active.value || props.disabled || opened.value || !props.options.length) return
  portal.value = button.value?.closest('.modal-backdrop') || 'body'
  activeIndex.value = preferredIndex ?? (selectedIndex.value >= 0 && !props.options[selectedIndex.value].disabled ? selectedIndex.value : nextEnabled(props.options, -1, 1))
  opened.value = true
  pointerIndex.value = -1
  focus()
  emit('open')
  await nextTick()
  if (!opened.value || !mounted || !active.value) return
  updatePosition(true)
  if (preferredIndex != null && preferredIndex !== selectedIndex.value) scrollActive()
}
function resetSearch() { typeahead = ''; clearTimeout(typeaheadTimer) }
function closePopup(restore = false) {
  if (!opened.value) return
  opened.value = false
  keyboardNavigation.value = false
  resetSearch()
  emit('close')
  if (restore) focus()
}
function commit(index) {
  const option = props.options[index]
  if (!opened.value || props.disabled || !option || option.disabled) return
  if (!Object.is(option.value, props.modelValue)) {
    emit('update:modelValue', option.value)
    // Compatible with existing @change="handler($event.target.value)" consumers.
    emit('change', { type: 'change', target: { value: option.value, name: props.name }, value: option.value })
  }
  closePopup(true)
}
function navigate(step) {
  activeIndex.value = nextEnabled(props.options, activeIndex.value, step, false)
  scrollActive()
}
function handleKeydown(event) {
  if (!active.value || props.disabled) return
  const key = event.key
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key) || (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)) keyboardNavigation.value = true
  if (key === 'Tab') { closePopup(); return }
  if (key === 'Escape' && opened.value) { event.preventDefault(); event.stopPropagation(); closePopup(true); return }
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault()
    if (event.altKey && opened.value) closePopup(true)
    else if (!opened.value) openPopup()
    else navigate(key === 'ArrowDown' ? 1 : -1)
  } else if (key === 'Home' || key === 'End') {
    event.preventDefault()
    const first = key === 'Home' ? nextEnabled(props.options, -1, 1) : nextEnabled(props.options, 0, -1)
    if (!opened.value) openPopup(first)
    else { activeIndex.value = first; scrollActive() }
  } else if (key === 'Enter' || (key === ' ' && !typeahead)) {
    event.preventDefault()
    if (opened.value) commit(activeIndex.value)
    else openPopup()
  } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    typeahead += key
    clearTimeout(typeaheadTimer)
    typeaheadTimer = setTimeout(resetSearch, 700)
    const repeat = [...typeahead].every(character => character.toLocaleLowerCase() === key.toLocaleLowerCase())
    const query = repeat ? key : typeahead
    const start = repeat ? activeIndex.value : activeIndex.value - 1
    const match = findTypeahead(props.options, query, start)
    if (match >= 0) {
      if (!opened.value) openPopup(match)
      else { activeIndex.value = match; scrollActive() }
    }
  }
}
function handleOutside(event) {
  if (opened.value && !button.value?.contains(event.target) && !popup.value?.contains(event.target)) closePopup()
}
function handleScroll(event) {
  if (opened.value && !popup.value?.contains(event.target)) updatePosition()
}
function handleWindowBlur() { closePopup() }
function handleVisibility() { if (document.hidden) closePopup() }
function handlePointerDown(event) { keyboardNavigation.value = false; openingPointer = { x: event.clientX, y: event.clientY } }
function handleResize() { if (opened.value) { updatePosition(true); if (keyboardNavigation.value) scrollActive() } }
function cancelMotion() { motionGeneration += 1; motion.forEach(animation => animation.cancel()); motion = []; motionDone = undefined }
function runMotion(element, entering, done) {
  if (!active.value) { cancelMotion(); done(); return }
  updatePosition(entering, element)
  const style = getComputedStyle(element)
  const interrupted = motion.length > 0
  const fromClip = interrupted ? style.clip : splitRect(popupHeight, anchor, entering ? 'open-start' : 'full', popupWidth)
  const toClip = splitRect(popupHeight, anchor, entering ? 'full' : 'closed', popupWidth)
  const opacity = interrupted ? style.opacity : '1'
  const labelOpacity = interrupted && faceplate.value ? getComputedStyle(faceplate.value).opacity : entering ? '1' : '0'
  cancelMotion()
  const id = motionGeneration
  motionDone = done
  const duration = reducedMotion() ? 0 : SELECT_MOTION[entering ? 'enter' : 'leave']
  const fadeAt = SELECT_MOTION.closeOpacityDelay / SELECT_MOTION.leave
  motion = [animateStyles(element, { clip: fromClip }, { clip: toClip }, { duration, easing: SELECT_MOTION.easing })]
  if (entering) {
    // SplitOpen sets popup opacity to one immediately; only the faceplate fades.
    element.style.opacity = '1'
    if (faceplate.value) motion.push(animateStyles(faceplate.value, { opacity: labelOpacity }, { opacity: '.5' }, { duration: reducedMotion() ? 0 : SELECT_MOTION.opacity }))
  } else {
    motion.push(animateKeyframes(element, [{ opacity, offset: 0 }, { opacity, offset: fadeAt }, { opacity: '0', offset: 1 }], { duration }))
    if (faceplate.value) motion.push(animateKeyframes(faceplate.value, [{ opacity: labelOpacity, offset: 0 }, { opacity: labelOpacity, offset: fadeAt }, { opacity: '1', offset: 1 }], { duration }))
  }
  Promise.all(motion.map(animation => animation.finished)).then(() => {
    if (id !== motionGeneration) return
    motion = []
    motionDone = undefined
    done()
  })
}
function handleMotionPreference() {
  if (reducedMotion() && motionDone) { const done = motionDone; cancelMotion(); done() }
}
function optionPointerMove(index, event) {
  // Do not overwrite keyboard focus just because an option appeared under a
  // stationary pointer when the selected-row-anchored popup opened.
  if (openingPointer && openingPointer.x === event.clientX && openingPointer.y === event.clientY) return
  openingPointer = { x: event.clientX, y: event.clientY }
  keyboardNavigation.value = false
  pointerIndex.value = index
  if (!props.options[index].disabled) activeIndex.value = index
}
watch(() => props.disabled, disabled => { if (disabled) closePopup() })
watch(() => props.options, () => {
  if (!opened.value) return
  if (!props.options.length) { closePopup(); return }
  if (activeIndex.value >= props.options.length || props.options[activeIndex.value]?.disabled) activeIndex.value = nextEnabled(props.options, -1, 1)
  nextTick(() => updatePosition(true))
}, { deep: true })
watch(selectedIndex, () => { if (opened.value) { activeIndex.value = selectedIndex.value; nextTick(() => updatePosition(true)) } })
function startListening() {
  if (listening) return
  listening = true
  document.addEventListener('pointerdown', handleOutside, true)
  document.addEventListener('focusin', handleOutside)
  document.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('visibilitychange', handleVisibility)
  mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  mediaQuery?.addEventListener?.('change', handleMotionPreference)
}
function stopListening() {
  if (!listening) return
  listening = false
  document.removeEventListener('pointerdown', handleOutside, true)
  document.removeEventListener('focusin', handleOutside)
  document.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('blur', handleWindowBlur)
  document.removeEventListener('visibilitychange', handleVisibility)
  mediaQuery?.removeEventListener?.('change', handleMotionPreference)
}
function suspend() {
  active.value = false
  closePopup()
  resetSearch()
  activeIndex.value = -1
  openingPointer = null
  // Complete Vue's pending transition as well as canceling its WAAPI work.
  // Teleport children otherwise remain in body while the page is cached.
  const done = motionDone
  cancelMotion()
  done?.()
  if (faceplate.value) faceplate.value.style.opacity = '1'
  stopListening()
}
onMounted(() => { mounted = true; startListening() })
onActivated(() => { active.value = true; startListening() })
onDeactivated(suspend)
onBeforeUnmount(() => { mounted = false; suspend() })
</script>

<template>
  <button :id="buttonId" ref="button" v-bind="attrs" class="win-select" type="button" role="combobox" aria-haspopup="listbox" :aria-expanded="opened" :aria-controls="listId" :aria-activedescendant="opened && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined" :disabled="disabled" :data-open="opened" @keydown="handleKeydown" @pointerdown="handlePointerDown" @click="opened ? closePopup(true) : openPopup()">
    <span ref="faceplate" class="win-select-label" :class="{ 'is-placeholder': selectedIndex < 0 }">{{ selectedLabel }}</span>
    <ChevronDown class="win-select-chevron" :size="12" aria-hidden="true" />
  </button>
  <input v-if="name" type="hidden" :name="name" :value="modelValue" :disabled="disabled" />
  <Teleport :to="portal">
    <Transition :css="false" @enter="(el, done) => runMotion(el, true, done)" @leave="(el, done) => runMotion(el, false, done)">
      <div v-if="opened && active" :id="listId" ref="popup" class="win-select-popup win-acrylic-host" :style="popupStyle" role="listbox" :aria-labelledby="buttonId" @pointerleave="pointerIndex = -1" @pointerdown.prevent>
        <div class="win-select-material" aria-hidden="true"><AcrylicSurface variant="default" /></div>
        <ul ref="optionsViewport" class="win-select-options" role="presentation">
        <li v-for="(option, index) in options" :id="`${listId}-${index}`" :key="`${typeof option.value}:${String(option.value)}`" role="option" :aria-selected="Object.is(option.value, modelValue)" :aria-disabled="!!option.disabled" :data-keyboard-active="keyboardNavigation && activeIndex === index" class="win-select-option" :class="{ 'is-selected': Object.is(option.value, modelValue), 'is-active': activeIndex === index, 'is-pointer-over': pointerIndex === index, 'is-disabled': option.disabled }" @pointermove="optionPointerMove(index, $event)" @click.stop="commit(index)">
          <span class="win-select-pill" aria-hidden="true" />
          <span>{{ option.label }}</span>
        </li>
        </ul>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ComboBox resources at WinUI ba3b6cd9. These are control resources, never
   inherited label colors; .field intentionally uses a secondary foreground. */
.win-select { position: relative; display: inline-flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 32px; min-width: 64px; max-width: 100%; padding: 5px 14px 7px 12px; font-family: inherit; font-size: 14px; font-weight: 400; line-height: normal; color: #fff; text-align: start; border: 1px solid #ffffff12; border-top-color: #ffffff18; border-radius: 4px; background: #ffffff0f; box-shadow: none; cursor: default; transition: background-color 83ms linear, border-color 83ms linear; }
.win-select:hover:not(:disabled) { background: #ffffff15; }
.win-select:active:not(:disabled) { background: #ffffff08; border-color: #ffffff12; color: #ffffffc5; }
.win-select:disabled { opacity: 1; color: #ffffff5d; background: #ffffff0b; border-color: #ffffff12; }
.win-select-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.win-select-label.is-placeholder { color: #ffffffc5; }
.win-select:active:not(:disabled) .is-placeholder { color: #ffffff87; }
.win-select:disabled .is-placeholder { color: #ffffff5d; }
.win-select-chevron { color: #ffffffc5; flex-shrink: 0; transition: transform 167ms cubic-bezier(0,0,0,1); }
.win-select:disabled .win-select-chevron { color: #ffffff5d; }
.win-select:active:not(:disabled) .win-select-chevron { transform: translateY(2px); }
/* Focused/FocusedPressed show the 2px outer highlight and a 3×16 accent pill.
   PointerFocused and FocusedDropDown deliberately do not show this highlight. */
.win-select:focus-visible { outline: none; }
.win-select:focus-visible:not([data-open="true"]) { color: #fff; }
.win-select:focus-visible:not([data-open="true"]) .is-placeholder { color: #ffffffc5; }
.win-select:focus-visible:not([data-open="true"])::before { content: ''; position: absolute; inset: -5px; border: 2px solid #fff; border-radius: 7px; pointer-events: none; }
.win-select:focus-visible:not([data-open="true"])::after { content: ''; position: absolute; left: 0; top: calc(50% - 8px); width: 3px; height: 16px; border-radius: 1.5px; background: var(--accent, #60cdff); pointer-events: none; }
.win-select-popup.win-acrylic-host { position: fixed; z-index: 1000; display: flex; flex-direction: column; box-sizing: border-box; min-height: 0; margin: 0; padding: 0; border: 1px solid #00000033; border-radius: 8px; background: transparent; color: #fff; font-family: inherit; font-size: 14px; font-weight: 400; box-shadow: 0 8px 24px #0006; outline: none; }
/* Like PopupBorder > ScrollViewer, material and scrollbar stay outside the
   moving options. Keeping the scrollbar inside the popup also prevents its
   pointerdown from being mistaken for an outside click. */
.win-select-options { position: relative; flex: 0 1 auto; min-height: 0; box-sizing: border-box; margin: 0; padding: 4px; list-style: none; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; border-radius: 7px; }
.win-select-material { position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; list-style: none; }
.win-select-option { position: relative; display: flex; align-items: center; flex-shrink: 0; box-sizing: border-box; min-height: var(--select-row-height, 32px); height: var(--select-row-height, 32px); padding: var(--select-option-padding, 5px 14px 7px 12px); border: solid transparent; border-width: var(--select-option-border-width, 1px); border-radius: var(--select-option-radius, 4px); cursor: default; user-select: none; white-space: nowrap; overflow: hidden; }
.win-select-option > span:last-child { overflow: hidden; text-overflow: ellipsis; }
.win-select-option.is-selected, .win-select-option.is-pointer-over:not(.is-disabled) { background: #ffffff0f; }
.win-select-option.is-selected.is-pointer-over:not(.is-disabled) { background: #ffffff0a; }
.win-select-option:active:not(.is-disabled) { background: #ffffff0a; color: #ffffffc5; }
.win-select-option.is-selected:active:not(.is-disabled) { background: #ffffff0f; }
.win-select-option.is-disabled { opacity: 1; color: #ffffff5d; }
.win-select-option[data-keyboard-active="true"] { outline: 2px solid #fff; outline-offset: -2px; }
.win-select-pill { position: absolute; left: 0; top: calc(50% - 8px); width: 3px; height: 16px; border-radius: 1.5px; background: var(--accent, #60cdff); opacity: 0; transform: scaleY(1); transition: transform 167ms cubic-bezier(0,0,0,1); }
.win-select-option.is-selected > .win-select-pill { opacity: 1; }
.win-select-option.is-selected:active:not(.is-disabled) > .win-select-pill { transform: scaleY(.625); }
@media (prefers-reduced-motion: reduce) { .win-select, .win-select-chevron, .win-select-pill { transition: none; } }
@media (forced-colors: active) {
  .win-select, .win-select-popup.win-acrylic-host { background: Canvas; color: CanvasText; border-color: CanvasText; }
  .win-select:disabled, .win-select:disabled .win-select-chevron, .win-select-option.is-disabled { color: GrayText; }
  .win-select-option[data-keyboard-active="true"], .win-select:focus-visible::before { outline-color: Highlight; border-color: Highlight; }
  .win-select-pill, .win-select:focus-visible::after { background: Highlight; }
}
</style>
