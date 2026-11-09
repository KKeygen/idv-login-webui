<script setup>
import DirectionalTransition from './DirectionalTransition.vue'
import { onBeforeUnmount, ref, watch } from 'vue'
const props = defineProps({ step: { type: [Number, String], required: true } })
const emit = defineEmits(['moving'])
const direction = ref('forward')
watch(() => props.step, (next, previous) => { direction.value = next < previous ? 'back' : 'forward'; emit('moving', true) }, { flush: 'sync' })
onBeforeUnmount(() => emit('moving', false))
</script>
<template><DirectionalTransition :direction="direction" @after-enter="emit('moving', false)"><div :key="step" class="step-motion-host"><slot /></div></DirectionalTransition></template>
