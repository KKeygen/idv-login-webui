<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import ModalShell from './ModalShell.vue'
import AcrylicSurface from './AcrylicSurface.vue'
import { Plus, Search, Pin, FolderOpen } from '@lucide/vue'
import { freezeLeavingElement, clearLeavingElement } from '../motion'
import { request, resourceUrl } from '../api'
import { cmpGameId, gameTitle, isGameInstalled, shortGameId, useAppStore } from '../composables/useAppStore'

import { useGameImport } from '../composables/useGameImport'

const app = useAppStore()
const importing = useGameImport()
defineProps({ open: Boolean })
const emit = defineEmits(['pointer-enter', 'pointer-leave', 'catalog-change'])
const catalogOpen = ref(false)
const search = ref('')
function readPinned() { try { return localStorage.getItem('idv.rail.pinned') === 'true' } catch { return false } }
const pinned = ref(readPinned())
const draggingKey = ref('')
const versionGame = ref(null)
const versionPopup = ref(null)
const versionStyle = ref({})
let versionAnchor = null
const versionOptions = computed(() => versionGame.value ? distributionOptions(versionGame.value.game) : [])
function closeVersions(restore = false) {
  const anchor = versionAnchor
  versionGame.value = null
  versionAnchor = null
  document.removeEventListener('pointerdown', outsideVersions, true)
  document.removeEventListener('focusin', outsideVersions)
  document.removeEventListener('scroll', scrollVersions, true)
  window.removeEventListener('resize', placeVersions)
  window.removeEventListener('blur', blurVersions)
  if (restore && anchor?.isConnected) anchor.focus({ preventScroll: true })
}
function outsideVersions(event) {
  if (versionGame.value && !versionAnchor?.contains(event.target) && !versionPopup.value?.contains(event.target)) closeVersions()
}
function scrollVersions(event) { if (!versionPopup.value?.contains(event.target)) closeVersions() }
function blurVersions() { closeVersions() }
function placeVersions() {
  if (!versionAnchor || !versionPopup.value) return
  const r = versionAnchor.getBoundingClientRect(), edge = 8, gap = 6
  const width = Math.min(Math.max(r.width, 240), innerWidth - edge * 2)
  versionPopup.value.style.width = `${width}px`
  versionPopup.value.style.maxHeight = `${innerHeight - edge * 2}px`
  const height = Math.min(versionPopup.value.scrollHeight, innerHeight - edge * 2)
  const below = innerHeight - r.bottom - gap - edge
  const top = below >= height || below >= r.top - gap - edge ? r.bottom + gap : r.top - gap - height
  versionStyle.value = { left: `${Math.max(edge, Math.min(r.left, innerWidth - width - edge))}px`, top: `${Math.max(edge, Math.min(top, innerHeight - height - edge))}px`, width: `${width}px`, maxHeight: `${innerHeight - edge * 2}px` }
}
function versionKeys(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeVersions(true); return }
  const buttons = [...(versionPopup.value?.querySelectorAll('[role="menuitem"]') || [])]
  let index = buttons.indexOf(document.activeElement)
  if (event.key === 'ArrowDown') index = (index + 1) % buttons.length
  else if (event.key === 'ArrowUp') index = (index - 1 + buttons.length) % buttons.length
  else if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = buttons.length - 1
  else return
  event.preventDefault(); event.stopPropagation(); buttons[index]?.focus()
}
watch(search, () => closeVersions())
watch(versionOptions, options => { if (versionGame.value && options.length < 2) closeVersions() })
onBeforeUnmount(() => closeVersions())
function togglePinned() { pinned.value = !pinned.value; try { localStorage.setItem('idv.rail.pinned', String(pinned.value)) } catch {} }
function reorder(key, targetKey) {
  const keys = railItems.value.map(item => item.key)
  const from = keys.indexOf(key), to = keys.indexOf(targetKey)
  if (from < 0 || to < 0 || from === to) return
  keys.splice(from, 1); keys.splice(to, 0, key); app.reorderRailTabs(keys)
}
function moveByKeyboard(event, item) {
  if (!event.altKey || !['ArrowLeft','ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const index = railItems.value.findIndex(value => value.key === item.key)
  const target = railItems.value[index + (event.key === 'ArrowRight' ? 1 : -1)]
  if (target) reorder(item.key, target.key)
}
function dragStart(event, item) { draggingKey.value = item.key; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.key) }
function dropItem(event, item) { event.preventDefault(); if (draggingKey.value) reorder(draggingKey.value, item.key); draggingKey.value = '' }
function distributionOptions(game) {
  const record = app.state.railLaunchers.find(item => cmpGameId(item.game_id, game.game_id))
  return (record?.distributions || []).map(item => ({ value: item.distribution_id, label: item.launcher?.display_name || item.name || String(item.distribution_id), installed: Boolean(item.installation?.installed) }))
}
async function chooseCatalog(item, event) {
  if (distributionOptions(item.game).length > 1) {
    const anchor = event.currentTarget
    const wasOpen = versionGame.value?.key === item.key
    closeVersions()
    if (wasOpen) return
    versionAnchor = anchor
    versionGame.value = item
    await nextTick()
    if (!versionGame.value || versionAnchor !== anchor) return
    placeVersions()
    versionPopup.value?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true })
    document.addEventListener('pointerdown', outsideVersions, true)
    document.addEventListener('focusin', outsideVersions)
    document.addEventListener('scroll', scrollVersions, true)
    window.addEventListener('resize', placeVersions)
    window.addEventListener('blur', blurVersions)
    return
  }
  await chooseGame(item.game.game_id)
}
let dragCandidate = null
const railItems = computed(() => app.state.railTabs.map(tab => {
  const game = app.state.games.find(item => cmpGameId(item.game_id, tab.game_id)) || { game_id: tab.game_id }
  const launcher = app.state.railLaunchers.find(item => cmpGameId(item.game_id, tab.game_id))
  const distribution = launcher?.distributions?.find(item => String(item.distribution_id) === String(tab.distribution_id)) || null
  const title = distribution?.launcher?.display_name || distribution?.launcher?.app_name || titleOf(game)
  return {
    key: tab.key,
    tab,
    title,
    icon: iconOfDistribution(distribution, game),
    fallback: title.slice(0, 1),
    active: cmpGameId(tab.game_id, app.state.gameId)
      && String(tab.distribution_id) === String(app.state.distributionId),
  }
}))
const catalogItems = computed(() => app.state.games.map(game => ({
  game,
  key: game.game_id,
  title: titleOf(game),
  banner: bannerOf(game),
  logo: resourceUrl(launcherOf(game).game_library_logo || launcherOf(game).logo || ''),
  icon: iconOfGame(game),
  installed: isGameInstalled(game),
  active: cmpGameId(game.game_id, app.state.gameId),
})).filter(item => {
  const term = search.value.trim().toLocaleLowerCase()
  return !term || `${item.title} ${item.game.game_id} ${shortGameId(item.game.game_id)}`.toLocaleLowerCase().includes(term)
}))

function launcherOf(game) { return game?.launcher || {} }
function titleOf(game) {
  return gameTitle(game)
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
async function chooseGame(gameId, distributionId = '') {
  closeCatalog()
  await app.selectGame(gameId, { view: 'launcher', distributionId })
}
function openCatalog() {
  catalogOpen.value = true
  emit('catalog-change', true)
}
function closeCatalog() {
  closeVersions()
  catalogOpen.value = false
  emit('catalog-change', false)
}
async function openImportWizard() {
  // Release the selector's focus/inert layer before opening the existing wizard.
  closeCatalog()
  await nextTick()
  importing.openWizard()
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
  if (dragCandidate?.pointerId === event.pointerId) dragCandidate = null
  if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function toggleWindowMaximize(event) {
  dragCandidate = null
  if (isInteractiveTarget(event.target)) return
  request('/native/window-toggle-maximize', { method: 'POST' }).catch(() => {})
}
</script>

<template>
  <header class="game-rail" :class="{ open: open || pinned }" @pointerenter="emit('pointer-enter', $event)" @pointerleave="emit('pointer-leave', $event)" @pointerdown="prepareWindowDrag" @pointermove="continueWindowDrag" @pointerup="cancelWindowDrag" @pointercancel="cancelWindowDrag" @dblclick="toggleWindowMaximize">
    <TransitionGroup name="rail-item" tag="div" class="game-rail-items">
      <button v-for="item in railItems" :key="item.key" class="game-tab" :class="{ active: item.active, 'is-dragging': draggingKey === item.key }" :aria-label="item.title" draggable="true" @dragstart="dragStart($event, item)" @dragend="draggingKey = ''" @dragover.prevent @drop="dropItem($event, item)" @keydown="moveByKeyboard($event, item)" @click="activateRailItem(item)">
        <span class="game-tab-icon"><img v-if="item.icon" :src="item.icon" alt="" width="40" height="40" decoding="async" /><span v-else>{{ item.fallback }}</span><span class="game-icon-mask" aria-hidden="true"></span></span>
      </button>
      <button key="add-game" class="game-tab add-game-tab" aria-label="打开游戏库" @click="openCatalog">
        <span class="game-tab-icon"><Plus :size="21" /></span>
      </button>
    </TransitionGroup>
    <button class="icon-button rail-pin" :aria-pressed="pinned" :title="pinned ? '取消固定游戏栏' : '固定游戏栏'" @click="togglePinned"><Pin :size="16" /></button>

    <ModalShell :open="catalogOpen" title="游戏库" headerless motion-mode="selector" modal-class="game-catalog-modal" @close="closeCatalog">
          <section class="game-catalog-panel">
            <header><div><small>游戏库</small><h2>选择游戏</h2></div></header>
            <div class="game-catalog-toolbar">
              <label class="game-catalog-search"><Search :size="18" /><input v-model="search" type="search" aria-label="搜索游戏名称或短 ID" :placeholder="`在 ${app.state.games.length} 个游戏中搜索`" /></label>
              <button v-if="importing.supported.value" type="button" class="quiet-button catalog-import-button" :title="importing.state.task || importing.state.uncertain ? '查看导入进度或结果' : '导入已安装游戏'" @click="openImportWizard"><FolderOpen :size="17" /><span>导入已安装游戏</span><i v-if="importing.pending.value" class="import-task-dot" aria-label="正在导入"></i></button>
            </div>
            <p v-if="!catalogItems.length" class="muted">没有找到匹配的游戏，请尝试其他名称或短 ID。</p>
            <TransitionGroup name="catalog-item" @before-leave="freezeLeavingElement" @leave-cancelled="clearLeavingElement" @after-enter="clearLeavingElement" tag="div" class="game-catalog-grid">
              <div v-for="item in catalogItems" :key="item.key" class="game-catalog-entry">
                <button class="game-catalog-card" :class="{ active: item.active }" :aria-haspopup="distributionOptions(item.game).length > 1 ? 'menu' : undefined" :aria-expanded="distributionOptions(item.game).length > 1 ? versionGame?.key === item.key : undefined" :aria-controls="versionGame?.key === item.key ? 'catalog-version-menu' : undefined" @click="chooseCatalog(item, $event)">
                  <img v-if="item.banner" :src="item.banner" alt="" width="320" height="145" loading="lazy" decoding="async" />
                  <div v-else class="catalog-card-placeholder"></div>
                  <div v-if="item.logo" class="catalog-card-brand"><img :src="item.logo" alt="" /></div>
                  <div class="catalog-card-detail"><img v-if="item.icon" :src="item.icon" alt="" /><strong>{{ distributionOptions(item.game).length > 1 ? '选择版本' : item.title }}</strong></div>
                  <span><strong>{{ item.title }}</strong><small><template v-if="distributionOptions(item.game).length > 1">{{ distributionOptions(item.game).length }} 个版本 · </template>{{ item.installed ? '已安装' : item.game.platform_type === 'native' ? '选择路径' : '未安装' }}</small></span>
                </button>
              </div>
            </TransitionGroup>
            <div v-if="versionGame" id="catalog-version-menu" ref="versionPopup" class="catalog-version-menu win-acrylic-host" :style="versionStyle" role="menu" :aria-label="`${versionGame.title}版本`" @keydown="versionKeys">
              <AcrylicSurface variant="default" />
              <div class="catalog-version-heading">选择 {{ versionGame.title }} 版本</div>
              <button v-for="option in versionOptions" :key="option.value" type="button" role="menuitem" class="catalog-version-option" @click="chooseGame(versionGame.game.game_id, option.value)">
                <span>{{ option.label }}</span><small v-if="option.installed">已安装</small>
              </button>
            </div>
          </section>
    </ModalShell>
  </header>
</template>
