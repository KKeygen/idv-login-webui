<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ src: { type: String, default: '' }, alt: { type: String, default: '' } })
const emit = defineEmits(['load', 'error'])
const current = ref(null)
const previous = ref(null)
const loaded = ref(false)
const retiring = ref(false)
const failed = ref(false)
let generation = 0
let fadeTimer, removeTimer
const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
function clearTimers() { clearTimeout(fadeTimer); clearTimeout(removeTimer) }
function settle() { clearTimers(); previous.value = null; retiring.value = false }
function ready(id) {
  if (id !== generation || loaded.value) return
  loaded.value = true
  failed.value = false
  emit('load', current.value?.src)
  if (media?.matches || !previous.value) { settle(); return }
  fadeTimer = setTimeout(() => { retiring.value = true }, 300)
  removeTimer = setTimeout(settle, 600)
}
function fail(id) {
  if (id !== generation) return
  clearTimers()
  failed.value = true
  emit('error', current.value?.src)
}
function reduced() { if (media.matches && loaded.value) settle() }
media?.addEventListener?.('change', reduced)
watch(() => props.src, src => {
  clearTimers()
  const lastVisible = loaded.value ? current.value : previous.value
  generation += 1
  previous.value = src ? lastVisible : null
  current.value = src ? { src, id: generation } : null
  loaded.value = false
  retiring.value = false
  failed.value = false
}, { immediate: true })
onBeforeUnmount(() => { generation += 1; clearTimers(); media?.removeEventListener?.('change', reduced) })
</script>

<template>
  <span class="motion-image" :data-image-state="failed ? 'failed' : loaded ? 'loaded' : current ? 'loading' : 'empty'">
    <img v-if="previous" :key="`old-${previous.id}`" class="motion-image-placeholder" :class="{ retiring }" :src="previous.src" alt="" decoding="async" aria-hidden="true" />
    <img v-if="current" :key="current.id" class="motion-image-current" :class="{ loaded, failed }" :src="current.src" :alt="alt" decoding="async" :data-image-id="current.id" @load="ready(Number($event.target.dataset.imageId))" @error="fail(Number($event.target.dataset.imageId))" />
  </span>
</template>

<style scoped>
.motion-image { position: relative; display: block; overflow: hidden; }
.motion-image > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.motion-image-placeholder { opacity: 1; transition: opacity 300ms linear; }
.motion-image-placeholder.retiring { opacity: 0; }
.motion-image-current { opacity: 0; transition: opacity 300ms linear; }
.motion-image-current.loaded { opacity: 1; }
.motion-image-current.failed { visibility: hidden; }
@media (prefers-reduced-motion: reduce) { .motion-image > img { transition: none; } }
</style>
