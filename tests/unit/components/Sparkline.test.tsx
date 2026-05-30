// tests/unit/components/Sparkline.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { Sparkline } from '@/components/ui/Sparkline'

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

describe('Sparkline', () => {
  it('renders an svg with a path for the data series', () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 5, 8, 3, 9]} />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    // Recharts renders the line as a <path> with class containing "recharts-line"
    expect(container.querySelector('.recharts-line')).toBeInTheDocument()
  })

  it('renders empty when data is empty', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })
})
