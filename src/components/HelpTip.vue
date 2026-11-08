<script setup>
import { CircleHelp } from '@lucide/vue'

defineProps({
  text: { type: String, required: true },
  label: { type: String, default: '查看说明' },
})
</script>

<template>
  <span class="help-tip" tabindex="0" role="button" :aria-label="`${label}：${text}`" @click.prevent.stop>
    <CircleHelp :size="14" aria-hidden="true" />
    <span class="help-tip-content" role="tooltip">{{ text }}</span>
  </span>
</template>
