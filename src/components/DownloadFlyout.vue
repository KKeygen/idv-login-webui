<script setup>
import { Clock3, Download, PackageOpen, ShieldCheck } from '@lucide/vue'
import { hasStageAmount, hasStageRate } from '../downloadPresentation'
import { stageAmount, stageRate } from '../launcherFormatting'
defineProps({ download: { type: Object, required: true } })
</script>
<template>
        <section class="download-flyout">
          <header>
            <strong>{{ download.display.label }}</strong>
            <span>{{ download.percent.toFixed(1) }}%</span>
            <span v-if="download.etaSupported" class="download-remaining" title="当前阶段的预估剩余时间，不含后续阶段；随实时进度和速率更新"><Clock3 :size="14" />{{ download.remaining }}</span>
          </header>
          <div v-if="hasStageAmount(download.stages.download) || hasStageAmount(download.stages.install) || hasStageRate(download.stages.verify)" class="download-stage-separator"></div>
          <div v-if="hasStageAmount(download.stages.download)" class="download-stage-block"><div><Download :size="12" /><span>下载</span></div><div class="download-stage-values"><span>{{ stageAmount(download.stages.download) }}</span><span v-if="hasStageRate(download.stages.download)">{{ stageRate(download.stages.download) }}</span></div></div>
          <div v-if="hasStageAmount(download.stages.install)" class="download-stage-block"><div><PackageOpen :size="12" /><span>安装</span></div><div class="download-stage-values"><span>{{ stageAmount(download.stages.install) }}</span><span v-if="hasStageRate(download.stages.install)">{{ stageRate(download.stages.install) }}</span></div></div>
          <div v-if="hasStageRate(download.stages.verify)" class="download-verify-row"><span><ShieldCheck :size="12" />校验</span><span>{{ stageRate(download.stages.verify) }}</span></div>
          <p v-if="download.error" class="download-error">{{ download.error }}</p>
        </section>
</template>
