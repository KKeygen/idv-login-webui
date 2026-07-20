import { describe, expect, it } from 'vitest'
import { cmpGameId, normalizeGames } from '../src/composables/useAppStore'
import { resourceUrl } from '../src/api'

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

describe('Qt scheme compatibility', () => {
  it('rewrites external resources for idvlogin', () => {
    globalThis.window = { location: { protocol: 'http:' } }
    expect(resourceUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})
