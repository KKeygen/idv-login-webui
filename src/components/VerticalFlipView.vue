<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Starward's game settings use a vertical FlipView backed by ScrollViewer,
// not Frame's leave/enter animation. Keep pages in one scroll extent so both
// edges move together, including when a second selection reverses the scroll.
// Smooth-scroll timing is supplied by the webview, not a claimed WinUI curve.
const props = defineProps({ selectedIndex: { type: Number, default: 0 } })
const viewport = ref(null)
let media, observer, mounted = false
function select(immediate = false) {
  const host = viewport.value
  if (!host || !mounted) return
  const top = Math.max(0, props.selectedIndex) * host.clientHeight
  if (typeof host.scrollTo === 'function') host.scrollTo({ top, left: 0, behavior: immediate || media?.matches ? 'instant' : 'smooth' })
  else host.scrollTop = top
}
const settle = () => select(true)
watch(() => props.selectedIndex, () => select(), { flush: 'post' })
onMounted(async () => {
  mounted = true
  media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', settle)
  await nextTick()
  if (!mounted) return
  if (globalThis.ResizeObserver) {
    observer = new ResizeObserver(settle)
    observer.observe(viewport.value)
  }
  select(true)
})
onBeforeUnmount(() => {
  mounted = false
  observer?.disconnect()
  media?.removeEventListener?.('change', settle)
})
</script>

<template><div ref="viewport" class="vertical-flip-viewport"><slot /></div></template>

<style scoped>
.vertical-flip-viewport { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; overflow-anchor: none; }
.vertical-flip-viewport > :deep(*) { flex: 0 0 100%; min-height: 0; }
</style>
