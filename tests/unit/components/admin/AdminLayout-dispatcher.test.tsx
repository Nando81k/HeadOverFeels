import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/products',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/context', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@example.com', role: 'ADMIN' },
    loading: false,
    signout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}))

describe('AdminLayout dispatcher', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders V1 when ADMIN_V2 flag is false', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'false'
    const { AdminLayout } = await import('@/components/admin/AdminLayout')
    render(<AdminLayout title="T">x</AdminLayout>)
    // V1 specifically uses bg-neutral-950 — assert that's in the tree
    const root = document.querySelector('.bg-neutral-950')
    expect(root).toBeInTheDocument()
  })

  it('renders V2 when ADMIN_V2 flag is true', async () => {
    process.env.NEXT_PUBLIC_ADMIN_V2_ENABLED = 'true'
    const { AdminLayout } = await import('@/components/admin/AdminLayout')
    render(<AdminLayout title="T">x</AdminLayout>)
    // V2 has "Products & Drops" label in the sidebar
    expect(screen.getByText('Products & Drops')).toBeInTheDocument()
  })
})
