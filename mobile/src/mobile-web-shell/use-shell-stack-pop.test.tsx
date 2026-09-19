/**
 * The pop the page asks for, driven through expo-router's own routing module.
 *
 * `canGoBack()` and `back()` disagree about time: the first reads the committed navigation state,
 * the second only adds `GO_BACK` to a queue that a later effect drains. A mock of `canGoBack` hides
 * exactly that, so this evaluates `expo-router/build/global-state/routing.js` verbatim with only
 * its externals stubbed, and the stack below is the one React Navigation would have dispatched to.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { act, create } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BridgeNavigateBackOutcome } from './bridge-host-contract'

type RoutingModule = {
  canGoBack: () => boolean
  goBack: () => void
  routingQueue: { run: (ref: unknown) => void }
}

type NavigationRef = {
  current: { canGoBack: () => boolean; dispatch: (action: { type: string }) => void }
}

const requireFrom = createRequire(import.meta.url)

/** The shipped bytes, not a re-implementation: only what the module reaches outward for is stubbed. */
function loadRoutingModule(ref: NavigationRef): RoutingModule {
  const root = dirname(requireFrom.resolve('expo-router/package.json'))
  const source = readFileSync(join(root, 'build/global-state/routing.js'), 'utf8')
  const loaded = { exports: {} as Record<string, unknown> }
  const stubs: Record<string, unknown> = {
    'expo/dom': { IS_DOM: false },
    './router-store': { store: { navigationRef: { isReady: () => true, ...ref } } },
    '../domComponents/emitDomEvent': { emitDomGoBack: () => false }
  }
  new Function('require', 'exports', 'module', source)(
    (id: string) => stubs[id] ?? {},
    loaded.exports,
    loaded
  )
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the three members read
  // below are the ones this file's `exports.` assignments define; the stubs cover every import it
  // makes, so evaluation either defines all of them or throws above.
  return loaded.exports as unknown as RoutingModule
}

/** A stack the real `GO_BACK` action pops, so a pop that was queued twice is visible as two. */
function stackRef(screens: string[]): NavigationRef {
  return {
    current: {
      canGoBack: () => screens.length > 1,
      dispatch: (action) => {
        if (action.type === 'GO_BACK' && screens.length > 1) {
          screens.pop()
        }
      }
    }
  }
}

const router = vi.hoisted(() => ({
  value: null as { canGoBack: () => boolean; back: () => void } | null,
  pathname: '/h/host-a/tasks'
}))

// `useRouter` answers with the real routing module's own members, wired the way
// `expo-router/build/imperative-api.js` wires them: `back: () => goBack()`, `canGoBack` direct.
vi.mock('expo-router', () => ({
  useRouter: () => router.value,
  usePathname: () => router.pathname
}))

import { useShellStackPop } from './use-shell-stack-pop'

type Harness = {
  pop: () => BridgeNavigateBackOutcome
  screens: string[]
  drain: () => void
  commitRoute: (pathname: string) => void
}

function mount(screens: string[]): Harness {
  const ref = stackRef(screens)
  const routing = loadRoutingModule(ref)
  router.value = { canGoBack: routing.canGoBack, back: () => routing.goBack() }
  const held: { pop: (() => BridgeNavigateBackOutcome) | null } = { pop: null }
  function Screen(): null {
    held.pop = useShellStackPop()
    return null
  }
  const rendered: { tree: ReturnType<typeof create> | null } = { tree: null }
  act(() => {
    rendered.tree = create(<Screen />)
  })
  const tree = rendered.tree
  const pop = held.pop
  if (tree === null) {
    throw new Error('nothing rendered')
  }
  if (pop === null) {
    throw new Error('nothing mounted')
  }
  return {
    pop,
    screens,
    drain: () => {
      routing.routingQueue.run(ref)
    },
    commitRoute: (pathname) => {
      router.pathname = pathname
      act(() => {
        tree.update(<Screen />)
      })
    }
  }
}

beforeEach(() => {
  router.pathname = '/h/host-a/tasks'
})

describe('a page that asks to go back twice in one batch', () => {
  it('pops once, because the second frame reads a stack the first has not left yet', () => {
    const harness = mount(['home', 'host', 'tasks'])
    // One native batch: both frames are dispatched before React commits anything.
    expect(harness.pop()).toBe('popped')
    expect(harness.pop()).toBe('pop-pending')
    harness.drain()
    // Without the latch both `GO_BACK`s are queued and this is `['home']` — the host screen the
    // page was opened over is gone.
    expect(harness.screens).toEqual(['home', 'host'])
  })

  it('takes the next pop once the route the first one produced has committed', () => {
    const harness = mount(['home', 'host', 'tasks'])
    expect(harness.pop()).toBe('popped')
    harness.drain()
    harness.commitRoute('/h/host-a')
    expect(harness.pop()).toBe('popped')
    harness.drain()
    expect(harness.screens).toEqual(['home'])
  })

  it('refuses with its own reason when the stack has nothing to pop', () => {
    const harness = mount(['home'])
    expect(harness.pop()).toBe('nothing-to-pop')
    harness.drain()
    expect(harness.screens).toEqual(['home'])
  })
})
