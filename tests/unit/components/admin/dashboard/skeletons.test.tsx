// tests/unit/components/admin/dashboard/skeletons.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  KpiStripSkeleton,
  LiveActivityFeedSkeleton,
  SalesGoalsSkeleton,
  NeedsAttentionSkeleton,
} from '@/components/admin/dashboard/skeletons'

describe('Dashboard skeletons', () => {
  it.each([
    ['KpiStripSkeleton', KpiStripSkeleton],
    ['LiveActivityFeedSkeleton', LiveActivityFeedSkeleton],
    ['SalesGoalsSkeleton', SalesGoalsSkeleton],
    ['NeedsAttentionSkeleton', NeedsAttentionSkeleton],
  ])('%s renders', (_name, Component) => {
    const { container } = render(<Component />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
