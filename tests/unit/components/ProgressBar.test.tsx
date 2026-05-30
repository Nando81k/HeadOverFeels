// tests/unit/components/ProgressBar.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProgressBar } from '@/components/ui/ProgressBar'

describe('ProgressBar', () => {
  it('renders label and detail', () => {
    render(<ProgressBar value={84} label="Today's goal" detail="$8,420 / $10,000" />)
    expect(screen.getByText("Today's goal")).toBeInTheDocument()
    expect(screen.getByText('$8,420 / $10,000')).toBeInTheDocument()
  })

  it('clamps value between 0 and 100', () => {
    const { container } = render(<ProgressBar value={150} />)
    const fill = container.querySelector('[data-fill]') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('clamps negative values to 0', () => {
    const { container } = render(<ProgressBar value={-10} />)
    const fill = container.querySelector('[data-fill]') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('exposes ARIA progressbar role', () => {
    render(<ProgressBar value={50} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })
})
