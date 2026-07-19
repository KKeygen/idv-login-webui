<script setup>
import { computed } from 'vue'
import { Layers3 } from '@lucide/vue'
import { resourceUrl } from '../api'
import { useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const distributions = computed(() => app.state.launcher?.distributions || [])
const currentTitle = computed(() => {
  const game = app.currentGame.value
  return game?.display_name || game?.app_name || game?.name || '游戏分发'
})
function iconOf(item) { return resourceUrl(item.launcher?.icon || item.launcher?.logo || app.currentGame.value?.icon || '') }
async function chooseGame(event) { await app.selectGame(event.target.value); app.setView('launcher') }
</script>

<template>
  <header class="game-rail">
    <label class="game-picker"><span>当前游戏</span><select :value="app.state.gameId" @change="chooseGame"><option v-for="game in app.state.games" :key="game.game_id" :value="game.game_id">{{ game.display_name || game.app_name || game.name || game.game_id }}</option></select></label>
    <div class="rail-divider"></div>
    <button v-for="item in distributions" :key="item.distribution_id" class="game-icon" :class="{ active: String(item.distribution_id) === app.state.distributionId }" :title="item.launcher?.display_name || item.launcher?.app_name || `分发 ${item.distribution_id}`" @click="app.setDistribution(item.distribution_id)">
      <img v-if="iconOf(item)" :src="iconOf(item)" alt="" /><span v-else>{{ String(item.distribution_id) }}</span>
    </button>
    <div v-if="!distributions.length" class="rail-empty"><Layers3 :size="17" /> 暂无分发信息</div>
    <div class="game-title"><strong>{{ currentTitle }}</strong><small>{{ app.state.gameId || '请选择游戏' }}</small></div>
  </header>
</template>
