<script setup>
// This adapter adds no element: callers retain their keyed content and state.
defineOptions({ inheritAttrs: false })
defineProps({
  axis: { type: String, default: 'horizontal', validator: value => ['horizontal', 'vertical'].includes(value) },
  direction: { type: String, default: 'forward', validator: value => ['forward', 'back'].includes(value) },
})
</script>

<template>
  <Transition v-bind="$attrs" :name="`${axis === 'vertical' ? 'flip' : 'step'}-${direction}`" mode="out-in"><slot /></Transition>
</template>
