import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSwitchingDraft, normalizeSwitchingConfig, recentAccounts, supportsAccountSwitching, validateSwitchingDraft } from '../src/accountSwitching'

const catalog = [
  { local_game_id: 'h55:install-a', short_game_id: 'h55', accounts: Array.from({ length: 7 }, (_, i) => ({ uuid: `a${i}`, name: `账号${i}`, last_login_time: i })) },
  { local_game_id: 'h55:install-b', short_game_id: 'h55', accounts: [{ uuid: 'other', last_login_time: 100 }] },
]

describe('6.3.2 capability and explicit opt-in', () => {
  it.each(['', '6.3.1', '6.2.99', 'unknown', null, 'version 6.3.2'])('blocks old or unknown tool version %s', version => {
    expect(supportsAccountSwitching(version)).toBe(false)
  })
  it.each(['6.3.2', 'v6.3.2-stable', '6.3.2-beta.1', '6.3.10', '6.4.0', '7.0.0'])('supports compatible tool version %s', version => {
    expect(supportsAccountSwitching(version)).toBe(true)
  })
  it('defaults to opt-out while preparing checked preferences without writing', () => {
    const draft = createSwitchingDraft({}, catalog)
    expect(draft.enabled).toBe(false)
    expect(draft.onboarding_completed).toBe(false)
    expect(draft.auto_import_new).toBe(true)
    expect(draft.limit_enabled).toBe(true)
    expect(draft.recent_limit).toBe(5)
    expect(draft.games['h55:install-a'].enabled).toBe(false)
    expect(draft.games['h55:install-a'].account_uuids).toEqual(['a6', 'a5', 'a4', 'a3', 'a2'])
  })
  it('does not collapse two installations of the same game or shared mpay', () => {
    const draft = createSwitchingDraft({}, catalog)
    draft.games['h55:install-a'].enabled = true
    expect(draft.games['h55:install-b'].enabled).toBe(false)
    expect(draft.games['h55:install-b'].account_uuids).toEqual(['other'])
  })
  it('preserves saved empty selections and names, without mutating source', () => {
    const config = { enabled: true, games: { 'h55:install-a': { enabled: true, account_uuids: [] } } }
    const draft = createSwitchingDraft(config, catalog)
    expect(draft.games['h55:install-a'].account_uuids).toEqual([])
    draft.games['h55:install-a'].account_uuids.push('a1')
    expect(config.games['h55:install-a'].account_uuids).toEqual([])
    expect(catalog[0].accounts[0].name).toBe('账号0')
  })
  it('sorts valid last-login values without reordering source and rejects invalid limits', () => {
    const accounts = [{ uuid: 'never' }, { uuid: 'now', last_login_time: 7 }, { uuid: 'old', last_login_time: '3' }]
    expect(recentAccounts(accounts).map(a => a.uuid)).toEqual(['now', 'old', 'never'])
    expect(accounts[0].uuid).toBe('never')
    const draft = createSwitchingDraft({}, catalog)
    expect(validateSwitchingDraft({ ...draft, enabled: true }, catalog)).toContain('至少选择')
    for (const recent_limit of [0, -1, 1.5, '', 'oops', Infinity]) expect(validateSwitchingDraft({ ...draft, recent_limit }, catalog)).toContain('整数')
    expect(validateSwitchingDraft({ ...draft, recent_limit: 6 }, catalog)).toBe('')
  })
  it('normalizes a strict metadata-only outgoing shape', () => {
    const result = normalizeSwitchingConfig({ token: 'must-not-copy', games: { 'h55:a': { enabled: true, account_uuids: ['a', 'a'], token: 'must-not-copy' } } })
    expect(result.games['h55:a'].account_uuids).toEqual(['a'])
    expect(JSON.stringify(result)).not.toContain('token')
  })
})

const mocks = vi.hoisted(() => ({ request: vi.fn(), app: { state: { backendVersion: '' }, notify: vi.fn(), markUpdateRequired: vi.fn() } }))
vi.mock('../src/api', () => ({ request: mocks.request, ApiError: class ApiError extends Error { constructor(message, status) { super(message); this.status = status } } }))
vi.mock('../src/composables/useAppStore', () => ({ useAppStore: () => mocks.app }))

describe('account switching API guard', () => {
  let switching
  beforeEach(async () => {
    vi.resetModules()
    mocks.request.mockReset()
    mocks.app.state.backendVersion = ''
    switching = (await import('../src/composables/useAccountSwitching')).useAccountSwitching()
  })
  it('makes no new API calls on old or unknown backends, including direct entry and writes', async () => {
    for (const version of ['', '6.3.1']) {
      mocks.app.state.backendVersion = version
      await switching.load()
      await switching.openWizard()
      await switching.save({ enabled: true })
    }
    expect(mocks.request).not.toHaveBeenCalled()
    expect(switching.state.open).toBe(false)
  })
  it('opens with only a metadata read and keeps opt-out until finish', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    mocks.request.mockResolvedValue({ success: true, config: {}, games: catalog })
    await switching.openWizard()
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/account-list-config')
    expect(switching.state.config.enabled).toBe(false)
    expect(switching.state.open).toBe(true)
    await switching.dismiss()
    const body = mocks.request.mock.calls.at(-1)[1].body.config
    expect(body).toEqual({ onboarding_completed: true })
  })
  it('does not disable an existing configuration when reopened and canceled', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    mocks.request.mockResolvedValue({ success: true, config: { enabled: true, onboarding_completed: true }, games: catalog })
    await switching.openWizard()
    await switching.dismiss()
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(switching.state.config.enabled).toBe(true)
  })
  it('only acknowledges onboarding without resetting an already enabled selection', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    const config = { enabled: true, onboarding_completed: false, games: { 'h55:install-a': { enabled: true, account_uuids: ['a1'] } } }
    mocks.request.mockResolvedValueOnce({ success: true, config, games: catalog }).mockResolvedValueOnce({ success: true })
    await switching.openWizard()
    await switching.dismiss()
    expect(mocks.request.mock.calls[1]).toEqual(['/account-list-config', { method: 'POST', body: { config: { onboarding_completed: true } } }])
    expect(switching.state.config.enabled).toBe(true)
    expect(switching.state.config.games['h55:install-a'].account_uuids).toEqual(['a1'])
    expect(switching.state.config.onboarding_completed).toBe(true)
  })
  it('closes immediately when onboarding acknowledgement fails and only logs a status', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.request.mockResolvedValueOnce({ success: true, config: {}, games: catalog }).mockRejectedValueOnce(new Error('private backend details'))
    await switching.openWizard()
    switching.dismiss()
    expect(switching.state.open).toBe(false)
    expect(switching.state.saving).toBe(false)
    await vi.waitFor(() => expect(warning).toHaveBeenCalledWith('[account-switching] Onboarding acknowledgement failed', { status: 'network' }))
    expect(switching.state.error).toBe('')
    expect(switching.state.config.enabled).toBe(false)
    warning.mockRestore()
  })
  it('never blocks closure or configuration saves on a pending acknowledgement and deduplicates it', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    let resolveAcknowledgement
    mocks.request.mockResolvedValueOnce({ success: true, config: {}, games: catalog })
      .mockImplementationOnce(() => new Promise(resolve => { resolveAcknowledgement = resolve }))
      .mockResolvedValueOnce({ success: true, config: { enabled: true, onboarding_completed: true, recent_limit: 9 } })
    await switching.openWizard()
    switching.dismiss()
    switching.dismiss()
    expect(switching.state.open).toBe(false)
    expect(switching.state.saving).toBe(false)
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(await switching.save({ enabled: true, onboarding_completed: true, recent_limit: 9 })).toBe(true)
    const currentConfig = switching.state.config
    resolveAcknowledgement({ success: true, config: { enabled: false, recent_limit: 5 } })
    await Promise.resolve()
    expect(switching.state.config.enabled).toBe(true)
    expect(switching.state.config.recent_limit).toBe(9)
    expect(switching.state.config).toBe(currentConfig)
  })
  it('ignores an onboarding acknowledgement after its backend generation resets', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    let resolveAcknowledgement
    mocks.request.mockResolvedValueOnce({ success: true, config: {}, games: catalog })
      .mockImplementationOnce(() => new Promise(resolve => { resolveAcknowledgement = resolve }))
    await switching.openWizard()
    switching.dismiss()
    switching.reset()
    resolveAcknowledgement({ success: true })
    await Promise.resolve()
    expect(switching.state.config.onboarding_completed).toBe(false)
    expect(switching.state.open).toBe(false)
  })
  it('keeps final-save close protection while not conflating it with acknowledgement', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    let resolveSave
    mocks.request.mockResolvedValueOnce({ success: true, config: {}, games: catalog })
      .mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve }))
    await switching.openWizard()
    const save = switching.save({ enabled: true, onboarding_completed: true })
    switching.dismiss()
    expect(switching.state.open).toBe(true)
    expect(switching.state.saving).toBe(true)
    expect(mocks.request).toHaveBeenCalledTimes(2)
    resolveSave({ success: true, config: { enabled: true, onboarding_completed: true } })
    await save
  })
  it('serializes writes while a configuration save is pending', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    let resolveSave
    mocks.request.mockImplementation(() => new Promise(resolve => { resolveSave = resolve }))
    const first = switching.save({ enabled: true })
    expect(await switching.save({ enabled: false })).toBe(false)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    resolveSave({ success: true, config: { enabled: true } })
    expect(await first).toBe(true)
  })
  it('ignores a metadata response from an abandoned backend session', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    let resolveLoad
    mocks.request.mockImplementation(() => new Promise(resolve => { resolveLoad = resolve }))
    const pending = switching.openWizard()
    switching.reset()
    resolveLoad({ success: true, config: { enabled: true }, games: catalog })
    await pending
    expect(switching.state.open).toBe(false)
    expect(switching.state.loaded).toBe(false)
    expect(switching.state.config.enabled).toBe(false)
  })
  it('turns off only the new feature when its endpoint is missing', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    const { ApiError } = await import('../src/api')
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.request.mockRejectedValue(new ApiError('Not found', 404))
    await switching.openWizard()
    await switching.load()
    expect(switching.state.open).toBe(false)
    expect(switching.supported.value).toBe(false)
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(mocks.app.markUpdateRequired).toHaveBeenCalled()
    warning.mockRestore()
  })
  it('keeps the saved configuration intact after a failed write and allows retry', async () => {
    mocks.app.state.backendVersion = '6.3.2'
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.request.mockRejectedValueOnce(new Error('temporary failure'))
    expect(await switching.save({ enabled: true })).toBe(false)
    expect(switching.state.config.enabled).toBe(false)
    expect(switching.state.saving).toBe(false)
    mocks.request.mockResolvedValueOnce({ success: true, config: { enabled: true } })
    expect(await switching.save({ enabled: true })).toBe(true)
    expect(switching.state.config.enabled).toBe(true)
    warning.mockRestore()
  })
})

describe('wizard UI invariants', () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  it('keeps settings collapsed and entry version-gated', () => {
    expect(read('src/components/AccountSwitchingSettings.vue')).toContain('const expanded = ref(false)')
    expect(read('src/style.css')).toContain('.toasts { pointer-events: none;')
    expect(read('src/components/SettingsView.vue')).toContain('v-if="switching.supported.value"')
    expect(read('src/App.vue')).toContain("get('view') === 'account-switching'")
    expect(read('src/App.vue')).toContain('if (!switching.supported.value)')
    expect(read('src/composables/useAppStore.js')).not.toContain("'account-switching'])")
  })
  it('keeps account selection and both preferences together without resetting on load or save', () => {
    const wizard = read('src/components/AccountSwitchingWizard.vue')
    const fields = read('src/components/AccountSwitchingFields.vue')
    expect(wizard).toContain("const steps = ['功能介绍', '选择游戏', '账号与偏好', '更多说明']")
    expect(wizard).toContain(":section=\"step === 2 ? 'selection' : 'info'\"")
    expect(fields.match(/section === 'selection'/g)).toHaveLength(2)
    const loadingWatcher = wizard.slice(wizard.indexOf('watch(() => [switching.state.open'))
    expect(loadingWatcher).not.toContain('step.value = 0')
    expect(loadingWatcher).toContain('draftInitialized')
  })
  it('preserves the staging account display and inclusion metadata without its superseded quota API', () => {
    const accounts = read('src/components/AccountsView.vue')
    const settings = read('src/components/SettingsView.vue')
    const store = read('src/composables/useAppStore.js')
    expect(accounts).toContain('account?.display_name || account?.name')
    expect(accounts).toContain("account.display_name || account.name || '未命名账号'")
    expect(accounts).toContain('supportsAccountSwitching(app.state.backendVersion)')
    expect(accounts).toContain("typeof account.included === 'boolean' && typeof account.will_include === 'boolean'")
    expect(accounts).toContain("account.will_include ? '下次启动将包含'")
    expect(read('src/style.css')).toContain('.account-projection-state {')
    expect(accounts + settings + store).not.toMatch(/account_list_model_version|accountListModelVersion|account-list-settings|quotaOpen|globalLimit|togglePin|account\.pinned/)
  })
  it('uses compact game and account tables and the requested masked scan-page illustration', () => {
    const wizard = read('src/components/AccountSwitchingWizard.vue')
    const fields = read('src/components/AccountSwitchingFields.vue')
    const logo = read('src/components/MaskedGameLogo.vue')
    expect(wizard).toContain('现在：在扫码界面点击游戏图标切换')
    expect(wizard).toContain('<QrCode class="switching-scan-code"')
    expect(wizard).toContain('switching-scan-game-icon')
    expect(wizard.match(/<MaskedGameLogo/g)).toHaveLength(2)
    expect(logo).toContain('已打码的游戏品牌标识')
    expect(logo).toContain('stroke="#ec243a"')
    expect(wizard).toContain('<table class="switching-table switching-game-table"')
    expect(fields).toContain('<table class="switching-table switching-account-table"')
    expect(fields).toContain('scope="rowgroup"')
    expect(fields).toContain('上次登录</th>')
    expect(wizard + fields).not.toMatch(/switching-game-choice|switching-account-choice|switching-mini-tool|临时注入/)
    expect(fields).toContain('临时显示')
  })
  it('covers opt-in, installation scope, privacy and normal-exit behavior without old quota UI', () => {
    const wizard = read('src/components/AccountSwitchingWizard.vue')
    const fields = read('src/components/AccountSwitchingFields.vue')
    expect(wizard).toContain('新功能：游戏内切换渠道服账号向导')
    expect(wizard).toContain('您是否要配置游戏内切换渠道服账号？')
    expect(wizard).toContain(':key="game.local_game_id"')
    expect(wizard).toContain('不感兴趣')
    expect(fields).toContain('不从数据库读取登录凭据')
    expect(fields).toContain('请等待工具正常退出')
    expect(fields).toContain('双向同步')
    expect(wizard + fields).not.toContain('长期保存')
    expect(wizard + fields).not.toMatch(/account_list_model_version|全局配额|单游戏配额/)
  })
})
