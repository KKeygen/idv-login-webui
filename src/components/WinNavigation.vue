<script setup>
import { computed, nextTick, onActivated, onDeactivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createNavigationIndicatorMotion, navigationFocusTarget } from '../navigationMotion'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  items: { type: Array, default: () => [] },
  footerItems: { type: Array, default: () => [] },
  compact: Boolean,
  label: { type: String, default: '导航' },
})
const emit = defineEmits(['update:modelValue', 'change'])
const root = ref(null)
const focusedId = ref(null)
const pressedId = ref(null)
const buttons = new Map()
const indicators = new Map()
const groups = computed(() => [props.items.filter(item => !item.hidden), props.footerItems.filter(item => !item.hidden)])
const allItems = computed(() => groups.value.flat())
const focusable = computed(() => allItems.value.filter(item => !item.disabled))
const tabStop = computed(() => {
  if (focusable.value.some(item => item.id === focusedId.value)) return focusedId.value
  return focusable.value.find(item => item.id === props.modelValue)?.id ?? focusable.value[0]?.id ?? null
})
let media = null
let observer = null
let animationFrame = 0
let mounted = false
let heldKey = null
let focusWithin = false
let pointerId = null

function geometry(id) {
  const button = buttons.get(id)
  if (!button?.isConnected || !button.getClientRects().length) return null
  const rect = button.getBoundingClientRect()
  if (!rect.height || !rect.width) return null
  return { top: rect.top + (rect.height - 16) / 2, left: rect.left + 3 }
}
const motion = createNavigationIndicatorMotion({
  getIndicator: id => indicators.get(id),
  getGeometry: geometry,
  reducedMotion: () => Boolean(media?.matches),
})

function bindButton(id, element) {
  const previous = buttons.get(id)
  if (previous === element) return
  if (previous) observer?.unobserve(previous)
  if (element) {
    buttons.set(id, element)
    observer?.observe(element)
  } else buttons.delete(id)
}
function bindIndicator(id, element) {
  if (element) indicators.set(id, element)
  else indicators.delete(id)
}
function focusItem(id) {
  const button = buttons.get(id)
  if (!button || button.disabled || !geometry(id)) return
  focusedId.value = id
  button.focus({ preventScroll: true })
  button.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
}
function activate(item, event) {
  if (item.disabled || item.hidden) return
  focusedId.value = item.id
  if (props.modelValue === item.id) return
  emit('update:modelValue', item.id)
  emit('change', item.id, item, event)
}
function onKeyDown(event, item) {
  if (event.altKey || event.ctrlKey || event.metaKey || item.disabled) return
  if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    clearPressed()
    const visible = focusable.value.filter(entry => geometry(entry.id))
    focusItem(navigationFocusTarget(visible, item.id, event.key))
    return
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    // One activation per physical key press, not per auto-repeat event.
    if (event.repeat || heldKey) return
    heldKey = event.key
    pressedId.value = item.id
    if (event.key === 'Enter') activate(item, event)
  }
}
function onKeyUp(event, item) {
  if (event.key !== ' ' && event.key !== 'Enter') return
  event.preventDefault()
  const shouldActivate = event.key === ' ' && heldKey === event.key && pressedId.value === item.id
  clearPressed()
  if (shouldActivate) activate(item, event)
}
function clearPressed() {
  pressedId.value = null
  heldKey = null
  pointerId = null
}
function onPointerDown(event, item) {
  if (event.button !== 0 || item.disabled || event.isPrimary === false) return
  pointerId = event.pointerId
  pressedId.value = item.id
}
function onPointerEnd(event) {
  if (pointerId === event.pointerId) clearPressed()
}
function onFocusOut(event) {
  if (root.value?.contains(event.relatedTarget)) return
  focusWithin = false
  clearPressed()
}
function refreshLayout() {
  if (!mounted || animationFrame) return
  animationFrame = requestAnimationFrame(() => {
    animationFrame = 0
    motion.select(props.modelValue, { immediate: true })
  })
}
function reconcileFocus() {
  if (focusable.value.some(item => item.id === focusedId.value && geometry(item.id))) return
  const next = focusable.value.find(item => item.id === props.modelValue && geometry(item.id))
    ?? focusable.value.find(item => geometry(item.id))
  focusedId.value = next?.id ?? null
  if (focusWithin && next) focusItem(next.id)
}

watch(() => props.modelValue, id => {
  if (mounted) motion.select(id)
}, { flush: 'post' })
// Callers may pass an inline array/filter on every selection. Only an actual
// membership, order, group or enabled-state change should settle the animation.
watch(() => JSON.stringify(groups.value.map(group => group.map(item => [item.id, Boolean(item.disabled)]))), async () => {
  await nextTick()
  if (!mounted) return
  reconcileFocus()
  motion.select(props.modelValue, { immediate: true })
}, { flush: 'post' })
watch(() => props.compact, refreshLayout)

onMounted(() => {
  mounted = true
  media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', refreshLayout)
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(refreshLayout)
    observer.observe(root.value)
    for (const button of buttons.values()) observer.observe(button)
  }
  window.addEventListener('resize', refreshLayout)
  window.addEventListener('blur', clearPressed)
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
  motion.select(props.modelValue, { immediate: true })
})
onActivated(() => nextTick(refreshLayout))
onDeactivated(() => {
  clearPressed()
  if (animationFrame) cancelAnimationFrame(animationFrame)
  animationFrame = 0
  motion.finish()
})
onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
  media?.removeEventListener?.('change', refreshLayout)
  window.removeEventListener('resize', refreshLayout)
  window.removeEventListener('blur', clearPressed)
  window.removeEventListener('pointerup', onPointerEnd)
  window.removeEventListener('pointercancel', onPointerEnd)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  motion.dispose()
  buttons.clear()
  indicators.clear()
})
defineExpose({ focus: () => focusItem(tabStop.value), finishMotion: () => motion.refresh() })
</script>

<template>
  <nav ref="root" class="win-navigation" :class="{ 'is-compact': compact }" :aria-label="label" @focusin="focusWithin = true" @focusout="onFocusOut">
    <div v-for="(group, groupIndex) in groups" v-show="group.length || (groupIndex === 0 && $slots.actions)" :key="groupIndex" class="win-navigation-group" :class="{ 'is-footer': groupIndex === 1 }">
      <button
        v-for="item in group" :key="item.id" :ref="element => bindButton(item.id, element)"
        type="button" class="win-navigation-item" :class="{ 'is-selected': modelValue === item.id, 'is-pressed': pressedId === item.id }"
        :disabled="item.disabled" :tabindex="tabStop === item.id ? 0 : -1"
        :aria-current="modelValue === item.id ? 'page' : undefined" :aria-label="item.label"
        :title="compact ? item.label : undefined" :data-nav-id="item.id" data-reveal="off"
        @click="activate(item, $event)" @focus="focusedId = item.id" @blur="clearPressed"
        @keydown="onKeyDown($event, item)" @keyup="onKeyUp($event, item)"
        @pointerdown="onPointerDown($event, item)" @pointerleave="pressedId === item.id && clearPressed()"
      >
        <span :ref="element => bindIndicator(item.id, element)" class="win-navigation-indicator" aria-hidden="true" />
        <span v-if="item.icon || $slots.icon" class="win-navigation-icon" aria-hidden="true">
          <slot name="icon" :item="item" :selected="modelValue === item.id">
            <span v-if="typeof item.icon === 'string'" class="win-navigation-glyph">{{ item.icon }}</span>
            <component :is="item.icon" v-else :size="20" :stroke-width="1.5" />
          </slot>
        </span>
        <span class="win-navigation-label">{{ item.label }}</span>
      </button>
      <slot v-if="groupIndex === 0" name="actions" />
    </div>
    <div v-if="$slots.footer" class="win-navigation-footer-actions"><slot name="footer" /></div>
  </nav>
</template>

<style scoped>
.win-navigation {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  gap: 4px;
  min-width: 0;
  padding: 4px;
  overflow: visible;
}
.win-navigation-group { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.win-navigation-group.is-footer { margin-top: auto; padding-top: 8px; }
.win-navigation-footer-actions { flex: 0 0 auto; }
.win-navigation .win-navigation-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  flex: 0 0 auto;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  background: transparent;
  box-shadow: none;
  color: var(--win-text-primary, rgba(255, 255, 255, .786));
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  text-align: start;
  cursor: default;
  overflow: visible;
  transform: none;
  transition: background-color 83ms linear, color 83ms linear;
  -webkit-tap-highlight-color: transparent;
}
.win-navigation .win-navigation-item::before,
.win-navigation .win-navigation-item::after { content: none; }
.win-navigation .win-navigation-item:hover:not(:disabled) { background: var(--win-subtle-hover, rgba(255, 255, 255, .0605)); color: var(--win-text-primary, #fff); transform: none; }
.win-navigation .win-navigation-item.is-selected { background: var(--win-subtle-selected, rgba(255, 255, 255, .0605)); color: var(--win-text-primary, #fff); }
.win-navigation .win-navigation-item.is-selected:hover:not(:disabled) { background: var(--win-subtle-selected-hover, rgba(255, 255, 255, .0837)); }
.win-navigation .win-navigation-item.is-pressed:not(:disabled) { background: var(--win-subtle-pressed, rgba(255, 255, 255, .0419)); color: var(--win-text-secondary, rgba(255, 255, 255, .786)); }
.win-navigation .win-navigation-item:disabled { background: transparent; color: var(--win-text-disabled, rgba(255, 255, 255, .3628)); opacity: 1; cursor: default; }
.win-navigation .win-navigation-item:focus-visible { outline: 2px solid var(--win-focus, #fff); outline-offset: -2px; }
.win-navigation-indicator {
  position: absolute;
  top: calc(50% - 8px);
  left: 2px;
  width: 3px;
  height: 16px;
  border-radius: 2px;
  opacity: 0;
  background: var(--accent, #60cdff);
  pointer-events: none;
  z-index: 2;
  transform-origin: top center;
}
.win-navigation-icon { display: grid; place-items: center; width: 20px; height: 20px; flex: 0 0 20px; transform: none; }
.win-navigation-icon :deep(svg) { width: 20px; height: 20px; transform: none; transition: none; }
.win-navigation-glyph { font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif; font-size: 20px; }
.win-navigation-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.win-navigation.is-compact .win-navigation-item { justify-content: center; min-height: 40px; padding: 8px; }
.win-navigation.is-compact .win-navigation-label { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); }
@media (prefers-reduced-motion: reduce) { .win-navigation .win-navigation-item { transition: none; } }
@media (forced-colors: active) {
  .win-navigation .win-navigation-item { color: ButtonText; }
  .win-navigation .win-navigation-item.is-selected { color: Highlight; border-color: Highlight; }
  .win-navigation .win-navigation-item:disabled { color: GrayText; }
  .win-navigation .win-navigation-item:focus-visible { outline-color: ButtonText; }
  .win-navigation-indicator { background: Highlight; forced-color-adjust: none; }
}
</style>
