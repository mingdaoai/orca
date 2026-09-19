// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { JSX } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { TerminalPane } from './TerminalPane'

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { settingsSearchQuery: string }) => unknown) =>
    selector({ settingsSearchQuery: 'new terminal panes' })
}))

vi.mock('@/components/terminal-pane/pane-helpers', () => ({
  isMacUserAgent: () => true,
  isWindowsUserAgent: () => false
}))

function ShellSettingHarness(): JSX.Element {
  const [settings, setSettings] = useState<GlobalSettings>(() => ({
    ...getDefaultSettings('/tmp'),
    terminalDefaultShell: ''
  }))

  return (
    <TerminalPane
      settings={settings}
      updateSettings={(updates) => setSettings((current) => ({ ...current, ...updates }))}
      scrollbackMode="preset"
      setScrollbackMode={() => undefined}
    />
  )
}

describe('TerminalPane custom shell setting', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { platform: { get: () => ({ shell: '/bin/tcsh' }) } }
    })
  })

  afterEach(cleanup)

  it('reveals the editable zsh field when Custom shell is selected on macOS', async () => {
    const user = userEvent.setup()
    render(<ShellSettingHarness />)

    expect(
      screen.getByRole('radio', { name: 'System shell (/bin/tcsh)' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(screen.queryByRole('textbox', { name: 'Custom shell executable' })).toBeNull()

    await user.click(screen.getByRole('radio', { name: 'Custom shell' }))

    expect(screen.getByDisplayValue('/bin/zsh')).toBe(
      screen.getByRole('textbox', { name: 'Custom shell executable' })
    )
  })
})
