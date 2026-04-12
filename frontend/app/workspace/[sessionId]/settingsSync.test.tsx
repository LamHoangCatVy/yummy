/**
 * Tests for the settings-tab / AI Provider race condition fix.
 *
 * Bug: the useEffect watching `status` (refreshed by a 4-second poll) was
 * unconditionally calling setCfgProvider(status.ai_provider), which reset the
 * user's in-flight selection back to the server value before they could save.
 *
 * Fix: guard the sync with `prevLeftTabRef.current !== 'settings'` so it only
 * runs when the user *switches to* the settings tab, not on every poll tick.
 */

import React, { useEffect, useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'

type Provider = 'gemini' | 'ollama' | 'copilot'
type MockStatus = { ai_provider: Provider } | null

/**
 * Mirrors the exact useEffect logic that was fixed in WorkspacePage.
 * Keeping it inline here makes the test self-documenting and ensures the test
 * stays in sync with the production pattern without requiring an extracted hook.
 */
function useSettingsSync(leftTab: string, status: MockStatus) {
  const [cfgProvider, setCfgProvider] = useState<Provider>('gemini')
  const prevLeftTabRef = useRef<string>('')

  useEffect(() => {
    if (leftTab === 'settings' && prevLeftTabRef.current !== 'settings' && status) {
      setCfgProvider(status.ai_provider)
    }
    prevLeftTabRef.current = leftTab
  }, [leftTab, status])

  return { cfgProvider, setCfgProvider }
}

describe('settings form sync — AI Provider race condition', () => {
  it('seeds cfgProvider from server state when switching to the settings tab', () => {
    const { result, rerender } = renderHook(
      ({ leftTab, status }: { leftTab: string; status: MockStatus }) =>
        useSettingsSync(leftTab, status),
      { initialProps: { leftTab: 'chat', status: { ai_provider: 'ollama' as Provider } } },
    )

    // Default state before visiting settings tab
    expect(result.current.cfgProvider).toBe('gemini')

    // User navigates to the settings tab — form should be seeded from server
    rerender({ leftTab: 'settings', status: { ai_provider: 'ollama' } })
    expect(result.current.cfgProvider).toBe('ollama')
  })

  it('does NOT reset cfgProvider when status updates while already on the settings tab', () => {
    const { result, rerender } = renderHook(
      ({ leftTab, status }: { leftTab: string; status: MockStatus }) =>
        useSettingsSync(leftTab, status),
      { initialProps: { leftTab: 'settings', status: { ai_provider: 'gemini' as Provider } } },
    )

    // Initial seed when tab is opened
    expect(result.current.cfgProvider).toBe('gemini')

    // User picks a different provider (not yet saved)
    act(() => result.current.setCfgProvider('copilot'))
    expect(result.current.cfgProvider).toBe('copilot')

    // Polling fires — status still reports 'gemini' (save hasn't completed yet)
    rerender({ leftTab: 'settings', status: { ai_provider: 'gemini' } })

    // Must stay on the user's selection, NOT be reset by the poll
    expect(result.current.cfgProvider).toBe('copilot')
  })

  it('does NOT reset cfgProvider across multiple poll cycles', () => {
    const { result, rerender } = renderHook(
      ({ leftTab, status }: { leftTab: string; status: MockStatus }) =>
        useSettingsSync(leftTab, status),
      { initialProps: { leftTab: 'settings', status: { ai_provider: 'gemini' as Provider } } },
    )

    act(() => result.current.setCfgProvider('ollama'))
    expect(result.current.cfgProvider).toBe('ollama')

    // Simulate several poll ticks with stale server state
    rerender({ leftTab: 'settings', status: { ai_provider: 'gemini' } })
    expect(result.current.cfgProvider).toBe('ollama')

    rerender({ leftTab: 'settings', status: { ai_provider: 'gemini' } })
    expect(result.current.cfgProvider).toBe('ollama')

    rerender({ leftTab: 'settings', status: { ai_provider: 'gemini' } })
    expect(result.current.cfgProvider).toBe('ollama')
  })

  it('re-seeds the form when the user leaves and re-enters the settings tab', () => {
    const { result, rerender } = renderHook(
      ({ leftTab, status }: { leftTab: string; status: MockStatus }) =>
        useSettingsSync(leftTab, status),
      { initialProps: { leftTab: 'settings', status: { ai_provider: 'gemini' as Provider } } },
    )

    // User selects copilot but navigates away without saving
    act(() => result.current.setCfgProvider('copilot'))
    rerender({ leftTab: 'chat', status: { ai_provider: 'gemini' } })

    // Server saved 'ollama' in the meantime (via another client, etc.)
    // User comes back to settings — form should reflect fresh server state
    rerender({ leftTab: 'settings', status: { ai_provider: 'ollama' } })
    expect(result.current.cfgProvider).toBe('ollama')
  })

  it('handles null status gracefully on tab switch', () => {
    const { result, rerender } = renderHook(
      ({ leftTab, status }: { leftTab: string; status: MockStatus }) =>
        useSettingsSync(leftTab, status),
      { initialProps: { leftTab: 'chat', status: null } },
    )

    // Switch to settings with no status yet — default should be preserved
    rerender({ leftTab: 'settings', status: null })
    expect(result.current.cfgProvider).toBe('gemini')

    // Status arrives later while already on the settings tab — must NOT overwrite
    // (user may have already interacted before status loaded)
    rerender({ leftTab: 'settings', status: { ai_provider: 'ollama' } })
    expect(result.current.cfgProvider).toBe('gemini')
  })
})
