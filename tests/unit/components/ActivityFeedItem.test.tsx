// tests/unit/components/ActivityFeedItem.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ActivityFeedItem } from '@/components/ui/ActivityFeedItem'

describe('ActivityFeedItem', () => {
  it('renders title, description, and timestamp', () => {
    render(
      <ActivityFeedItem
        status="success"
        title="Order #3492"
        description="Air Jordan 1 Retro × 1"
        timestamp="2m ago"
      />,
    )
    expect(screen.getByText('Order #3492')).toBeInTheDocument()
    expect(screen.getByText('Air Jordan 1 Retro × 1')).toBeInTheDocument()
    expect(screen.getByText('2m ago')).toBeInTheDocument()
  })

  it('renders different status dot colors', () => {
    const { container, rerender } = render(
      <ActivityFeedItem status="live" title="X" timestamp="now" />,
    )
    expect(container.querySelector('[data-status="live"]')).toBeInTheDocument()

    rerender(<ActivityFeedItem status="warning" title="X" timestamp="now" />)
    expect(container.querySelector('[data-status="warning"]')).toBeInTheDocument()
  })
})
