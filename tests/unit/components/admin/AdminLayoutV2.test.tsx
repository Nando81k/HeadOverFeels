// tests/unit/components/admin/AdminLayoutV2.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AdminLayoutV2 } from '@/components/admin/v2/AdminLayoutV2'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('AdminLayoutV2', () => {
  it('renders title + subtitle + children', () => {
    render(
      <AdminLayoutV2 title="Products" subtitle="Test">
        <div>Page interior</div>
      </AdminLayoutV2>,
    )
    expect(screen.getAllByText('Products').length).toBeGreaterThan(0)
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('Page interior')).toBeInTheDocument()
  })

  it('renders both sidebar (desktop) and mobile nav', () => {
    render(
      <AdminLayoutV2 title="X">
        <div>x</div>
      </AdminLayoutV2>,
    )
    // sidebar contains "Dashboard" link
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
  })
})
