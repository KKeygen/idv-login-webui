<script setup>
import { computed } from 'vue'
import { CircleAlert, Download, FolderOpen, HardDrive } from '@lucide/vue'
import { availableInstallBytes, hasKnownInstallCapacity, requiredInstallBytes } from '../installRequirements'
import ModalShell from './ModalShell.vue'
import MotionProgressRing from './MotionProgressRing.vue'

const props = defineProps({
  open: Boolean,
  title: { type: String, default: '游戏' },
  path: { type: String, default: '' },
  pathStatus: { type: Object, default: null },
  requirements: { type: Object, default: () => ({}) },
  busy: Boolean,
  pathBusy: Boolean,
})
const emit = defineEmits(['close', 'choose', 'install'])

const downloadBytes = computed(() => Number(props.requirements?.download_bytes) || 0)
const requiredBytes = computed(() => requiredInstallBytes(props.requirements))
const availableBytes = computed(() => availableInstallBytes(props.pathStatus))
const hasCapacity = computed(() => hasKnownInstallCapacity(props.path, props.pathStatus))
const insufficient = computed(() => hasCapacity.value && requiredBytes.value > 0 && availableBytes.value < requiredBytes.value)
const canInstall = computed(() => Boolean(
  hasCapacity.value
  && !insufficient.value
  && !props.busy
  && !props.pathBusy
))

function formatSize(bytes) {
  const value = Number(bytes) || 0
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)))
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`
}
</script>

<template>
  <ModalShell :open="open" title="选择安装路径" headerless :dismissible="!busy && !pathBusy" modal-class="install-game-modal" @close="emit('close')">
    <section class="install-dialog-content">
      <header class="install-dialog-heading">
        <h2>选择安装路径</h2>
        <p>{{ title }}</p>
      </header>

      <div class="install-path-field" :class="{ empty: !path }">
        <FolderOpen :size="16" />
        <span :title="path">{{ path || '请选择游戏安装目录' }}</span>
        <button class="inline-command" type="button" :disabled="busy || pathBusy" @click="emit('choose')"><MotionProgressRing v-if="pathBusy" :size="14" aria-label="正在读取安装路径" />{{ pathBusy ? '正在读取' : path ? '更改' : '选择' }}</button>
      </div>

      <div v-if="path" class="install-space-row">
        <span><HardDrive :size="14" />解压所需空间 <strong>{{ formatSize(requiredBytes) }}</strong></span>
        <i aria-hidden="true"></i>
        <span>可用空间 <strong v-if="hasCapacity">{{ formatSize(availableBytes) }}</strong><span v-else class="inline-loading"><MotionProgressRing :size="14" aria-label="正在读取磁盘空间" />正在读取</span></span>
      </div>

      <p v-if="insufficient" class="install-warning"><CircleAlert :size="15" />所选磁盘空间不足，请更换安装位置。</p>
      <p v-else-if="downloadBytes" class="install-package-note"><Download :size="14" />需要下载约 {{ formatSize(downloadBytes) }}，安装会在后台继续进行。</p>

      <footer class="install-dialog-actions">
        <button class="primary" type="button" :disabled="!canInstall" @click="emit('install')">
          <MotionProgressRing v-if="busy" :size="16" aria-label="正在启动安装" />{{ busy ? '正在启动安装…' : '开始安装' }}
        </button>
      </footer>
    </section>
  </ModalShell>
</template>
