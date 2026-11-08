import { describe, expect, it } from 'vitest'
import {
  availableInstallBytes,
  hasKnownInstallCapacity,
  requiredInstallBytes,
} from '../src/installRequirements'
import {
  isTopModal,
  openModal,
  removeModal,
} from '../src/modalStack'

describe('installation space requirements', () => {
  it('prefers an explicit backend requirement', () => {
    expect(requiredInstallBytes({ required_bytes: 90, unzip_bytes: 120, download_bytes: 50 })).toBe(90)
  })

  it('falls back to the larger legacy size and preserves zero free space', () => {
    expect(requiredInstallBytes({ unzip_bytes: 120, download_bytes: 50 })).toBe(120)
    expect(availableInstallBytes({ disk_free_bytes: 0 })).toBe(0)
    expect(hasKnownInstallCapacity('D:/Games', { disk_free_bytes: 0 })).toBe(true)
  })
})

describe('modal stack', () => {
  it('allows only the top modal to dismiss', () => {
    const bottom = Symbol('bottom')
    const top = Symbol('top')
    const bottomLayer = openModal(bottom)
    const topLayer = openModal(top)
    expect(topLayer).toBeGreaterThan(bottomLayer)
    expect(isTopModal(bottom)).toBe(false)
    expect(isTopModal(top)).toBe(true)
    removeModal(top)
    expect(isTopModal(bottom)).toBe(true)
    removeModal(bottom)
  })
})
