import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const deploy = workflow.split('\n  deploy:\n')[1]
const artifact = workflow.split('      - name: Upload branch build\n')[1].split('\n  deploy:')[0]
const jobGate = deploy.match(/^    if: (.+)$/m)[1]
const artifactGate = artifact.match(/^        if: (.+)$/m)[1]
// These checked-in expressions use only the shared GitHub/JavaScript boolean subset.
const applies = (expression, event_name, ref) => Function('github', `return (${expression})`)({ event_name, ref })

describe('release branch routing', () => {
  it.each([
    ['push', 'refs/heads/main', true, true],
    ['workflow_dispatch', 'refs/heads/main', true, true],
    ['push', 'refs/heads/fever', false, true],
    ['workflow_dispatch', 'refs/heads/fever', false, true],
    ['pull_request', 'refs/heads/main', false, false],
    ['pull_request', 'refs/pull/1/merge', false, false],
    ['push', 'refs/heads/fever-staging', false, false],
    ['push', 'refs/heads/staging', false, false],
    ['push', 'refs/heads/feature/example', false, false],
    ['push', 'refs/tags/v1.0.0', false, false],
  ])('%s %s routes candidate=%s artifact=%s', (event, ref, candidate, upload) => {
    expect(applies(jobGate, event, ref)).toBe(candidate)
    expect(applies(artifactGate, event, ref)).toBe(upload)
  })

  it('requires CI, keeps read-only token permissions and branch-specific artifacts', () => {
    expect(deploy).toContain('    needs: test')
    expect(workflow).toContain('permissions:\n  contents: read')
    expect(artifact).toContain('uses: actions/upload-artifact@v4')
    expect(artifact).toContain('name: webui-${{ github.ref_name }}-${{ github.sha }}')
    expect(artifact).toContain('path: dist/index.html')
    expect(artifact).toContain('if-no-files-found: error')
    expect(deploy).toContain('bash scripts/stage-fever-ui.sh target dist/index.html')
  })

  it('updates only the local candidate, preserves pending data, and is idempotent', () => {
    const root = mkdtempSync(join(tmpdir(), 'webui-candidate-test-'))
    const remote = join(root, 'remote.git')
    const seed = join(root, 'seed')
    const target = join(root, 'target')
    const html = join(root, 'index.html')
    const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    try {
      git(root, 'init', '--bare', '--initial-branch=main', remote)
      git(root, 'clone', remote, seed)
      git(seed, 'config', 'user.name', 'Fixture')
      git(seed, 'config', 'user.email', 'fixture@example.invalid')
      execFileSync('mkdir', ['-p', join(seed, 'assets')])
      writeFileSync(join(seed, 'assets/cloudRes.json'), JSON.stringify({
        login_base64_page_fever: 'old',
        login_base64_page: 'preserved legacy page',
        lastModified: 1,
        _signature: { value: 'old signature' },
      }, null, 2) + '\n')
      git(seed, 'add', '.')
      git(seed, 'commit', '-m', 'fixture baseline')
      git(seed, 'push', 'origin', 'main')
      git(seed, 'checkout', '-b', 'cloud-config-staging')
      const pendingPath = join(seed, 'assets/cloudRes.json')
      const pendingCloud = JSON.parse(readFileSync(pendingPath, 'utf8'))
      pendingCloud.pending_review = 'preserve this candidate field'
      writeFileSync(pendingPath, JSON.stringify(pendingCloud, null, 2) + '\n')
      git(seed, 'add', 'assets/cloudRes.json')
      git(seed, 'commit', '-m', 'pending candidate-only change')
      git(seed, 'push', 'origin', 'cloud-config-staging')
      const pending = git(seed, 'rev-parse', 'HEAD')
      git(seed, 'checkout', 'main')
      writeFileSync(join(seed, 'README.md'), 'New production baseline\n')
      git(seed, 'add', 'README.md')
      git(seed, 'commit', '-m', 'advance main baseline')
      git(seed, 'push', 'origin', 'main')
      const production = git(remote, 'rev-parse', 'refs/heads/main')
      git(root, 'clone', remote, target)
      writeFileSync(html, '<html>candidate fixture</html>')
      const run = () => execFileSync('bash', [
        fileURLToPath(new URL('../scripts/stage-fever-ui.sh', import.meta.url)), target, html,
      ], { env: { ...process.env, GITHUB_SHA: '0123456789abcdef' }, stdio: ['ignore', 'pipe', 'pipe'] })
      run()
      const candidate = git(remote, 'rev-parse', 'refs/heads/cloud-config-staging')
      const cloud = JSON.parse(git(remote, 'show', 'refs/heads/cloud-config-staging:assets/cloudRes.json'))
      expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(production)
      expect(git(remote, 'merge-base', candidate, production)).toBe(production)
      expect(git(remote, 'merge-base', candidate, pending)).toBe(pending)
      expect(cloud.login_base64_page_fever).toBe(Buffer.from('<html>candidate fixture</html>').toString('base64'))
      expect(cloud.login_base64_page).toBe('preserved legacy page')
      expect(cloud.pending_review).toBe('preserve this candidate field')
      expect(cloud.lastModified).toBeGreaterThan(1)
      expect(cloud).not.toHaveProperty('_signature')
      run()
      expect(git(remote, 'rev-parse', 'refs/heads/cloud-config-staging')).toBe(candidate)
      expect(git(remote, 'rev-parse', 'refs/heads/main')).toBe(production)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
