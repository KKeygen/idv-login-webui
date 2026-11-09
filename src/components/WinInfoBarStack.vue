<script setup>
import { onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, ref } from 'vue'
import WinInfoBar from './WinInfoBar.vue'
const props = defineProps({ notices: { type: Array, default: () => [] } })
const emit = defineEmits(['close'])
const stack = ref(null)
let beforeTop = null, animation = null, reduced
function finish() { animation?.cancel(); animation = null }
onMounted(() => { reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)'); reduced?.addEventListener?.('change', finish) })
onBeforeUpdate(() => { beforeTop = stack.value?.getBoundingClientRect().top ?? null })
onUpdated(() => {
  finish()
  const element = stack.value
  if (!element || beforeTop === null || reduced?.matches || !element.animate || !props.notices.length) return
  const delta = beforeTop - element.getBoundingClientRect().top
  if (Math.abs(delta) < .5) return
  // Starward attaches AddDeleteThemeTransition to StackPanel.Transitions, not
  // ChildrenTransitions. Individual InfoBars appear/collapse immediately.
  // Its reposition timing is returned by Windows UxTheme. 300ms here is the
  // portable fallback, NOT a recovered native theme keyframe/curve.
  animation = element.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.1,.9,.2,1)' })
})
onBeforeUnmount(() => { finish(); reduced?.removeEventListener?.('change', finish) })
</script>
<template>
  <div class="toasts"><div ref="stack" class="win-info-stack">
    <WinInfoBar v-for="notice in notices" :key="notice.id" :title="notice.title || notice.message" :message="notice.title ? notice.message : ''" :severity="notice.tone" @close="emit('close', notice.id)" />
  </div></div>
</template>
<style scoped>.win-info-stack { display: flex; flex-direction: column; gap: 0; width: 100%; pointer-events: none; }</style>
