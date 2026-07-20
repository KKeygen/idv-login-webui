import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? collect(join(dir, item.name)) : item.name.endsWith('.vue') || item.name.endsWith('.js') ? [readFileSync(join(dir, item.name), 'utf8')] : [])
}

describe('legacy API surface', () => {
  it('keeps every interactive endpoint represented', () => {
    const source = collect(new URL('../src', import.meta.url).pathname).join('\n')
    const endpoints = ['manualChannels','list','qrcode','cancel-qr','switch','switch-status','del','rename','import','import-status','setDefault','clearDefault','get-auto-close-state','switch-auto-close-state','get-game-auto-start','set-game-auto-start','start-game','list-games','launcher-status','launcher-locate','launcher-install','launcher-update','launcher-update-info','launcher-import-fever','launcher-set-default','launcher-remove-installation','fever-games','defaultChannel','get-login-delay','set-login-delay','cloud-sync/policy','cloud-sync/generate-master-key','cloud-sync/settings','cloud-sync/accounts','cloud-sync/probe','cloud-sync/run','cloud-sync/delete','cloud-sync/access-logs','export-logs','proxy-mode','set-proxy-mode','create-game-shortcut','scan-record-setting','native-save-setting','native/capabilities','native/pick-directory','native/pick-executable','native/path-status','native/task-status','fever-bridge']
    for (const endpoint of endpoints) expect(source, endpoint).toContain(`/${endpoint}`)
  })

  it('distinguishes a failed backend connection from the initial connecting state', () => {
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    expect(app).toContain("app.state.connection === 'disconnected' ? '工具未连接'")
  })

  it('deploys Fever UI only to the separate cloud field', () => {
    const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
    expect(workflow).toContain("github.ref == 'refs/heads/fever'")
    expect(workflow).toContain("cloud['login_base64_page_fever']")
    expect(workflow).toContain('git push origin HEAD:main')
    expect(workflow).not.toContain('cp dist/index.html target/assets/index.html')
  })
})
