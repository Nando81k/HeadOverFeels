// tests/unit/components/admin/dashboard/SalesGoals.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SalesGoals } from '@/components/admin/dashboard/SalesGoals'

describe('SalesGoals', () => {
  it('renders today + month-to-date progress bars', () => {
    render(<SalesGoals data={{
      today: { goal: 10000, current: 8420, pace: 'on-track' },
      monthToDate: { goal: 200000, current: 142000, pace: 'on-track' },
    }} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Month-to-date')).toBeInTheDocument()
    expect(screen.getByText(/8,420.*10,000/)).toBeInTheDocument()
  })

  it('renders empty state when goal is unset', () => {
    render(<SalesGoals data={{
      today: { goal: null, current: 0, pace: 'unset' },
      monthToDate: { goal: null, current: 0, pace: 'unset' },
    }} />)
    expect(screen.getByText(/no goal set/i)).toBeInTheDocument()
  })
})
