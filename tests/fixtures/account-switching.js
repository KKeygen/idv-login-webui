// Synthetic fixture only: no real account credentials or user data.
export function accountSwitchingFixture() {
  const accounts = Array.from({ length: 7 }, (_, index) => ({
    uuid: `demo-${index + 1}`,
    name: ['常用账号', '周末小号', '朋友一起玩的账号', '练习账号', '备用账号', '测试账号', '很久没登录的账号'][index],
    selection_reason: index === 5 ? '登录已过期，请在账号管理中重新登录' : '',
    included: index < 5,
    will_include: index < 5,
    last_login_time: 1791000000 - index * 3600 * 24,
  }))
  return {
    success: true,
    config: { enabled: false, onboarding_completed: false, auto_import_new: true, limit_enabled: true, recent_limit: 5, games: {} },
    games: [
      { game_id: 'full-g-h55', short_game_id: 'h55', name: '第五人格', tool_account_count: 7, native_account_count: 2, accounts },
      { game_id: 'full-g-niche', short_game_id: 'niche', name: 'full-g-niche', tool_account_count: 7, native_account_count: 3, accounts },
      { game_id: 'full-g-g37', short_game_id: 'g37', name: '阴阳师', tool_account_count: 0, native_account_count: 1, accounts: [] },
    ],
  }
}
