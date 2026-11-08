import { describe, expect, it } from 'vitest'
import { FEVER_NEXT_VERSION, supportsNextFeverFeatures } from '../src/featureVersions'

describe('6.3.3-beta feature version eligibility', () => {
  it('uses the beta release as the common threshold', () => {
    expect(FEVER_NEXT_VERSION).toBe('6.3.3-beta')
  })

  it.each(['', null, undefined, 'unknown', '6.3.2', 'v6.3.2-stable', '6.2.99', '6.3.3-alpha'])
  ('hides new features for an old or unknown version %s', version => {
    expect(supportsNextFeverFeatures(version)).toBe(false)
  })

  it.each(['6.3.3-beta', 'v6.3.3-beta', '6.3.3-beta.1', '6.3.3-rc', '6.3.3', '6.3.4', '6.4.0'])
  ('enables new features for compatible version %s', version => {
    expect(supportsNextFeverFeatures(version)).toBe(true)
  })
})
