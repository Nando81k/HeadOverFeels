import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Price } from '@/components/storefront/ui/Price'

afterEach(cleanup)

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })

describe('Price', () => {
  it('renders the formatted amount inside a <span class="num">', () => {
    const { container } = render(<Price amount={usd('42.5')} />)
    const num = container.querySelector('span.num')
    expect(num).not.toBeNull()
    expect(num?.tagName).toBe('SPAN')
    expect(num?.textContent).toBe('$42.50')
    expect(num?.className).toContain('font-mono')
    expect(num?.className).toContain('tabular-nums')
  })

  it('renders no compare-at element when compareAt is absent', () => {
    const { container } = render(<Price amount={usd('42.5')} />)
    expect(container.querySelector('s')).toBeNull()
    expect(container.querySelector('[data-on-sale]')).toBeNull()
  })

  it('renders a struck compare-at labelled "Original price" when it is higher', () => {
    const { container } = render(<Price amount={usd('42.50')} compareAt={usd('60.00')} />)
    const strike = container.querySelector('s')
    expect(strike).not.toBeNull()
    expect(strike).toHaveAttribute('aria-label', 'Original price')
    expect(strike?.textContent).toBe('$60.00')
    expect(strike?.className).toContain('text-ink-mute')
  })

  it('marks the wrapper with data-on-sale and tints the amount when on sale', () => {
    const { container } = render(<Price amount={usd('42.50')} compareAt={usd('60.00')} />)
    const wrapper = container.querySelector('[data-on-sale]')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.tagName).toBe('SPAN')
    expect(container.querySelector('span.num')?.className).toContain('text-signal')
  })

  it('does not strike a compare-at that is equal or lower', () => {
    const { container, rerender } = render(
      <Price amount={usd('42.50')} compareAt={usd('42.50')} />
    )
    expect(container.querySelector('s')).toBeNull()
    rerender(<Price amount={usd('42.50')} compareAt={usd('10.00')} />)
    expect(container.querySelector('s')).toBeNull()
    expect(container.querySelector('[data-on-sale]')).toBeNull()
  })

  it('does not strike a compare-at in a different currency', () => {
    const { container } = render(
      <Price amount={usd('42.50')} compareAt={{ amount: '60.00', currencyCode: 'EUR' }} />
    )
    expect(container.querySelector('s')).toBeNull()
  })

  it('accepts compareAt={null}', () => {
    const { container } = render(<Price amount={usd('42.50')} compareAt={null} />)
    expect(container.querySelector('s')).toBeNull()
    expect(screen.getByText('$42.50')).toBeInTheDocument()
  })

  it('maps the size prop to a text class and defaults to md', () => {
    const { container, rerender } = render(<Price amount={usd('42.50')} />)
    const wrapperOf = () => container.firstElementChild as HTMLElement
    expect(wrapperOf().className).toContain('text-sm')
    rerender(<Price amount={usd('42.50')} size="sm" />)
    expect(wrapperOf().className).toContain('text-xs')
    rerender(<Price amount={usd('42.50')} size="lg" />)
    expect(wrapperOf().className).toContain('text-base')
  })

  it('merges a custom className onto the wrapper', () => {
    const { container } = render(<Price amount={usd('42.50')} className="gap-4" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('gap-4')
  })
})
