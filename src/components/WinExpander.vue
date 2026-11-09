<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue'
import { chevronState, createExpanderChevronMotion, EXPANDER_CHEVRON_PATH } from './expanderChevronMotion'
import { animateStyles, EXPANDER_MOTION, reducedMotion } from './winControlUtils'

const props = defineProps({
  expanded: Boolean,
  title: { type: String, default: '' },
  disabled: Boolean,
  direction: { type: String, default: 'down', validator: value => ['down', 'up'].includes(value) },
})
const emit = defineEmits(['update:expanded', 'change'])
const id = `win-expander-${useId()}`
const content = ref(null)
const header = ref(null)
const chevron = ref(null)
const hovered = ref(false)
const pressed = ref(false)
const iconState = computed(() => chevronState({ ...props, hovered: hovered.value, pressed: pressed.value }))
let iconMotion
const rendered = ref(props.expanded)
let motion
let generation = 0
let observer
let mediaQuery
let mounted = false
let started = 0
let active = true
let hideTimer
let completeHide
let observing = false
let previousHeight

function clearPress() { pressed.value = false }
function pointerEnter(event) { if (event.pointerType !== 'touch') hovered.value = true }
function pointerLeave() { hovered.value = false; clearPress() }
function pointerDown(event) { if (!props.disabled && event.button === 0 && event.isPrimary !== false) pressed.value = true }
function keyDown(event) { if (!props.disabled && [' ', 'Enter'].includes(event.key) && !event.repeat) pressed.value = true }
watch(iconState, state => { if (active) iconMotion?.select(state, props.disabled) }, { flush: 'post' })
function toggle() {
  if (props.disabled) return
  emit('update:expanded', !props.expanded)
  emit('change', !props.expanded)
}
function stop() {
  generation += 1
  motion?.cancel()
  motion = undefined
  clearTimeout(hideTimer)
  completeHide?.()
  completeHide = undefined
}
function finish(expanded) {
  rendered.value = expanded
  if (content.value) content.value.style.transform = expanded ? 'translateY(0px)' : ''
}
async function transition(expanded, resize = false) {
  if (!active) { stop(); finish(expanded); return }
  const wasRendered = rendered.value
  const before = content.value && wasRendered ? getComputedStyle(content.value).transform : null
  stop()
  const request = generation
  if (!expanded && content.value?.contains(document.activeElement)) header.value?.focus({ preventScroll: true })
  rendered.value = true
  await nextTick()
  if (!mounted || !active || request !== generation || !content.value) return
  const element = content.value
  const height = element.getBoundingClientRect().height || element.scrollHeight
  const offset = (props.direction === 'up' ? 1 : -1) * height
  const from = before && before !== 'none' ? before : expanded && !wasRendered ? `translateY(${offset}px)` : 'translateY(0px)'
  const to = expanded ? 'translateY(0px)' : `translateY(${offset}px)`
  const fullDuration = expanded ? EXPANDER_MOTION.enter : EXPANDER_MOTION.leave
  const elapsed = resize ? Math.max(0, performance.now() - started) : 0
  if (!resize) started = performance.now()
  const duration = reducedMotion() ? 0 : Math.max(0, fullDuration - elapsed)
  const hideDelay = !expanded && props.direction === 'up' && !reducedMotion() ? EXPANDER_MOTION.upLeave - EXPANDER_MOTION.leave : 0
  motion = animateStyles(element, { transform: from }, { transform: to }, { duration, easing: expanded ? EXPANDER_MOTION.enterEasing : EXPANDER_MOTION.leaveEasing })
  await motion.finished
  if (request !== generation) return
  if (hideDelay) await new Promise(resolve => { completeHide = resolve; hideTimer = setTimeout(resolve, hideDelay) })
  completeHide = undefined
  if (request !== generation) return
  motion = undefined
  finish(expanded)
}
watch(() => props.expanded, expanded => { if (mounted) transition(expanded) })
watch(() => props.direction, () => { if (mounted && rendered.value) transition(props.expanded) })
function handleReducedMotion() {
  if (reducedMotion() && motion) { stop(); finish(props.expanded) }
  iconMotion?.select(iconState.value, true)
}
function observe() {
  if (observing) return
  observing = true
  window.addEventListener('pointerup', clearPress)
  window.addEventListener('pointercancel', clearPress)
  window.addEventListener('blur', pointerLeave)
  if (typeof ResizeObserver !== 'undefined') {
    previousHeight = content.value?.getBoundingClientRect().height
    observer ||= new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height
      if (height === previousHeight) return
      previousHeight = height
      if (active && motion) transition(props.expanded, true)
    })
    observer.observe(content.value)
  }
  mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  mediaQuery?.addEventListener?.('change', handleReducedMotion)
}
function suspend() {
  active = false
  hovered.value = false
  pressed.value = false
  iconMotion?.select(iconState.value, true)
  window.removeEventListener('pointerup', clearPress)
  window.removeEventListener('pointercancel', clearPress)
  window.removeEventListener('blur', pointerLeave)
  stop()
  finish(props.expanded)
  observer?.disconnect()
  observing = false
  mediaQuery?.removeEventListener?.('change', handleReducedMotion)
}
onMounted(() => { mounted = true; iconMotion = createExpanderChevronMotion(chevron.value, reducedMotion); iconMotion.select(iconState.value, true); observe() })
onActivated(() => {
  if (active) return
  active = true
  iconMotion?.select(iconState.value, true)
  finish(props.expanded)
  observe()
})
onDeactivated(suspend)
onBeforeUnmount(() => { mounted = false; suspend(); iconMotion?.dispose() })
</script>

<template>
  <section class="win-expander" :class="[{ 'is-expanded': expanded, 'is-disabled': disabled }, `expands-${direction}`]">
    <button :id="`${id}-header`" ref="header" class="win-expander-header" type="button" :aria-expanded="expanded" :aria-controls="id" :disabled="disabled" @pointerenter="pointerEnter" @pointerleave="pointerLeave" @pointerdown="pointerDown" @keydown="keyDown" @keyup="clearPress" @blur="clearPress" @click="toggle">
      <span class="win-expander-label"><slot name="header" :expanded="expanded">{{ title }}</slot></span>
      <span class="win-expander-chevron-box"><svg class="win-expander-chevron" viewBox="0 0 48 48" width="12" height="12" aria-hidden="true"><g ref="chevron"><path :d="EXPANDER_CHEVRON_PATH" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" /></g></svg></span>
    </button>
    <div :id="id" class="win-expander-clip" :hidden="!rendered" :inert="expanded && !disabled ? undefined : true" :aria-hidden="!expanded" role="region" :aria-labelledby="`${id}-header`">
      <div ref="content" class="win-expander-content"><slot /></div>
    </div>
  </section>
</template>

<style scoped>
.win-expander { display: flex; flex-direction: column; min-width: 0; color: #fff; border: 0; border-radius: 4px; background: transparent; }
.win-expander-header { display: flex; align-items: center; justify-content: space-between; gap: 0; width: 100%; min-height: 48px; padding: 0 0 0 16px; margin: 0; text-align: start; color: #fff; font-family: inherit; font-size: 14px; font-weight: 400; border: 1px solid #00000019; border-radius: 4px; background: #ffffff0d; box-shadow: none; }
.win-expander-header:disabled { opacity: 1; color: #ffffff5d; }
.win-expander-label { flex: 1; min-width: 0; }
.win-expander-chevron-box { display: grid; place-items: center; flex: 0 0 32px; width: 32px; height: 32px; margin: 0 8px 0 20px; border-radius: 4px; }
.win-expander-header:hover:not(:disabled) .win-expander-chevron-box { background: #ffffff0f; }
.win-expander-header:active:not(:disabled) .win-expander-chevron-box { background: #ffffff0a; }
.win-expander-chevron { display: block; flex-shrink: 0; overflow: hidden; }
.win-expander-clip { overflow: hidden; overflow: clip; }
.win-expander-clip[hidden] { display: none; }
.win-expander-content { padding: 16px; background: #ffffff08; border: 1px solid #00000019; border-top: 0; border-radius: 0 0 4px 4px; }
.is-expanded.expands-down .win-expander-header { border-radius: 4px 4px 0 0; }
.is-expanded.expands-up .win-expander-header { border-radius: 0 0 4px 4px; }
.expands-up { flex-direction: column-reverse; }
.expands-up .win-expander-content { border-top: 1px solid #00000019; border-bottom: 0; border-radius: 4px 4px 0 0; }
@media (forced-colors: active) { .win-expander-header, .win-expander-content { background: Canvas; color: CanvasText; border-color: CanvasText; } .win-expander-header:disabled { color: GrayText; } }
</style>
