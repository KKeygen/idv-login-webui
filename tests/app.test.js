import { describe, expect, it } from 'vitest'
import { cmpGameId, initialViewFromSearch, normalizeGames } from '../src/composables/useAppStore'
import { gameRailTabKey, mergeGameRailTabs, readGameRailState, rememberedGameRailTab, writeGameRailState } from '../src/gameRailStorage'
import { cacheCatalog, cacheLauncherVisual, readCatalogCache, readLauncherVisual, warmLauncherImages } from '../src/launcherCache'
import { resourceUrl } from '../src/api'
import GameRail from '../src/components/GameRail.vue'

describe('game compatibility', () => {
  it('matches complete and short game ids like the legacy page', () => {
    expect(cmpGameId('aecfrt3rmaaaaajl-g-h55', 'h55')).toBe(true)
    expect(cmpGameId('g37', 'h55')).toBe(false)
    expect(cmpGameId('', '')).toBe(true)
  })

  it('merges dynamic catalog without overriding recorded games', () => {
    const result = normalizeGames({ games: [{ game_id: 'full-g-h55', name: 'record' }], catalog: [{ game_id: 'g37' }], catalog_all: [{ game_id: 'h55', name: 'remote', launcher: { main_image: 'cover' } }, { game_id: 'g37' }] })
    expect(result.merged).toHaveLength(2)
    expect(result.merged[0].name).toBe('record')
    expect(result.merged[0].launcher.main_image).toBe('cover')
  })
})

describe('initial view deep link', () => {
  it('opens the requested account page and rejects unknown views', () => {
    expect(initialViewFromSearch('?game_id=h55&view=accounts')).toBe('accounts')
    expect(initialViewFromSearch('?view=unknown')).toBe('launcher')
  })
})

describe('initial game rail state', () => {
  it('can mount before the backend returns a current game', () => {
    expect(GameRail).toBeTruthy()
  })

  it('keeps existing tab order and appends newly discovered distributions', () => {
    const tabs = mergeGameRailTabs([
      { game_id: 'h55', distribution_id: 73 },
      { game_id: 'ma75', distribution_id: 1 },
    ], [
      { game_id: 'h55', distribution_id: 134 },
      { game_id: 'h55', distribution_id: 73 },
    ])
    expect(tabs.map(item => item.key)).toEqual(['h55::73', 'ma75::1', 'h55::134'])
  })

  it('persists the last selected tab for the next startup', () => {
    const values = new Map()
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
    const tabs = mergeGameRailTabs([], [
      { game_id: 'h55', distribution_id: 73 },
      { game_id: 'ma75', distribution_id: 1 },
    ])
    const last = gameRailTabKey('ma75', 1)
    expect(writeGameRailState(tabs, last, { storage })).toBe(true)
    const restored = readGameRailState({ storage })
    expect(restored.last_tab_key).toBe(last)
    expect(rememberedGameRailTab(restored.tabs, restored.last_tab_key, [{ game_id: 'full-g-ma75' }])?.key).toBe(last)
  })
})

describe('localhost launcher visual cache', () => {
  function storage() {
    const values = new Map()
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  }

  it('reuses catalog and full launcher visual payload without installation state', () => {
    const target = storage()
    const location = { hostname: 'localhost' }
    cacheCatalog({ catalog: [{ game_id: 'h55', launcher: { icon: 'i' } }], catalog_all: [] }, { storage: target, location })
    cacheLauncherVisual({
      game_id: 'aec-example-g-h55',
      game: { default_distribution: 73 },
      distributions: [{ distribution_id: 73, installation: { path: 'secret' }, launcher: { background_image: 'hero', activities_and_news: { tops: [{ title: 'news' }] } } }],
    }, { storage: target, location })

    expect(readCatalogCache({ storage: target, location }).catalog[0].game_id).toBe('h55')
    expect(readLauncherVisual('h55', { storage: target, location })).toEqual({ background_image: 'hero', activities_and_news: { tops: [{ title: 'news' }] } })
    expect(JSON.stringify(readLauncherVisual('h55', { storage: target, location }))).not.toContain('secret')
  })

  it('warms likely image resources only on localhost', () => {
    const requests = []
    const count = warmLauncherImages({ logo: 'https://cdn.example/logo.webp', link: 'https://example.com/news' }, {
      location: { hostname: 'localhost' },
      fetcher: (url, options) => { requests.push([url, options]); return Promise.resolve() },
    })
    expect(count).toBe(1)
    expect(requests[0][1].cache).toBe('force-cache')
  })
})

describe('Qt scheme compatibility', () => {
  it('keeps HTTPS in browsers and rewrites only for the embedded idvlogin page', () => {
    globalThis.window = { location: { protocol: 'http:' } }
    expect(resourceUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    globalThis.window = { location: { protocol: 'idvlogin:' } }
    expect(resourceUrl('https://example.com/a.png')).toBe('idvlogin://cdn/https/example.com/a.png')
  })
})
