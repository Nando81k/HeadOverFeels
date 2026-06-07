// tests/unit/components/admin/loyalty/PopularRewardsList.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PopularRewardsList } from '@/components/admin/loyalty/PopularRewardsList'

describe('PopularRewardsList', () => {
  it('empty state', () => {
    render(<PopularRewardsList rewards={[]} />)
    expect(screen.getByText(/no rewards yet/i)).toBeTruthy()
  })
  it('renders one row per reward', () => {
    render(<PopularRewardsList rewards={[
      { id: 'r1', name: '10% off', pointsCost: 500, totalRedeemed: 25, rewardType: 'DISCOUNT' },
    ]} />)
    expect(screen.getByText(/10% off/)).toBeTruthy()
    expect(screen.getByText(/25/)).toBeTruthy()
  })
})
