// tests/unit/storefront/boundaries.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import StorefrontError from '@/app/(storefront)/error'
import StorefrontNotFound from '@/app/(storefront)/not-found'
import StorefrontLoading from '@/app/(storefront)/loading'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('app/(storefront)/error', () => {
  it('renders the failure state with a retry and a way home', () => {
    render(<StorefrontError error={new Error('boom')} reset={vi.fn()} />)

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })

  it('calls reset when the retry button is pressed', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<StorefrontError error={new Error('boom')} reset={reset} />)

    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('logs the digest only, never the raw error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = Object.assign(new Error('secret internals'), { digest: 'abc123' })

    render(<StorefrontError error={error} reset={vi.fn()} />)

    expect(log).toHaveBeenCalled()
    const logged = log.mock.calls.flat().map(String).join(' ')
    expect(logged).toContain('abc123')
    expect(logged).not.toContain('secret internals')
  })
})

describe('app/(storefront)/not-found', () => {
  it('renders the 404 copy and the recovery links', () => {
    render(<StorefrontNotFound />)

    expect(screen.getByText(/not found/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /shop all/i })).toHaveAttribute(
      'href',
      '/collections/all'
    )
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })
})

describe('app/(storefront)/loading', () => {
  it('renders eight product card skeletons', () => {
    const { container } = render(<StorefrontLoading />)

    expect(container.querySelectorAll('[data-product-card-skeleton]')).toHaveLength(8)
  })
})
