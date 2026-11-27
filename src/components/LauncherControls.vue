<script setup>
import { FolderOpen, X } from '@lucide/vue'
import { computed } from 'vue'
import { importProgressValue } from '../composables/useGameImport'
import AcrylicSurface from './AcrylicSurface.vue'
import AnimatedSettingsIcon from './AnimatedSettingsIcon.vue'
import DownloadFlyout from './DownloadFlyout.vue'
import MotionProgressRing from './MotionProgressRing.vue'
// Presentational shell only. The page supplies its primary-action slot and
// retains command decisions, network requests and stale-response protection.
const props = defineProps({ download: { type: Object, default: null }, importTask: { type: Object, default: null }, importControlling: Boolean, accent: Boolean, brandStyle: { type: Object, default: () => ({}) }, locateVisible: Boolean, locateDisabled: Boolean })
const emit = defineEmits(['settings', 'locate', 'cancel-import'])
const progress = computed(() => props.importTask ? importProgressValue(props.importTask) : props.download?.determinate ? props.download.percent : Number.NaN)
const canCancelImport = computed(() => props.importTask?.cancelable && !props.importTask.cancel_requested)
</script>
<template>
      <div class="launcher-controls" :class="{ 'download-active': download && !importTask }">
        <div class="launch-popup-anchor">
        <DownloadFlyout v-if="download && !importTask" :download="download" />
        <div class="launch-actions win-acrylic-host" :class="{ 'has-download': download && !importTask, 'has-accent': accent }" :style="brandStyle">
          <AcrylicSurface />
          <span v-if="accent" class="capsule-accent" aria-hidden="true"></span>
          <template v-if="importTask">
            <div class="launch-import-progress" :class="{ 'can-cancel': canCancelImport }">
              <MotionProgressRing :size="28" :value="progress" :label="Number.isFinite(progress) ? Math.floor(progress) : ''" :aria-label="importTask.cancel_requested ? '正在取消导入' : '正在导入'" />
            </div>
            <button v-if="canCancelImport" class="icon-button game-settings-button" type="button" title="取消导入" :disabled="importControlling" @click="emit('cancel-import')"><X :size="20" /></button>
          </template>
          <template v-else>
            <MotionProgressRing v-if="download" class="download-percent-orb" :size="28" :value="progress" :label="download.determinate ? Math.floor(progress) : ''" aria-label="游戏下载进度" />
            <slot />
            <button class="icon-button game-settings-button" title="游戏设置" @click="emit('settings')"><AnimatedSettingsIcon :size="20" /></button>
          </template>
        </div>
        </div>
        <button v-if="locateVisible && !importTask" class="locate-existing" :disabled="locateDisabled" @click="emit('locate')"><FolderOpen :size="15" /> 已有游戏文件？选择游戏路径</button>
      </div>
</template>
