// tests/unit/components/admin/analytics/CohortTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CohortTable } from '@/components/admin/analytics/CohortTable'

describe('CohortTable', () => {
  it('empty state', () => {
    render(<CohortTable cells={[]} />)
    expect(screen.getByText(/no cohort/i)).toBeTruthy()
  })
  it('renders one row per signup month + 4 bucket columns', () => {
    render(<CohortTable cells={[
      { signupMonth: '2026-05', orderBucket: '1', count: 5 },
      { signupMonth: '2026-05', orderBucket: '2-3', count: 2 },
    ]} />)
    expect(screen.getByText(/2026-05/)).toBeTruthy()
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThanOrEqual(5)
  })
})
