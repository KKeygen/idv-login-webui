<script setup>
import { computed } from 'vue'

const props = defineProps({
  size: { type: Number, default: 20 },
  value: { type: Number, default: Number.NaN },
  label: { type: [String, Number], default: '' },
  ariaLabel: { type: String, default: '正在处理' },
})

const determinate = computed(() => Number.isFinite(props.value))
const progress = computed(() => Math.max(0, Math.min(100, Number(props.value) || 0)))
const ringStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  '--ring-progress': progress.value,
}))
</script>

<template>
  <span
    class="sw-progress-ring"
    :class="{ 'is-indeterminate': !determinate, 'has-label': label !== '' }"
    :style="ringStyle"
    role="progressbar"
    :aria-label="ariaLabel"
    :aria-valuemin="determinate ? 0 : undefined"
    :aria-valuemax="determinate ? 100 : undefined"
    :aria-valuenow="determinate ? progress : undefined"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle class="sw-progress-ring-track" cx="12" cy="12" r="9" pathLength="100" />
      <circle class="sw-progress-ring-indicator" cx="12" cy="12" r="9" pathLength="100" />
    </svg>
    <span v-if="label !== ''" class="sw-progress-ring-label">{{ label }}</span>
  </span>
</template>
