// tests/unit/components/admin/dashboard/HeroRevenue.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HeroRevenue } from '@/components/admin/dashboard/HeroRevenue'

import React from 'react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin',
}))

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 200, height: 32 }}>
        {React.Children.map(children as React.ReactElement, (child) =>
          React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            width: 200,
            height: 32,
          }),
        )}
      </div>
    ),
  }
})

const data = {
  label: 'REVENUE TODAY',
  value: '$8,420',
  trend: { direction: 'up' as const, text: '↑ 12.1%' },
  sparklineData: [1, 4, 2, 5, 8, 3, 9, 7, 10, 6],
}

describe('HeroRevenue', () => {
  it('renders label, value, and trend', () => {
    render(<HeroRevenue data={data} range="today" />)
    expect(screen.getByText('REVENUE TODAY')).toBeInTheDocument()
    expect(screen.getByText('$8,420')).toBeInTheDocument()
    expect(screen.getByText('↑ 12.1%')).toBeInTheDocument()
  })

  it('renders time-range pills with the active one marked', () => {
    render(<HeroRevenue data={data} range="week" />)
    const activePill = screen.getByRole('button', { name: /^Week$/ })
    expect(activePill).toHaveAttribute('aria-pressed', 'true')
  })
})
