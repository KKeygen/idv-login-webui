<script setup>
// Keep the existing child (including KeepAlive) as the transition root.
// Page and settings transitions differ only in their established CSS prefix.
defineOptions({ inheritAttrs: false })
defineProps({ scope: { type: String, default: 'page', validator: value => ['page', 'section'].includes(value) } })
</script>

<template>
  <Transition v-bind="$attrs" :name="`${scope}-change`" mode="out-in"><slot /></Transition>
</template>
