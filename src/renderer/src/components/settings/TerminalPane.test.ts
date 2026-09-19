import { describe, expect, it } from 'vitest'
import { getInitialCustomShell } from './TerminalPane'

describe('getInitialCustomShell', () => {
  it('preserves an existing custom shell', () => {
    expect(
      getInitialCustomShell({
        configuredShell: '  /opt/homebrew/bin/fish ',
        systemShell: '/bin/zsh',
        isMac: true
      })
    ).toBe('/opt/homebrew/bin/fish')
  })

  it('uses zsh when switching to custom shell on macOS', () => {
    expect(
      getInitialCustomShell({ configuredShell: '', systemShell: '/bin/tcsh', isMac: true })
    ).toBe('/bin/zsh')
  })

  it('falls back to the system shell off macOS', () => {
    expect(
      getInitialCustomShell({ configuredShell: '', systemShell: '/bin/fish', isMac: false })
    ).toBe('/bin/fish')
  })

  it('uses bash when no fallback shell is available', () => {
    expect(getInitialCustomShell({ configuredShell: '', systemShell: '  ', isMac: false })).toBe(
      '/bin/bash'
    )
  })
})
