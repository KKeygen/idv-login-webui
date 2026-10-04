<script setup>
import { computed } from 'vue'
import { Info, ShieldCheck, ArrowLeftRight, LogOut, ExternalLink } from '@lucide/vue'
import { openExternal } from '../api'
import { ACCOUNT_SWITCHING_HELP, recentAccounts } from '../accountSwitching'
import { gameTitle } from '../composables/useAppStore'

const props = defineProps({ draft: { type: Object, required: true }, games: { type: Array, default: () => [] }, section: { type: String, default: 'all' }, disabled: Boolean })
const selectedGames = computed(() => props.games.filter(game => props.draft.games[game.short_game_id]?.enabled))
function toggleAccount(scope, uuid) {
  if (props.disabled) return
  const entry = props.draft.games[scope]
  entry.account_uuids = entry.account_uuids.includes(uuid) ? entry.account_uuids.filter(value => value !== uuid) : [...entry.account_uuids, uuid]
}
function formatTime(value) {
  if (!value) return '从未登录'
  const date = new Date(Number(value) * 1000)
  return Number.isNaN(date.getTime()) ? '登录时间未知' : date.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="switching-fields">
    <section v-if="section === 'accounts' || section === 'selection' || section === 'all'" class="switching-account-section">
      <div class="switching-section-heading"><h3>选择账号</h3><span>默认勾选最近登录的 5 个，跳过已知需处理的账号</span></div>
      <div v-if="selectedGames.length" class="switching-table-wrap switching-account-table-wrap">
        <table class="switching-table switching-account-table" aria-label="选择游戏内显示的账号">
          <thead><tr><th class="switching-check-cell" scope="col">选择</th><th scope="col">账号</th><th class="switching-time-cell" scope="col">上次登录</th></tr></thead>
          <tbody v-for="game in selectedGames" :key="game.short_game_id">
            <tr class="switching-table-group"><th colspan="3" scope="rowgroup"><div><span><strong>{{ gameTitle(game) }}</strong> <span v-if="game.name && game.name !== game.game_id && game.name !== game.short_game_id" class="switching-short-id">{{ game.short_game_id }}</span></span><span class="switching-selected-count">{{ draft.games[game.short_game_id].account_uuids.length }} / {{ game.accounts.length }} 已选</span></div></th></tr>
            <tr v-if="!game.accounts.length"><td colspan="3" class="switching-inline-empty">暂无工具账号</td></tr>
            <tr v-for="account in recentAccounts(game.accounts)" :key="account.uuid" :class="{ selected: draft.games[game.short_game_id].account_uuids.includes(account.uuid) }">
              <td class="switching-check-cell"><input :id="`switching-account-${game.short_game_id}-${account.uuid}`" type="checkbox" :aria-label="`选择${account.display_name || account.name || '未命名账号'}`" :disabled="disabled" :checked="draft.games[game.short_game_id].account_uuids.includes(account.uuid)" @change="toggleAccount(game.short_game_id, account.uuid)" /></td>
              <td><label :for="`switching-account-${game.short_game_id}-${account.uuid}`">{{ account.display_name || account.name || '未命名账号' }}<span v-if="account.selection_reason" class="switching-account-reason">（{{ account.selection_reason }}）</span></label></td>
              <td class="switching-time-cell">{{ formatTime(account.last_login_time) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="switching-inline-empty">请先在向导中选择游戏。</p>
      <p v-if="selectedGames.length" class="switching-option-note">仍可手动选择带提示的账号。完成时只保存选择，不等待账号检查；实际使用时再按账号状态处理。</p>
    </section>

    <section v-if="section === 'options' || section === 'selection' || section === 'all'" class="switching-options">
      <label class="switching-option"><input v-model="draft.auto_import_new" type="checkbox" :disabled="disabled" /><span>自动导入后续新登录的账号</span></label>
      <div class="switching-limit-inline">
        <label><input v-model="draft.limit_enabled" type="checkbox" :disabled="disabled" /><span>每个游戏显示最近</span></label>
        <input v-model.number="draft.recent_limit" aria-label="每个游戏显示最近几个工具导入账号" type="number" min="1" step="1" :disabled="disabled || !draft.limit_enabled" /><span>个工具导入账号</span>
      </div>
      <p class="switching-option-note">原生账号不计入，不会因此隐藏或删除。</p>
      <p class="switching-soft-warning"><Info :size="16" />建议控制官服+渠道服的账号数量在10个以内，超出10个会在游戏中显示不全</p>
    </section>

    <section v-if="section === 'info' || section === 'all'" class="switching-info">
      <h3>使用说明</h3>
      <div><ShieldCheck :size="21" /><p><strong>登录凭据只写入，不读取</strong><span>只写入您选择的账号凭据，不从数据库读取登录凭据。名称、标识等元数据用于展示与同步。</span></p></div>
      <div><ArrowLeftRight :size="21" /><p><strong>工具改名同步到游戏，删除双向同步</strong><span>在账号管理中改名会同步到游戏；删除操作仍双向同步。</span></p></div>
      <div><LogOut :size="21" /><p><strong>退出时清理，下次启动恢复</strong><span>退出时清理临时显示的账号，下次启动按设置恢复。请等待工具正常退出。</span></p></div>
      <button class="text-button switching-help-link" type="button" @click="openExternal(ACCOUNT_SWITCHING_HELP)">查看详细说明<ExternalLink :size="14" /></button>
    </section>
  </div>
</template>
