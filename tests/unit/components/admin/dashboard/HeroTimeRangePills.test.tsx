// tests/unit/components/admin/dashboard/HeroTimeRangePills.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HeroTimeRangePills } from '@/components/admin/dashboard/HeroTimeRangePills'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin',
}))

beforeEach(() => {
  pushMock.mockReset()
  localStorage.clear()
})

describe('HeroTimeRangePills', () => {
  it('renders 4 pills', () => {
    render(<HeroTimeRangePills active="today" />)
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Year' })).toBeInTheDocument()
  })

  it('marks active pill with aria-pressed', () => {
    render(<HeroTimeRangePills active="month" />)
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('on click: router.push with new range + persists to localStorage', async () => {
    render(<HeroTimeRangePills active="today" />)
    await userEvent.click(screen.getByRole('button', { name: 'Week' }))
    expect(pushMock).toHaveBeenCalledWith('/admin?range=week')
    expect(localStorage.getItem('admin.dashboard.range')).toBe('week')
  })
})
