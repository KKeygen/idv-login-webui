// Local browser QA fixture. Build dist/index.html before starting this server.
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { accountSwitchingFixture } from '../tests/fixtures/account-switching.js'

let fixture = accountSwitchingFixture()
const nativeInstallations = new Map()
const games = [
  { game_id: 'h55', name: '第五人格', platform_type: 'fever', installations: [{ installed: true, installation_id: 'demo-main' }] },
  { game_id: 'g37', name: '阴阳师', platform_type: 'native', installations: [] },
  { game_id: 'full-g-niche', name: 'full-g-niche', platform_type: 'native', installations: [] },
]
const requests = []
const htmlPath = fileURLToPath(new URL('../dist/index.html', import.meta.url))
const port = Number(process.env.PORT || 8788)
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  const page = new URL(req.headers.referer || '/', `http://localhost:${port}`)
  const send = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)) }
  if (url.pathname === '/__test/requests') return send(requests)
  if (url.pathname === '/__test/reset') { fixture = accountSwitchingFixture(); requests.length = 0; nativeInstallations.clear(); return send({ success: true }) }
  if (!url.pathname.startsWith('/_idv-login/')) {
    try { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }); res.end(readFileSync(htmlPath)) }
    catch { res.writeHead(503); res.end('Run npm run build before browser QA.') }
    return
  }
  const path = url.pathname.replace('/_idv-login', '')
  let body = ''
  for await (const chunk of req) body += chunk
  requests.push({ path, method: req.method, ...(body ? { body: JSON.parse(body) } : {}) })
  if (path === '/health') return send({ status: 'ok', version: page.searchParams.get('backend') || '6.3.2' })
  if (path === '/list-games') return send({ success: true, games: games.map(game => ({ ...game, installations: nativeInstallations.has(game.game_id) ? [nativeInstallations.get(game.game_id)] : game.installations })), catalog: [] })
  if (path === '/native/capabilities') return send({ success: true })
  if (path === '/launcher-status') {
    const gameId = url.searchParams.get('game_id') || 'h55'
    const game = games.find(item => item.game_id === gameId) || { game_id: gameId }
    const installation = nativeInstallations.get(gameId) || null
    const distributions = game.platform_type === 'fever' ? [{ distribution_id: 73, installation: { installed: true, installation_id: 'demo-main', path: 'D:/Demo/game.exe' }, can_download: true }] : []
    return send({ success: true, installation_model_version: 1, game_id: gameId, platform_type: game.platform_type || 'native', game: { name: game.name, installation }, distributions })
  }
  if (path === '/native/pick-executable') return send({ path: 'D:/Demo/native-game.exe' })
  if (path === '/launcher-locate') {
    const data = JSON.parse(body)
    nativeInstallations.set(data.game_id, { installation_id: 'demo-native', installed: true, path: data.path })
    return send({ success: true })
  }
  if (path === '/launcher-remove-installation') { nativeInstallations.delete(url.searchParams.get('game_id')); return send({ success: true }) }
  if (path === '/account-list-config') {
    if (page.searchParams.get('fail') === 'load' && req.method === 'GET') return send({ success: false, error: '演示：暂时无法读取，请重试' }, 503)
    if (page.searchParams.get('missing') === '1') return send({ error: '演示：接口未提供' }, 404)
    if (req.method === 'POST') {
      if (page.searchParams.get('fail') === 'save') return send({ success: false, error: '演示：保存失败，可重试' }, 503)
      fixture.config = { ...fixture.config, ...JSON.parse(body).config }
      if (page.searchParams.get('slow') === '1') await new Promise(resolve => setTimeout(resolve, 2000))
    }
    return send({ ...fixture, games: page.searchParams.get('empty') === '1' ? [] : fixture.games })
  }
  if (path === '/list') return send(fixture.games[0].accounts)
  if (path === '/manualChannels') return send({ huawei: '华为账号', bilibili_sdk: '哔哩哔哩账号' })
  if (path === '/defaultChannel') return send({ uuid: '' })
  if (path === '/get-auto-close-state') return send({ state: false })
  if (path === '/scan-record-setting') return send({ enabled: true })
  if (path === '/proxy-mode') return send({ mode: 'global' })
  return send({ success: true })
})
server.listen(port, '127.0.0.1', () => console.log(`Account switching QA: http://localhost:${port}/?view=account-switching`))
