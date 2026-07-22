<script setup>
defineProps({
  title: { type: String, default: '' },
  open: Boolean,
  headerless: Boolean,
  modalClass: { type: [String, Array, Object], default: '' },
})
defineEmits(['close'])
</script>
<template><Teleport to="body"><div v-if="open" class="modal-backdrop" @click.self="$emit('close')"><section class="modal" :class="[modalClass, { 'modal-headerless': headerless }]" role="dialog" aria-modal="true" :aria-label="title"><header><h2 v-if="!headerless">{{ title }}</h2><button class="icon-button" title="关闭" aria-label="关闭" @click="$emit('close')">×</button></header><div class="modal-body"><slot /></div><footer v-if="$slots.footer"><slot name="footer" /></footer></section></div></Teleport></template>
