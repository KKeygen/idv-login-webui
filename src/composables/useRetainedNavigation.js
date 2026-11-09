import { onBeforeUnmount, watch } from 'vue'
import { createRetainedNavigation } from '../retainedNavigation'
import { cmpGameId } from './useAppStore'

// Capture the outgoing visual before Vue patches a retained game-specific view.
// The page selection policy stays distinct from the DOM/WAAPI implementation.
export function useRetainedNavigation(state, getHost) {
  const retainedNavigation = createRetainedNavigation(getHost)
  watch([() => state.gameId, () => state.distributionId, () => state.view], (next, previous) => {
    if (!previous?.[0] || next[2] !== previous[2] || !['launcher', 'accounts'].includes(next[2])) { retainedNavigation.finish(); return }
    const gameChanged = !cmpGameId(next[0], previous[0])
    const serverChanged = previous[1] !== '' && next[1] !== '' && String(next[1]) !== String(previous[1])
    if (gameChanged || serverChanged) retainedNavigation.navigate()
  }, { flush: 'pre' })
  onBeforeUnmount(() => retainedNavigation.dispose())
}
