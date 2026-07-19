<script setup>
defineProps({ title: { type: String, default: '' }, open: Boolean })
defineEmits(['close'])
</script>
<template><Teleport to="body"><div v-if="open" class="modal-backdrop" @click.self="$emit('close')"><section class="modal"><header><h2>{{ title }}</h2><button class="icon-button" @click="$emit('close')">×</button></header><div class="modal-body"><slot /></div><footer v-if="$slots.footer"><slot name="footer" /></footer></section></div></Teleport></template>
