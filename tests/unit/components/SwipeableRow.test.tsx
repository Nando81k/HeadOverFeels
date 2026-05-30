// tests/unit/components/SwipeableRow.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SwipeableRow } from '@/components/ui/SwipeableRow'

describe('SwipeableRow', () => {
  it('renders children', () => {
    render(
      <SwipeableRow>
        <div>Row content</div>
      </SwipeableRow>,
    )
    expect(screen.getByText('Row content')).toBeInTheDocument()
  })

  it('renders right actions (hidden until swipe)', () => {
    render(
      <SwipeableRow
        rightActions={[
          { label: 'Archive', onClick: () => {} },
          { label: 'Delete', onClick: () => {}, variant: 'destructive' },
        ]}
      >
        <div>x</div>
      </SwipeableRow>,
    )
    // Actions are in the DOM (positioned off-screen until swipe reveals)
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
