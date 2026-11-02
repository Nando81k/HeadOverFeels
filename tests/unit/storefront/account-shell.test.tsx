// tests/unit/storefront/account-shell.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('server-only', () => ({}))

const { nav, env, session } = vi.hoisted(() => ({
  nav: { pathname: '/account' as string | null, redirect: vi.fn() },
  env: { hasCustomerAccountEnv: vi.fn(() => true) },
  session: {
    getCustomerSession: vi.fn(),
    requireFreshSession: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  redirect: (...args: unknown[]) => {
    nav.redirect(...args)
    throw new Error(`NEXT_REDIRECT ${String(args[0])}`)
  },
}))
vi.mock('@/lib/shopify/customer/env', () => env)
vi.mock('@/lib/shopify/customer/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/session')>()
  return {
    ...actual,
    getCustomerSession: session.getCustomerSession,
    requireFreshSession: session.requireFreshSession,
  }
})

import AccountLayout, { dynamic, metadata } from '@/app/(storefront)/account/layout'
import {
  AccountNav,
  ACCOUNT_MENU_ITEMS,
  ACCOUNT_NAV_ITEMS,
  isActiveAccountPath,
} from '@/components/storefront/account/AccountNav'
import { AccountShell, renderAccountPage } from '@/components/storefront/account/AccountShell'
import { AccountUnavailable } from '@/components/storefront/account/AccountUnavailable'
import { SignInGate, signInHref } from '@/components/storefront/account/SignInGate'
import { CustomerAccountError, SignedOutError } from '@/lib/shopify/customer/errors'
import type { CustomerSession } from '@/lib/shopify/customer/session'

const SESSION: CustomerSession = {
  tokens: { accessToken: 'at', refreshToken: 'rt', idToken: 'id', expiresAt: Date.now() + 3_600_000 },
  customerId: 'gid://shopify/Customer/8123456789',
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Alvarez',
}

beforeEach(() => {
  vi.clearAllMocks()
  nav.pathname = '/account'
  env.hasCustomerAccountEnv.mockReturnValue(true)
})

afterEach(() => {
  cleanup()
})

describe('SignInGate', () => {
  it('renders 200 content with a login link carrying return_to', () => {
    render(<SignInGate returnTo="/account/orders" />)
    const gate = screen.getByText(/sign in to see your account/i).closest('[data-account]')
    expect(gate).toHaveAttribute('data-account', 'signed-out')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Faccount%2Forders'
    )
    expect(screen.getByRole('link', { name: 'Keep shopping' })).toHaveAttribute('href', '/collections/all')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a notice when given one', () => {
    render(<SignInGate returnTo="/account" notice="Your session expired." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired.')
  })

  it('encodes the return path', () => {
    expect(signInHref('/account/orders/1012?x=1')).toBe(
      '/account/login?return_to=%2Faccount%2Forders%2F1012%3Fx%3D1'
    )
  })
})

describe('AccountUnavailable', () => {
  it('renders the unconfigured notice as a status', () => {
    render(<AccountUnavailable />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('data-account', 'unconfigured')
    expect(status).toHaveTextContent('Sign-in is being set up')
  })
})

describe('AccountNav', () => {
  it('lists every account row, the loyalty and wishlist links and a POST sign-out', () => {
    render(<AccountNav />)
    const list = within(screen.getByRole('navigation', { name: 'Account' }))
    for (const item of ACCOUNT_NAV_ITEMS) {
      expect(list.getByRole('link', { name: item.label })).toHaveAttribute('href', item.href)
    }
    const signOut = list.getByRole('button', { name: 'Sign out' })
    expect(signOut).toHaveAttribute('type', 'submit')
    expect(signOut.closest('form')).toHaveAttribute('action', '/account/logout')
    expect(signOut.closest('form')).toHaveAttribute('method', 'post')
  })

  it('marks the current page, exact for the overview and by prefix elsewhere', () => {
    nav.pathname = '/account/orders/1012'
    render(<AccountNav />)
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')

    expect(isActiveAccountPath('/account', ACCOUNT_NAV_ITEMS[0])).toBe(true)
    expect(isActiveAccountPath('/account/orders', ACCOUNT_NAV_ITEMS[0])).toBe(false)
    expect(isActiveAccountPath(null, ACCOUNT_NAV_ITEMS[1])).toBe(false)
  })

  it('exposes the header menu subset in order', () => {
    expect(ACCOUNT_MENU_ITEMS.map((item) => item.label)).toEqual([
      'Overview',
      'Orders',
      'Care Points',
      'Wishlist',
    ])
  })
})

describe('AccountShell', () => {
  it('renders the nav beside the page when signed in', () => {
    render(
      <AccountShell available signedIn>
        <p>page</p>
      </AccountShell>
    )
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('renders the page alone (no nav) when signed out', () => {
    render(
      <AccountShell available signedIn={false}>
        <SignInGate returnTo="/account" />
      </AccountShell>
    )
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('replaces the page with the unconfigured notice when accounts are off', () => {
    render(
      <AccountShell available={false} signedIn={false}>
        <p>page</p>
      </AccountShell>
    )
    expect(screen.getByRole('status')).toHaveAttribute('data-account', 'unconfigured')
    expect(screen.queryByText('page')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull()
  })
})

describe('renderAccountPage', () => {
  it('renders the page with the fresh session', async () => {
    session.requireFreshSession.mockResolvedValue(SESSION)
    const page = vi.fn(async (s: CustomerSession) => <p>hi {s.firstName}</p>)
    render(<>{await renderAccountPage('/account', page)}</>)

    expect(session.requireFreshSession).toHaveBeenCalledWith('/account')
    expect(page).toHaveBeenCalledWith(SESSION)
    expect(screen.getByText('hi Nando')).toBeInTheDocument()
  })

  it('renders the gate with the page path when signed out', async () => {
    session.requireFreshSession.mockRejectedValue(new SignedOutError())
    const page = vi.fn()
    render(<>{await renderAccountPage('/account/orders', page, { notice: 'Sign-in did not complete.' })}</>)

    expect(page).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Faccount%2Forders'
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in did not complete.')
  })

  it('renders the unconfigured notice without touching the session', async () => {
    env.hasCustomerAccountEnv.mockReturnValue(false)
    render(<>{await renderAccountPage('/account', vi.fn())}</>)
    expect(screen.getByRole('status')).toHaveAttribute('data-account', 'unconfigured')
    expect(session.requireFreshSession).not.toHaveBeenCalled()
  })

  it('lets a stale-session redirect through untouched', async () => {
    session.requireFreshSession.mockRejectedValue(new Error('NEXT_REDIRECT /account/refresh'))
    await expect(renderAccountPage('/account', vi.fn())).rejects.toThrow('NEXT_REDIRECT')
  })

  it('sends a 401 from the API through the refresh route', async () => {
    session.requireFreshSession.mockResolvedValue(SESSION)
    const page = vi.fn(async () => {
      throw new CustomerAccountError('nope', { status: 401, code: 'UNAUTHENTICATED' })
    })
    await expect(renderAccountPage('/account/profile', page)).rejects.toThrow('NEXT_REDIRECT')
    expect(nav.redirect).toHaveBeenCalledWith('/account/refresh?return_to=%2Faccount%2Fprofile')
  })

  it('rethrows any other failure to the error boundary', async () => {
    session.requireFreshSession.mockResolvedValue(SESSION)
    const page = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(renderAccountPage('/account', page)).rejects.toThrow('boom')
    expect(nav.redirect).not.toHaveBeenCalled()
  })
})

describe('app/(storefront)/account/layout', () => {
  it('is dynamic and noindex', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('shows the nav when a session cookie exists', async () => {
    session.getCustomerSession.mockResolvedValue(SESSION)
    render(await AccountLayout({ children: <p>page</p> }))
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('shows the page alone when signed out', async () => {
    session.getCustomerSession.mockResolvedValue(null)
    render(await AccountLayout({ children: <p>page</p> }))
    expect(screen.queryByRole('navigation', { name: 'Account' })).toBeNull()
    expect(screen.getByText('page')).toBeInTheDocument()
  })

  it('renders the unconfigured notice without reading the cookie', async () => {
    env.hasCustomerAccountEnv.mockReturnValue(false)
    render(await AccountLayout({ children: <p>page</p> }))
    expect(screen.getByRole('status')).toHaveAttribute('data-account', 'unconfigured')
    expect(session.getCustomerSession).not.toHaveBeenCalled()
  })
})
