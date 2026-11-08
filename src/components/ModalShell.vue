<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { isTopModal, openModal, removeModal } from '../modalStack'

const props = defineProps({
  title: { type: String, default: '' },
  open: Boolean,
  headerless: Boolean,
  dismissible: { type: Boolean, default: true },
  modalClass: { type: [String, Array, Object], default: '' },
})
const emit = defineEmits(['close'])
const modalToken = Symbol('modal-shell')
const modalZIndex = ref(200)

function requestClose() {
  if (!props.open || !props.dismissible || !isTopModal(modalToken)) return false
  emit('close')
  return true
}

function handleKeydown(event) {
  if (event.key !== 'Escape' || !requestClose()) return
  event.preventDefault()
  event.stopPropagation()
}

watch(() => props.open, open => {
  if (open) modalZIndex.value = openModal(modalToken)
}, { immediate: true })
function handleAfterLeave() {
  if (!props.open) removeModal(modalToken)
}
onMounted(() => window.addEventListener('keydown', handleKeydown, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true)
  removeModal(modalToken)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-fade" @after-leave="handleAfterLeave">
      <div v-if="open" class="modal-backdrop" :style="{ zIndex: modalZIndex }" @click.self="requestClose">
        <section class="modal" :class="[modalClass, { 'modal-headerless': headerless }]" role="dialog" aria-modal="true" :aria-label="title">
          <header>
            <h2 v-if="!headerless">{{ title }}</h2>
            <button class="icon-button modal-close-button" type="button" title="关闭" aria-label="关闭" :disabled="!dismissible" @click="requestClose"><X :size="16" /></button>
          </header>
          <div class="modal-body"><slot /></div>
          <footer v-if="$slots.footer"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
