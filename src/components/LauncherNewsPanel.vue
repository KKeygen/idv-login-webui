<script setup>
import { Newspaper } from '@lucide/vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { formatNewsDate } from '../launcherFormatting'
defineProps({ visible: Boolean, cover: { type: String, default: '' }, items: { type: Array, default: () => [] }, moreUrl: { type: String, default: '' } })
const emit = defineEmits(['hide', 'open'])
</script>
<template>
      <Transition name="panel-reveal">
        <section v-if="visible" class="news-card glass win-acrylic-host">
        <AcrylicSurface />
        <img v-if="cover" class="news-cover" :src="cover" alt="" width="470" height="176" loading="lazy" decoding="async" />
        <header><div><Newspaper :size="18" /> 新闻</div><button class="ghost compact" @click="emit('hide')">隐藏</button></header>
        <template v-if="items.length"><a v-for="item in items.slice(0, 3)" :key="item.id || item.url || item.title" href="#" @click.prevent="emit('open', item.url)"><span>{{ item.title }}</span><time>{{ formatNewsDate(item.release_time) }}</time></a><button v-if="moreUrl" class="news-more" @click="emit('open', moreUrl)">查看更多</button></template>
        <p v-else class="muted">当前游戏暂无新闻。可在设置中隐藏此面板。</p>
        </section>
      </Transition>
</template>
