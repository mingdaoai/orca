import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'expo-router'
import type { BridgeNavigateBackOutcome } from './bridge-host-contract'

/**
 * The shell's own stack pop, and the latch that keeps one `navigate-back` from becoming two.
 *
 * `canGoBack()` and `back()` disagree about time. The first reads the committed navigation state;
 * the second only adds `GO_BACK` to `routingQueue`, which `useImperativeApiEmitter` drains from an
 * effect. Two frames delivered in one native batch therefore both read the stack the first pop has
 * not left yet, both queue, and a three-deep stack unwinds past the screen the page was opened
 * over. Nothing upstream coalesces: the host forwards every notify it is granted.
 *
 * The latch clears on the committed route rather than on a timer, because that commit is the first
 * moment `canGoBack()` answers for the stack the pop actually left. A pop that takes this screen
 * off the stack unmounts it and takes the ref with it, which is the same answer by another route.
 */
export function useShellStackPop(): () => BridgeNavigateBackOutcome {
  const router = useRouter()
  const pathname = usePathname()
  const popPending = useRef(false)
  useEffect(() => {
    popPending.current = false
  }, [pathname])
  return useCallback(() => {
    if (popPending.current) {
      return 'pop-pending'
    }
    if (!router.canGoBack()) {
      return 'nothing-to-pop'
    }
    popPending.current = true
    router.back()
    return 'popped'
  }, [router])
}
