// Account switching is an explicit opt-in feature introduced in tool 6.3.2.
// Keep installation scope keys intact: different local installs may share mpay.
export const ACCOUNT_SWITCHING_VERSION = '6.3.2'
export const ACCOUNT_SWITCHING_HELP = 'https://kkeygenn.feishu.cn/wiki/J0V4wbm3Bi5LOVkEN7wcvwSEn0e'

export function supportsAccountSwitching(version) {
  const match = String(version || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+][\w.-]+)?$/i)
  if (!match) return false
  const current = match.slice(1, 4).map(Number)
  const minimum = [6, 3, 2]
  for (let index = 0; index < minimum.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index]
  }
  return true
}

export function recentAccounts(accounts = []) {
  return [...accounts].sort((left, right) => (Number(right.last_login_time) || 0) - (Number(left.last_login_time) || 0))
}

export function normalizeSwitchingConfig(config = {}) {
  const games = {}
  for (const [scope, value] of Object.entries(config.games || {})) {
    games[scope] = {
      enabled: Boolean(value?.enabled),
      account_uuids: [...new Set((value?.account_uuids || []).filter(uuid => typeof uuid === 'string'))],
    }
  }
  return {
    enabled: Boolean(config.enabled),
    onboarding_completed: Boolean(config.onboarding_completed),
    auto_import_new: config.auto_import_new !== false,
    limit_enabled: config.limit_enabled !== false,
    recent_limit: Number.isInteger(Number(config.recent_limit)) && Number(config.recent_limit) > 0 ? Number(config.recent_limit) : 5,
    games,
  }
}

export function createSwitchingDraft(config = {}, games = []) {
  const draft = normalizeSwitchingConfig(config)
  for (const game of games) {
    const scope = game.local_game_id
    if (!scope) continue
    const previous = draft.games[scope]
    const known = new Set((game.accounts || []).map(account => account.uuid))
    draft.games[scope] = {
      enabled: Boolean(previous?.enabled),
      // Disabled installs have never opted in; offer the latest five when chosen.
      // Preserve an intentional empty selection for previously enabled installs.
      account_uuids: previous?.enabled
        ? previous.account_uuids.filter(uuid => known.has(uuid))
        : recentAccounts(game.accounts).slice(0, 5).map(account => account.uuid),
    }
  }
  return draft
}

export function validateSwitchingDraft(draft, games) {
  if (!Number.isInteger(Number(draft.recent_limit)) || Number(draft.recent_limit) < 1) return '请输入至少为 1 的整数'
  if (draft.enabled && !games.some(game => draft.games[game.local_game_id]?.enabled)) return '请至少选择一个已安装游戏'
  return ''
}
