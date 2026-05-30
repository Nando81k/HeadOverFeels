// tests/unit/components/HeroMetric.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { HeroMetric } from '@/components/ui/HeroMetric'

// ResponsiveContainer uses ResizeObserver which is unavailable in jsdom.
// Stub it so it forwards explicit dimensions to its child, letting recharts paint the SVG.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }) => (
      <div style={{ width: 200, height: 32 }}>
        {React.Children.map(children as React.ReactElement, (child) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          React.cloneElement(child as React.ReactElement<any>, {
            width: 200,
            height: 32,
          }),
        )}
      </div>
    ),
  }
})

describe('HeroMetric', () => {
  it('renders label and value prominently', () => {
    render(<HeroMetric label="REVENUE TODAY" value="$8,420" />)
    expect(screen.getByText('REVENUE TODAY')).toBeInTheDocument()
    expect(screen.getByText('$8,420')).toBeInTheDocument()
  })

  it('renders trend text when provided', () => {
    render(
      <HeroMetric
        label="REVENUE"
        value="$8,420"
        trend={{ direction: 'up', text: '↑ 12.1% vs yesterday' }}
      />,
    )
    expect(screen.getByText('↑ 12.1% vs yesterday')).toBeInTheDocument()
  })

  it('renders sparkline when data provided', () => {
    const { container } = render(
      <HeroMetric label="REVENUE" value="$8,420" sparklineData={[1, 4, 2, 5, 8]} />,
    )
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders action slot', () => {
    render(<HeroMetric label="X" value="1" actions={<button>Today</button>} />)
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  })
})
