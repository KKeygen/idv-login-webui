import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? collect(join(dir, item.name)) : item.name.endsWith('.vue') || item.name.endsWith('.js') ? [readFileSync(join(dir, item.name), 'utf8')] : [])
}

describe('legacy API surface', () => {
  it('keeps every interactive endpoint represented', () => {
    const source = collect(new URL('../src', import.meta.url).pathname).join('\n')
    const endpoints = ['manualChannels','list','qrcode','cancel-qr','switch','switch-status','del','rename','import','import-status','setDefault','clearDefault','get-auto-close-state','switch-auto-close-state','get-game-auto-start','set-game-auto-start','start-game','list-games','launcher-status','launcher-install','launcher-update','launcher-update-info','launcher-import-fever','launcher-set-default','launcher-remove-installation','fever-games','defaultChannel','get-login-delay','set-login-delay','cloud-sync/policy','cloud-sync/generate-master-key','cloud-sync/settings','cloud-sync/accounts','cloud-sync/probe','cloud-sync/run','cloud-sync/delete','cloud-sync/access-logs','export-logs','proxy-mode','set-proxy-mode','create-game-shortcut','scan-record-setting','native-save-setting']
    for (const endpoint of endpoints) expect(source, endpoint).toContain(`/${endpoint}`)
  })
})
