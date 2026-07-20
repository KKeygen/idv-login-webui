<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, Layers3, X } from '@lucide/vue'
import { resourceUrl } from '../api'
import { useAppStore } from '../composables/useAppStore'

const app = useAppStore()
const catalogOpen = ref(false)
const distributions = computed(() => app.state.launcher?.distributions || [])
const currentTitle = computed(() => titleOf(app.currentGame.value))

function launcherOf(game = {}) { return game.launcher || {} }
function titleOf(game = {}) {
  const launcher = launcherOf(game)
  return launcher.display_name || launcher.app_name || game.display_name || game.app_name || game.name || game.game_id || '游戏'
}
function iconOfDistribution(item) {
  return resourceUrl(item.launcher?.icon || item.launcher?.logo || launcherOf(app.currentGame.value).icon || app.currentGame.value?.icon || '')
}
function iconOfGame(game) {
  const launcher = launcherOf(game)
  return resourceUrl(launcher.icon || launcher.logo || game.icon || game.logo || '')
}
function bannerOf(game) {
  const launcher = launcherOf(game)
  return resourceUrl(launcher.main_image || launcher.background_image || game.goods_image || '')
}
function isInstalled(game) {
  return Boolean(game.path || game.installations?.some(item => item.installed))
}
async function chooseGame(gameId) {
  catalogOpen.value = false
  await app.selectGame(gameId)
  app.setView('launcher')
}
</script>

<template>
  <header class="game-rail">
    <button class="current-game-button" :title="`选择游戏：${currentTitle}`" @click="catalogOpen = !catalogOpen">
      <img v-if="iconOfGame(app.currentGame.value)" :src="iconOfGame(app.currentGame.value)" alt="" />
      <span v-else>{{ currentTitle.slice(0, 1) }}</span>
      <ChevronDown :size="15" :class="{ rotated: catalogOpen }" />
    </button>
    <div class="rail-divider"></div>
    <button v-for="item in distributions" :key="item.distribution_id" class="game-icon" :class="{ active: String(item.distribution_id) === app.state.distributionId }" :title="item.launcher?.display_name || item.launcher?.app_name || currentTitle" @click="app.setDistribution(item.distribution_id)">
      <img v-if="iconOfDistribution(item)" :src="iconOfDistribution(item)" alt="" /><span v-else>{{ currentTitle.slice(0, 1) }}</span>
    </button>
    <div v-if="!distributions.length" class="rail-empty"><Layers3 :size="17" /> 暂无可用分发</div>
    <div class="game-title"><strong>{{ currentTitle }}</strong></div>

    <Teleport to="body">
      <div v-if="catalogOpen" class="game-catalog-overlay" @click.self="catalogOpen = false">
        <section class="game-catalog-panel">
          <header><div><small>游戏库</small><h2>选择游戏</h2></div><button class="icon-button" title="关闭" @click="catalogOpen = false"><X :size="20" /></button></header>
          <div class="game-catalog-grid">
            <button v-for="game in app.state.games" :key="game.game_id" class="game-catalog-card" :class="{ active: String(game.game_id) === String(app.state.gameId) }" @click="chooseGame(game.game_id)">
              <img v-if="bannerOf(game)" :src="bannerOf(game)" alt="" />
              <div v-else class="catalog-card-placeholder"><img v-if="iconOfGame(game)" :src="iconOfGame(game)" alt="" /></div>
              <span><strong>{{ titleOf(game) }}</strong><small>{{ isInstalled(game) ? '已安装' : '未安装' }}</small></span>
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </header>
</template>
