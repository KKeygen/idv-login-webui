<script setup>
import { computed, ref } from 'vue'
import { Plus, X } from '@lucide/vue'
import { request, resourceUrl } from '../api'
import { cmpGameId, isGameInstalled, useAppStore } from '../composables/useAppStore'

const app = useAppStore()
defineProps({ open: Boolean })
const emit = defineEmits(['pointer-enter', 'pointer-leave', 'catalog-change'])
const catalogOpen = ref(false)
let dragCandidate = null
const railItems = computed(() => app.state.railTabs.map(tab => {
  const game = app.state.games.find(item => cmpGameId(item.game_id, tab.game_id)) || { game_id: tab.game_id }
  const launcher = app.state.railLaunchers.find(item => cmpGameId(item.game_id, tab.game_id))
  const distribution = launcher?.distributions?.find(item => String(item.distribution_id) === String(tab.distribution_id)) || null
  return { key: tab.key, tab, game, distribution }
}))

function launcherOf(game) { return game?.launcher || {} }
function titleOf(game) {
  const value = game || {}
  const launcher = launcherOf(value)
  return launcher.display_name || launcher.app_name || value.display_name || value.app_name || value.name || value.game_id || '游戏'
}
function iconOfDistribution(item, game) {
  return resourceUrl(item?.launcher?.icon || item?.launcher?.logo || launcherOf(game).icon || game?.icon || '')
}
function iconOfGame(game) {
  const value = game || {}
  const launcher = launcherOf(value)
  return resourceUrl(launcher.icon || launcher.logo || value.icon || value.logo || '')
}
function bannerOf(game) {
  const value = game || {}
  const launcher = launcherOf(value)
  return resourceUrl(launcher.main_image || launcher.background_image || value.goods_image || '')
}
async function chooseGame(gameId) {
  closeCatalog()
  await app.selectGame(gameId, { view: 'launcher' })
}
function openCatalog() {
  catalogOpen.value = true
  emit('catalog-change', true)
}
function closeCatalog() {
  catalogOpen.value = false
  emit('catalog-change', false)
}
function railTitle(item) {
  return item.distribution?.launcher?.display_name || item.distribution?.launcher?.app_name || titleOf(item.game)
}
function railIcon(item) {
  return iconOfDistribution(item.distribution, item.game)
}
function railFallback(item) { return railTitle(item).slice(0, 1) }
function isActive(item) {
  return cmpGameId(item.tab.game_id, app.state.gameId)
    && String(item.tab.distribution_id) === String(app.state.distributionId)
}
function activateRailItem(item) {
  app.selectRailTab(item.tab)
}
function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"]'))
}
function prepareWindowDrag(event) {
  if (event.button !== 0 || isInteractiveTarget(event.target)) return
  dragCandidate = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  event.currentTarget?.setPointerCapture?.(event.pointerId)
}
function continueWindowDrag(event) {
  if (!dragCandidate || dragCandidate.pointerId !== event.pointerId || !(event.buttons & 1)) return
  if (Math.hypot(event.clientX - dragCandidate.x, event.clientY - dragCandidate.y) < 3) return
  dragCandidate = null
  request('/native/window-drag', { method: 'POST' }).catch(() => {})
}
function cancelWindowDrag(event) {
  if (!event || dragCandidate?.pointerId === event.pointerId) dragCandidate = null
  if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function toggleWindowMaximize(event) {
  dragCandidate = null
  if (isInteractiveTarget(event.target)) return
  request('/native/window-toggle-maximize', { method: 'POST' }).catch(() => {})
}
</script>

<template>
  <header class="game-rail" :class="{ open }" @pointerenter="emit('pointer-enter', $event)" @pointerleave="emit('pointer-leave', $event)" @pointerdown="prepareWindowDrag" @pointermove="continueWindowDrag" @pointerup="cancelWindowDrag" @pointercancel="cancelWindowDrag" @dblclick="toggleWindowMaximize">
    <button v-for="item in railItems" :key="item.key" class="game-tab" :class="{ active: isActive(item) }" :aria-label="railTitle(item)" @click="activateRailItem(item)">
      <span class="game-tab-icon"><img v-if="railIcon(item)" :src="railIcon(item)" alt="" decoding="async" /><span v-else>{{ railFallback(item) }}</span></span>
      <span class="game-tab-tooltip">{{ railTitle(item) }}</span>
    </button>
    <button class="game-tab add-game-tab" aria-label="安装其他游戏" @click="openCatalog">
      <span class="game-tab-icon"><Plus :size="21" /></span>
      <span class="game-tab-tooltip">安装其他游戏</span>
    </button>

    <Teleport to="body">
      <div v-if="catalogOpen" class="game-catalog-overlay" @click.self="closeCatalog">
        <section class="game-catalog-panel">
          <header><div><small>游戏库</small><h2>安装或选择游戏</h2></div><button class="icon-button" title="关闭" @click="closeCatalog"><X :size="20" /></button></header>
          <div class="game-catalog-grid">
            <button v-for="game in app.state.games" :key="game.game_id" class="game-catalog-card" :class="{ active: String(game.game_id) === String(app.state.gameId) }" @click="chooseGame(game.game_id)">
              <img v-if="bannerOf(game)" :src="bannerOf(game)" alt="" loading="lazy" decoding="async" />
              <div v-else class="catalog-card-placeholder"><img v-if="iconOfGame(game)" :src="iconOfGame(game)" alt="" loading="lazy" decoding="async" /></div>
              <span><strong>{{ titleOf(game) }}</strong><small>{{ isGameInstalled(game) ? '已安装' : '未安装' }}</small></span>
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </header>
</template>
