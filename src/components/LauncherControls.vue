<script setup>
import { FolderOpen } from '@lucide/vue'
import AcrylicSurface from './AcrylicSurface.vue'
import AnimatedSettingsIcon from './AnimatedSettingsIcon.vue'
import DownloadFlyout from './DownloadFlyout.vue'
import MotionProgressRing from './MotionProgressRing.vue'
// Presentational shell only. The page supplies its primary-action slot and
// retains command decisions, network requests and stale-response protection.
defineProps({ download: { type: Object, default: null }, accent: Boolean, brandStyle: { type: Object, default: () => ({}) }, locateVisible: Boolean, locateDisabled: Boolean })
const emit = defineEmits(['settings', 'locate'])
</script>
<template>
      <div class="launcher-controls" :class="{ 'download-active': Boolean(download) }">
        <div class="launch-popup-anchor">
        <DownloadFlyout v-if="download" :download="download" />
        <div class="launch-actions win-acrylic-host" :class="{ 'has-download': Boolean(download), 'has-accent': accent }" :style="brandStyle">
          <AcrylicSurface />
          <span v-if="accent" class="capsule-accent" aria-hidden="true"></span>
          <MotionProgressRing
            v-if="download"
            class="download-percent-orb"
            :size="28"
            :value="download.determinate ? download.percent : Number.NaN"
            :label="download.determinate ? Math.floor(download.percent) : ''"
            aria-label="游戏下载进度"
          />
          <slot />
          <button class="icon-button game-settings-button" title="游戏设置" @click="emit('settings')"><AnimatedSettingsIcon :size="20" /></button>
        </div>
        </div>
        <button v-if="locateVisible" class="locate-existing" :disabled="locateDisabled" @click="emit('locate')"><FolderOpen :size="15" /> 已有游戏文件？选择游戏路径</button>
      </div>
</template>
