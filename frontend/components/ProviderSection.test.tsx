import { fireEvent, render, screen } from '@testing-library/react'
import ProviderSection from './ProviderSection'

describe('ProviderSection layout', () => {
  it('keeps apply button visible and clickable in normal layout', () => {
    const onApplyProvider = vi.fn()

    render(
      <ProviderSection
        cfgProvider="gemini"
        cfgSaving={false}
        onProviderChange={vi.fn()}
        onApplyProvider={onApplyProvider}
      />,
    )

    const applyButton = screen.getByRole('button', { name: 'Apply Provider' })
    expect(applyButton).toBeVisible()

    fireEvent.click(applyButton)
    expect(onApplyProvider).toHaveBeenCalledTimes(1)
  })

  it('supports narrow containers by wrapping provider options', () => {
    render(
      <div style={{ width: 220 }}>
        <ProviderSection
          cfgProvider="gemini"
          cfgSaving={false}
          onProviderChange={vi.fn()}
          onApplyProvider={vi.fn()}
        />
      </div>,
    )

    const options = screen.getByTestId('provider-options')
    expect(options).toHaveClass('flex-wrap')

    const providerButtons = screen.getAllByRole('button').filter((button) =>
      ['✦ Gemini', '⬡ Ollama', '⊕ Copilot'].includes(button.textContent ?? ''),
    )

    providerButtons.forEach((button) => {
      expect(button).toHaveStyle({ flex: '1 1 120px' })
    })
  })

  it('uses stacking context so section is not hidden by following cards', () => {
    render(
      <ProviderSection
        cfgProvider="gemini"
        cfgSaving={false}
        onProviderChange={vi.fn()}
        onApplyProvider={vi.fn()}
      />,
    )

    expect(screen.getByTestId('provider-section')).toHaveClass('relative', 'z-10')
  })
})
