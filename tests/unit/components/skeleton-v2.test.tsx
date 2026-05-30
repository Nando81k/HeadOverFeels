// tests/unit/components/skeleton-v2.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  HeroMetricSkeleton,
  NeedsAttentionCardSkeleton,
  ActivityFeedItemSkeleton,
} from '@/components/ui/skeleton'

describe('Skeleton v2 variants', () => {
  it('HeroMetricSkeleton renders', () => {
    const { container } = render(<HeroMetricSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('NeedsAttentionCardSkeleton renders', () => {
    const { container } = render(<NeedsAttentionCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('ActivityFeedItemSkeleton renders', () => {
    const { container } = render(<ActivityFeedItemSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
