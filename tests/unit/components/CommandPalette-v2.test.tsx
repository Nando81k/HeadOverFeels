// tests/unit/components/CommandPalette-v2.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { CommandPalette } from '@/components/ui/CommandPalette'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin',
}))

beforeAll(() => {
  // cmdk uses ResizeObserver internally; jsdom does not implement it
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // cmdk calls scrollIntoView on list items; jsdom does not implement it
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('CommandPalette v2 extensions', () => {
  it('shows nav targets when typing', async () => {
    render(<CommandPalette isAdmin />)
    // Simulate opening
    await userEvent.keyboard('{Meta>}k{/Meta}')
    const input = await screen.findByPlaceholderText(/search/i)
    await userEvent.type(input, 'prod')
    // Multiple "Products" entries are expected (old nav + v2 "Products & Drops")
    const matches = await screen.findAllByText(/Products/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('exposes an "Add product" action', async () => {
    render(<CommandPalette isAdmin />)
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(await screen.findByText(/Add product/i)).toBeInTheDocument()
  })
})
