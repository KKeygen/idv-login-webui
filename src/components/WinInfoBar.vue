<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { infoBarIsVertical } from '../infoBarLayout'
import { loadLocalFluentFont } from '../localFluentFont'
const props = defineProps({ title: { type: String, default: '' }, message: { type: String, default: '' }, severity: { type: String, default: 'info' }, closable: { type: Boolean, default: true }, actionLabel: { type: String, default: '' }, actionDisabled: Boolean })
const emit = defineEmits(['close', 'action'])
const panel = ref(null), probe = ref(null), vertical = ref(true)
const tone = computed(() => ['success','warning','error'].includes(props.severity) ? props.severity : 'info')
const severityLabel = computed(() => ({ info: '信息', success: '成功', warning: '警告', error: '错误' })[tone.value])
const nativeSymbols = ref(false)
const symbol = computed(() => ({ info: '\uF13F', error: '\uF13D', warning: '\uF13C', success: '\uF13E' })[tone.value])
let alive = true
onMounted(async () => { const loaded = await loadLocalFluentFont(); if (alive) nativeSymbols.value = loaded })
let observer
function measure() {
  if (!panel.value || !probe.value) return
  const children = [...probe.value.children], width = panel.value.clientWidth - 16
  vertical.value = infoBarIsVertical(width, children.map(e => e.getBoundingClientRect().width), children.map(e => e.getBoundingClientRect().height))
}
onMounted(() => { observer = new ResizeObserver(measure); if (panel.value instanceof Element) observer.observe(panel.value); nextTick(measure) })
onBeforeUnmount(() => { alive = false; observer?.disconnect() })
watch(() => [props.title,props.message,props.actionLabel], () => nextTick(measure))
</script>
<template>
  <section class="win-info-bar" :class="[`severity-${tone}`, { 'win-acrylic-host': tone === 'info' }]" :role="tone === 'error' || tone === 'warning' ? 'alert' : 'status'" aria-atomic="true">
    <AcrylicSurface v-if="tone === 'info'" />
    <span v-if="nativeSymbols" class="win-info-icon win-info-native-icon" role="img" :aria-label="severityLabel"><span aria-hidden="true">&#xF136;</span><span aria-hidden="true">{{ symbol }}</span></span>
    <svg v-else class="win-info-icon" viewBox="0 0 16 16" role="img" :aria-label="severityLabel">
      <path v-if="tone === 'warning'" d="M6.93 1.95a1.24 1.24 0 0 1 2.14 0l6.15 10.71A1.23 1.23 0 0 1 14.15 14H1.85a1.23 1.23 0 0 1-1.07-1.34z" fill="currentColor" />
      <circle v-else cx="8" cy="8" r="7" fill="currentColor" />
      <path v-if="tone === 'success'" d="m4.5 8 2.3 2.3 4.7-4.6" fill="none" class="win-info-icon-mark" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <path v-else-if="tone === 'error'" d="m5.5 5.5 5 5m0-5-5 5" class="win-info-icon-mark" fill="none" stroke-width="1.5" stroke-linecap="round" />
      <g v-else class="win-info-icon-mark" :transform="tone === 'info' ? 'rotate(180 8 8)' : undefined"><path d="M8 4.8v3.8" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="11" r=".8" /></g>
    </svg>
    <div ref="panel" class="win-info-panel" :class="{ 'is-vertical': vertical }">
      <strong v-if="title" class="win-info-title">{{ title }}</strong><span v-if="message" class="win-info-message">{{ message }}</span>
      <button v-if="actionLabel" class="win-info-action quiet-button" :disabled="actionDisabled" @click="emit('action')">{{ actionLabel }}</button>
      <span ref="probe" class="win-info-measure" aria-hidden="true"><span class="win-info-title">{{ title }}</span><span>{{ message }}</span><span class="win-info-action-measure">{{ actionLabel }}</span></span>
    </div>
    <button v-if="closable" class="win-info-close" type="button" aria-label="关闭通知" @click="emit('close')"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 3.5 9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg></button>
  </section>
</template>
<style scoped>
.win-info-bar { position: relative; isolation: isolate; display: grid; grid-template-columns: 30px minmax(0,1fr) auto; min-height: 48px; padding: 0 0 0 16px; border: 1px solid #00000019; border-radius: 4px; color: #fff; font-size: 14px; line-height: 20px; background: #ffffff08; pointer-events: auto; text-align: start; }
.severity-success { background: #393d1b; --severity-color: #6ccb5f; }
.severity-warning { background: #433519; --severity-color: #fce100; }
.severity-error { background: #442726; --severity-color: #ff99a4; }
.severity-info { --severity-color: var(--accent, #cbad8e); }
.win-info-icon { width: 16px; height: 16px; margin-top: 16px; color: var(--severity-color); }
.win-info-native-icon { position: relative; font-family: LocalWinUIFluentIcons; font-size: 16px; line-height: 16px; }
.win-info-native-icon > span { position: absolute; inset: 0; }
.win-info-native-icon > span + span { color: #000000e4; }
.win-info-icon-mark { fill: #000000e4; stroke: #000000e4; }
.win-info-panel { position: relative; display: flex; align-items: flex-start; padding: 14px 16px 14px 0; min-width: 0; }
.win-info-title { font-weight: 600; }
.win-info-message { font-weight: 400; }
.win-info-panel > .win-info-message:not(:first-child) { margin-left: 12px; }
.win-info-panel > .win-info-action { margin: -6px 0 0 16px; flex-shrink: 0; }
.win-info-panel.is-vertical { flex-direction: column; padding-top: 14px; padding-bottom: 18px; }
.win-info-panel.is-vertical > .win-info-message:not(:first-child) { margin: 4px 0 0; }
.win-info-panel.is-vertical > .win-info-action { margin: 12px 0 0; }
.win-info-title, .win-info-message { overflow-wrap: anywhere; }
.win-info-action { min-height: 32px; padding: 5px 11px; }
.win-info-close { display: grid; place-items: center; width: 38px; min-width: 38px; height: 38px; min-height: 38px; margin: 5px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: inherit; transition: background-color 83ms linear; }
.win-info-close svg { width: 16px; height: 16px; }
.win-info-close:hover { background: #ffffff0f; }
.win-info-close:active { background: #ffffff0a; color: #ffffffc5; }
.win-info-measure { position: absolute; visibility: hidden; pointer-events: none; display: flex; white-space: nowrap; inset: 0 auto auto 0; }
.win-info-measure > span:empty { display: none; }
.win-info-action-measure:not(:empty) { padding: 5px 12px; }
@media (forced-colors: active) { .win-info-bar { background: Canvas; color: CanvasText; border: 2px solid CanvasText; } .win-info-icon { color: Highlight; } .win-info-icon-mark { stroke: HighlightText; fill: HighlightText; } }
</style>
