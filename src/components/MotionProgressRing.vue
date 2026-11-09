<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, watch } from 'vue'
import {
  createProgressRingMotion,
  determinateProgressRingFrame,
  indeterminateProgressRingFrame,
  progressRingDash,
} from '../progressRingMotion'

const props = defineProps({
  size: { type: Number, default: 20 },
  value: { type: Number, default: Number.NaN },
  label: { type: [String, Number], default: '' },
  ariaLabel: { type: String, default: '正在处理' },
  active: { type: Boolean, default: true },
})
const determinate = computed(() => Number.isFinite(props.value))
const progress = computed(() => Math.max(0, Math.min(100, Number(props.value) || 0)))
const frame = shallowRef(determinate.value ? determinateProgressRingFrame(progress.value / 100) : indeterminateProgressRingFrame(0))
const arcs = computed(() => frame.value.arcs.map(arc => ({ ...arc, dash: progressRingDash(arc) })))
const ringStyle = computed(() => ({
  width: `${Number.isFinite(props.size) ? Math.max(16, props.size) : 20}px`,
  height: `${Number.isFinite(props.size) ? Math.max(16, props.size) : 20}px`,
  '--win-ring-stroke': frame.value.stroke,
}))
let motion = null
let media = null
let mounted = false
let activated = true
function sync() { motion?.select({ value: props.value, active: props.active }) }
function visibility() { motion?.setVisible(activated && !document.hidden) }
function preference() { motion?.setReducedMotion(Boolean(media?.matches)) }
watch(() => [props.value, props.active], sync)
onMounted(() => {
  mounted = true
  media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
  motion = createProgressRingMotion({
    render: value => { frame.value = value },
    visible: activated && !document.hidden,
    reduced: Boolean(media?.matches),
  })
  document.addEventListener('visibilitychange', visibility)
  if (media?.addEventListener) media.addEventListener('change', preference)
  else media?.addListener?.(preference)
  sync()
})
onActivated(() => { activated = true; if (mounted) visibility() })
onDeactivated(() => { activated = false; visibility() })
onBeforeUnmount(() => {
  mounted = false
  motion?.dispose()
  motion = null
  document.removeEventListener('visibilitychange', visibility)
  if (media?.removeEventListener) media.removeEventListener('change', preference)
  else media?.removeListener?.(preference)
})
</script>

<template>
  <span
    class="sw-progress-ring win-progress-ring"
    :class="{ 'is-indeterminate': !determinate, 'is-inactive': !active, 'has-label': label !== '' }"
    :style="ringStyle"
    :role="active ? 'progressbar' : undefined"
    :aria-hidden="active ? undefined : true"
    :aria-label="active ? ariaLabel : undefined"
    :aria-valuemin="active && determinate ? 0 : undefined"
    :aria-valuemax="active && determinate ? 100 : undefined"
    :aria-valuenow="active && determinate ? progress : undefined"
  >
    <svg class="win-ring-visual" :viewBox="`0 0 ${frame.canvas} ${frame.canvas}`" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <circle class="win-ring-path win-ring-track" :cx="frame.center" :cy="frame.center" :r="frame.radius" />
      <!-- Composition Trim starts at twelve o'clock according to Uno's WinUI
           compatibility implementation. This -90 SVG origin conversion still
           needs a Windows native-frame check; the oracle C++ does not expose
           CompositionEllipseGeometry's internal parameterization. -->
      <g :transform="`rotate(${frame.rotation - 90} ${frame.center} ${frame.center})`">
        <circle
          v-for="(arc, index) in arcs" :key="index" class="win-ring-path win-ring-arc"
          :cx="frame.center" :cy="frame.center" :r="frame.radius" pathLength="100"
          :opacity="arc.opacity" :stroke-dasharray="arc.dash.array" :stroke-dashoffset="arc.dash.offset"
        />
      </g>
    </svg>
    <span v-if="label !== ''" class="sw-progress-ring-label">{{ label }}</span>
  </span>
</template>

<style scoped>
/* Own the SVG selectors so the former 1.35 s CSS spinner cannot also run.
   The 16 px minimum and opacity-only inactive state come from ProgressRing.xaml.
   Command foreground/optional label are retained application extensions. */
.sw-progress-ring.win-progress-ring {
  position: relative;
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  min-width: 16px;
  min-height: 16px;
  color: var(--progress-ring-foreground, var(--accent, #cbad8e));
  vertical-align: middle;
  pointer-events: none;
}
.sw-progress-ring.win-progress-ring.is-inactive { opacity: 0; }
.sw-progress-ring.win-progress-ring > svg.win-ring-visual {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  transform: none;
  animation: none !important;
  transition: none;
}
.sw-progress-ring.win-progress-ring .win-ring-path {
  fill: none;
  stroke-width: var(--win-ring-stroke);
  vector-effect: none;
  animation: none !important;
  transition: none;
}
.sw-progress-ring.win-progress-ring .win-ring-track {
  stroke: var(--progress-ring-background, transparent);
}
.sw-progress-ring.win-progress-ring .win-ring-arc {
  stroke: currentColor;
  stroke-linecap: round;
}
.sw-progress-ring.win-progress-ring .sw-progress-ring-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: var(--progress-ring-label-size, 9px);
  color: var(--progress-ring-label-color, currentColor);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
@media (forced-colors: active) {
  .sw-progress-ring.win-progress-ring { color: Highlight; }
  .sw-progress-ring.win-progress-ring .win-ring-track { stroke: Canvas; }
}
</style>
