import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  availableInstallBytes,
  hasKnownInstallCapacity,
  requiredInstallBytes,
} from '../src/installRequirements.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = path => readFileSync(resolve(root, path), 'utf8')
const requireText = (path, fragments) => {
  const content = source(path)
  for (const fragment of fragments) {
    assert.ok(content.includes(fragment), `${path} is missing logic invariant: ${fragment}`)
  }
}

// Installation-space compatibility and zero-capacity edge cases.
assert.equal(requiredInstallBytes({ required_bytes: 90, unzip_bytes: 120, download_bytes: 50 }), 90)
assert.equal(requiredInstallBytes({ unzip_bytes: 120, download_bytes: 50 }), 120)
assert.equal(requiredInstallBytes({ unzip_bytes: 0, download_bytes: 50 }), 50)
assert.equal(requiredInstallBytes({}), 0)
assert.equal(availableInstallBytes({ disk_free_bytes: 0 }), 0)
assert.equal(hasKnownInstallCapacity('D:/Games', { disk_free_bytes: 0 }), true)
assert.equal(hasKnownInstallCapacity('D:/Games', null), false)

// Static invariants for lifecycle and stale-response protection. These checks
// deliberately fail when a future refactor removes a guard without replacing
// it with an equivalent mechanism.
requireText('src/App.vue', ['<Transition name="page-change" mode="out-in">'])
requireText('src/components/ModalShell.vue', [
  'isTopModal(modalToken)',
  '@click.self="requestClose"',
  ':disabled="!dismissible"',
  ':style="{ zIndex: modalZIndex }"',
  '@after-leave="handleAfterLeave"',
])
requireText('src/components/LauncherView.vue', [
  'function captureSelection()',
  'function selectionMatches(scope)',
  'pathRequestGeneration',
  'installModalOpen.value = false',
  'gameSettingsOpen.value = false',
])
requireText('src/components/GameSettingsModal.vue', [
  'let loadGeneration = 0',
  'function scopeMatches(scope)',
  'generation !== loadGeneration',
])
requireText('src/components/SettingsView.vue', [
  'let terminalGeneration = 0',
  'generation !== terminalGeneration',
  'onDeactivated(() =>',
  'viewActive = false',
])
requireText('src/components/AccountsView.vue', [
  'watch(() => app.state.gameId',
  'selected.value = new Set()',
  'const gameId = app.state.gameId',
  'function scheduleQrPoll(target, gameId)',
  'onDeactivated(leaveAccounts)',
])
const dialogHost = source('src/components/AppDialogHost.vue')
assert.equal(dialogHost.includes("document.addEventListener('keydown'"), false, 'AppDialogHost must not install a document-wide Enter handler')
requireText('src/components/CloudSyncView.vue', [
  'let probeGeneration = 0',
  'generation !== probeGeneration',
  ':dismissible="!working"',
])
requireText('scripts/build-standalone.mjs', ["'src/installRequirements.js'", "'src/modalStack.js'"])

console.log('Logic invariants checked successfully.')
