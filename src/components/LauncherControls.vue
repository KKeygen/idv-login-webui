<script setup>
import { FolderOpen } from '@lucide/vue'
import { computed } from 'vue'
import { importProgressValue } from '../composables/useGameImport'
import AcrylicSurface from './AcrylicSurface.vue'
import AnimatedSettingsIcon from './AnimatedSettingsIcon.vue'
import DownloadFlyout from './DownloadFlyout.vue'
import MotionProgressRing from './MotionProgressRing.vue'
// Presentational shell only. The page supplies its primary-action slot and
// retains command decisions, network requests and stale-response protection.
const props = defineProps({ download: { type: Object, default: null }, importTask: { type: Object, default: null }, accent: Boolean, brandStyle: { type: Object, default: () => ({}) }, locateVisible: Boolean, locateDisabled: Boolean })
const emit = defineEmits(['settings', 'locate', 'show-import'])
const progress = computed(() => props.importTask ? importProgressValue(props.importTask) : props.download?.determinate ? props.download.percent : Number.NaN)
</script>
<template>
      <div class="launcher-controls" :class="{ 'download-active': download && !importTask }">
        <div class="launch-popup-anchor">
        <DownloadFlyout v-if="download && !importTask" :download="download" />
        <div class="launch-actions win-acrylic-host" :class="{ 'has-download': download && !importTask, 'has-accent': accent }" :style="brandStyle">
          <AcrylicSurface />
          <span v-if="accent" class="capsule-accent" aria-hidden="true"></span>
          <button v-if="importTask" class="launch-import-progress" type="button" :aria-label="Number.isFinite(progress) ? `查看导入进度，${Math.floor(progress)}%` : '查看导入进度'" @click="emit('show-import')">
            <MotionProgressRing :size="28" :value="progress" :label="Number.isFinite(progress) ? Math.floor(progress) : ''" aria-label="正在导入" />
          </button>
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
