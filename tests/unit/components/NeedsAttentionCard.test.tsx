// tests/unit/components/NeedsAttentionCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NeedsAttentionCard } from '@/components/ui/NeedsAttentionCard'

describe('NeedsAttentionCard', () => {
  it('renders title and description', () => {
    render(
      <NeedsAttentionCard
        icon={<span>📦</span>}
        title="7 orders awaiting fulfillment"
        description="Oldest: 23 min ago"
        urgency="critical"
      />,
    )
    expect(screen.getByText('7 orders awaiting fulfillment')).toBeInTheDocument()
    expect(screen.getByText('Oldest: 23 min ago')).toBeInTheDocument()
  })

  it('wraps in a link when href provided', () => {
    render(
      <NeedsAttentionCard
        icon={<span>x</span>}
        title="Title"
        urgency="medium"
        href="/admin/orders"
      />,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/orders')
  })
})
