// tests/unit/components/StatCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatCard } from '@/components/ui/StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="REVENUE TODAY" value="$8,420" />)
    expect(screen.getByText('REVENUE TODAY')).toBeInTheDocument()
    expect(screen.getByText('$8,420')).toBeInTheDocument()
  })

  it('renders trend with direction indicator', () => {
    render(<StatCard label="UNITS" value={47} trend={{ direction: 'up', text: '↑ 8%' }} />)
    expect(screen.getByText('↑ 8%')).toBeInTheDocument()
  })

  it('applies the glow variant', () => {
    const { container } = render(
      <StatCard label="LOW STOCK" value={12} variant="warning" />,
    )
    expect(container.firstChild).toHaveClass(/border/) // variant adds border styling
  })
})
