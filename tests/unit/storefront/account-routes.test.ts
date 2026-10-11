// @vitest-environment node
// tests/unit/storefront/account-routes.test.ts
//
// Node environment: the real session module (jose) runs here so the handlers
// write and read genuinely encrypted cookies through the mocked jar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

type JarEntry = { name: string; value: string; options?: Record<string, unknown> }
const jarStore = new Map<string, JarEntry>()
const jar = {
  get: vi.fn((name: string) => {
    const entry = jarStore.get(name)
    return entry ? { name: entry.name, value: entry.value } : undefined
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    jarStore.set(name, { name, value, options })
  }),
  delete: vi.fn((name: string) => {
    jarStore.delete(name)
  }),
}
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((location: string) => {
    throw new Error(`NEXT_REDIRECT ${location}`)
  }),
}))

vi.mock('@/lib/shopify/customer/env', () => ({
  hasCustomerAccountEnv: vi.fn(() => true),
  getCustomerAccountEnv: vi.fn(() => ({
    storeDomain: 'tgqucm-qg.myshopify.com',
    clientId: 'shp_client',
    shopId: '85215183073',
    baseUrl: 'https://hof-preview.vercel.app',
    issuerOverride: null,
  })),
  getCustomerSessionSecret: vi.fn(() => 'unit-test-secret'),
}))
vi.mock('@/lib/shopify/customer/oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify/customer/oauth')>()
  return {
    ...actual,
    discover: vi.fn(),
    createPkce: vi.fn(() => ({ verifier: 'pkce-verifier', challenge: 'pkce-challenge' })),
    randomToken: vi.fn(() => 'random-token'),
    exchangeCode: vi.fn(),
    refreshTokens: vi.fn(),
  }
})
vi.mock('@/lib/shopify/customer/queries', () => ({ getCustomerSummary: vi.fn() }))
vi.mock('@/lib/shopify/queries/cart', () => ({ updateCartBuyerIdentity: vi.fn() }))
vi.mock('@/lib/loyalty/shopify-bridge', () => ({ resolveCustomer: vi.fn() }))

import { GET as callbackGET } from '@/app/(storefront)/account/callback/route'
import { GET as loginGET } from '@/app/(storefront)/account/login/route'
import { GET as logoutGET, POST as logoutPOST } from '@/app/(storefront)/account/logout/route'
import { GET as refreshGET } from '@/app/(storefront)/account/refresh/route'
import { resolveCustomer } from '@/lib/loyalty/shopify-bridge'
import { CART_COOKIE } from '@/lib/shopify/cart/cookie'
import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import { discover, exchangeCode, refreshTokens } from '@/lib/shopify/customer/oauth'
import { getCustomerSummary } from '@/lib/shopify/customer/queries'
import {
  CUSTOMER_COOKIE,
  OAUTH_STATE_COOKIE,
  readCustomerSession,
  readOAuthState,
  safeReturnTo,
  writeCustomerSession,
  writeOAuthState,
  type CustomerSession,
} from '@/lib/shopify/customer/session'
import { updateCartBuyerIdentity } from '@/lib/shopify/queries/cart'

const ORIGIN = 'https://hof-preview.vercel.app'
const HOUR = 60 * 60 * 1000
// Pinned once so a token built for a mock and one built for an expectation agree to the millisecond.
const NOW = Date.now()
const CUSTOMER_ID = 'gid://shopify/Customer/8123456789'
const CART_ID = 'gid://shopify/Cart/Z2NwLXVzLWVhc3QxOjAx?key=abc123'

const DISCOVERY = {
  authorizationEndpoint: 'https://shopify.com/authentication/85215183073/oauth/authorize',
  tokenEndpoint: 'https://shopify.com/authentication/85215183073/oauth/token',
  logoutEndpoint: 'https://shopify.com/authentication/85215183073/logout',
  graphqlEndpoint: 'https://shopify.com/85215183073/account/customer/api/2026-07/graphql',
}

const SUMMARY = {
  id: CUSTOMER_ID,
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: 'Alvarez',
  displayName: 'Nando Alvarez',
  phone: null,
  defaultAddress: null,
}

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function idToken(nonce: string): string {
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ sub: 'x', nonce })}.sig`
}

function tokens(overrides: Partial<CustomerSession['tokens']> = {}): CustomerSession['tokens'] {
  return {
    accessToken: 'atkn',
    refreshToken: 'rtkn',
    idToken: idToken('nonce-1'),
    expiresAt: NOW + 2 * HOUR,
    ...overrides,
  }
}

function session(overrides: Partial<CustomerSession> = {}): CustomerSession {
  return {
    tokens: tokens(),
    customerId: CUSTOMER_ID,
    email: 'nando@example.com',
    firstName: 'Nando',
    lastName: 'Alvarez',
    ...overrides,
  }
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method: 'GET', headers })
}

function post(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { method: 'POST', headers })
}

function location(response: Response): string {
  return response.headers.get('location') ?? ''
}

beforeEach(() => {
  jarStore.clear()
  vi.mocked(hasCustomerAccountEnv).mockReturnValue(true)
  vi.mocked(discover).mockReset().mockResolvedValue(DISCOVERY)
  vi.mocked(exchangeCode).mockReset()
  vi.mocked(refreshTokens).mockReset()
  vi.mocked(getCustomerSummary).mockReset().mockResolvedValue(SUMMARY)
  vi.mocked(updateCartBuyerIdentity).mockReset()
  vi.mocked(resolveCustomer).mockReset().mockResolvedValue({ id: 'cus_1', created: false })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('safeReturnTo', () => {
  it('accepts only same-origin paths', () => {
    expect(safeReturnTo('/account/orders?page=2', '/account')).toBe('/account/orders?page=2')
    expect(safeReturnTo('/', '/account')).toBe('/')
    expect(safeReturnTo('//evil.example', '/account')).toBe('/account')
    expect(safeReturnTo('/\\evil.example', '/account')).toBe('/account')
    expect(safeReturnTo('https://evil.example/x', '/account')).toBe('/account')
    expect(safeReturnTo('javascript:alert(1)', '/account')).toBe('/account')
    expect(safeReturnTo('account', '/account')).toBe('/account')
    expect(safeReturnTo('', '/account')).toBe('/account')
    expect(safeReturnTo(null, '/account')).toBe('/account')
    expect(safeReturnTo('/x\nSet-Cookie: a=b', '/account')).toBe('/account')
    expect(safeReturnTo(`/${'a'.repeat(3000)}`, '/account')).toBe('/account')
  })
})

describe('GET /account/login', () => {
  it('redirects to /account?unavailable=1 when accounts are unconfigured', async () => {
    vi.mocked(hasCustomerAccountEnv).mockReturnValue(false)

    const response = await loginGET(get('/account/login'))

    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/account?unavailable=1`)
    expect(discover).not.toHaveBeenCalled()
    expect(jarStore.size).toBe(0)
  })

  it('stores PKCE + state in the oauth cookie and redirects to the authorize endpoint', async () => {
    const response = await loginGET(get('/account/login?return_to=%2Faccount%2Forders'))

    expect(response.status).toBe(302)
    const url = new URL(location(response))
    expect(`${url.origin}${url.pathname}`).toBe(DISCOVERY.authorizationEndpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: 'openid email customer-account-api:full',
      client_id: 'shp_client',
      response_type: 'code',
      redirect_uri: `${ORIGIN}/account/callback`,
      state: 'random-token',
      nonce: 'random-token',
      code_challenge: 'pkce-challenge',
      code_challenge_method: 'S256',
    })
    expect(jarStore.get(OAUTH_STATE_COOKIE)?.options).toMatchObject({ httpOnly: true, maxAge: 600 })
    await expect(readOAuthState()).resolves.toEqual({
      state: 'random-token',
      nonce: 'random-token',
      verifier: 'pkce-verifier',
      returnTo: '/account/orders',
    })
  })

  it('falls back to /account for an unsafe return_to', async () => {
    await loginGET(get('/account/login?return_to=https%3A%2F%2Fevil.example'))
    await expect(readOAuthState()).resolves.toMatchObject({ returnTo: '/account' })
  })

  it('redirects to /account?error=signin when discovery fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(discover).mockRejectedValue(new CustomerAccountError('discovery failed', { status: 503 }))

    const response = await loginGET(get('/account/login'))

    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/account?error=signin`)
    expect(jarStore.has(OAUTH_STATE_COOKIE)).toBe(false)
    spy.mockRestore()
  })
})

describe('GET /account/callback', () => {
  const state = { state: 'state-1', nonce: 'nonce-1', verifier: 'pkce-verifier', returnTo: '/account/orders' }

  it('rejects a missing state cookie', async () => {
    const response = await callbackGET(get('/account/callback?code=c&state=state-1'))
    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/account/login?error=state`)
    expect(exchangeCode).not.toHaveBeenCalled()
  })

  it('rejects a state mismatch and clears the oauth cookie', async () => {
    await writeOAuthState(state)
    const response = await callbackGET(get('/account/callback?code=c&state=other'))
    expect(location(response)).toBe(`${ORIGIN}/account/login?error=state`)
    expect(exchangeCode).not.toHaveBeenCalled()
    expect(jarStore.has(OAUTH_STATE_COOKIE)).toBe(false)
  })

  it('passes a sanitised provider error back to the login page', async () => {
    await writeOAuthState(state)
    const response = await callbackGET(
      get('/account/callback?error=access_denied%3Cscript%3E&state=state-1')
    )
    expect(location(response)).toBe(`${ORIGIN}/account/login?error=access_denied`)
    expect(exchangeCode).not.toHaveBeenCalled()
  })

  it('rejects a missing code', async () => {
    await writeOAuthState(state)
    const response = await callbackGET(get('/account/callback?state=state-1'))
    expect(location(response)).toBe(`${ORIGIN}/account/login?error=state`)
  })

  it('exchanges the code, writes the session, links the customer and redirects to return_to', async () => {
    await writeOAuthState(state)
    vi.mocked(exchangeCode).mockResolvedValue(tokens())

    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))

    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/account/orders`)
    expect(exchangeCode).toHaveBeenCalledWith(DISCOVERY, {
      code: 'the-code',
      verifier: 'pkce-verifier',
      redirectUri: `${ORIGIN}/account/callback`,
    })
    expect(getCustomerSummary).toHaveBeenCalledWith('atkn')
    await expect(readCustomerSession()).resolves.toEqual(session())
    expect(jarStore.get(CUSTOMER_COOKIE)?.options).toMatchObject({ httpOnly: true, sameSite: 'lax' })
    expect(jarStore.has(OAUTH_STATE_COOKIE)).toBe(false)
    expect(resolveCustomer).toHaveBeenCalledWith({
      shopifyCustomerId: CUSTOMER_ID,
      email: 'nando@example.com',
      firstName: 'Nando',
      lastName: 'Alvarez',
    })
    expect(updateCartBuyerIdentity).not.toHaveBeenCalled()
  })

  it('attaches the hof_cart cart to the customer and swallows a failure there', async () => {
    await writeOAuthState(state)
    vi.mocked(exchangeCode).mockResolvedValue(tokens())
    jarStore.set(CART_COOKIE, { name: CART_COOKIE, value: CART_ID })
    vi.mocked(updateCartBuyerIdentity).mockRejectedValue(new Error('cart gone'))

    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))

    expect(location(response)).toBe(`${ORIGIN}/account/orders`)
    expect(updateCartBuyerIdentity).toHaveBeenCalledWith(CART_ID, { customerAccessToken: 'atkn' })
    await expect(readCustomerSession()).resolves.not.toBeNull()
  })

  it('still signs in when the loyalty bridge fails', async () => {
    await writeOAuthState(state)
    vi.mocked(exchangeCode).mockResolvedValue(tokens())
    vi.mocked(resolveCustomer).mockRejectedValue(new Error('db down'))

    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))

    expect(location(response)).toBe(`${ORIGIN}/account/orders`)
    await expect(readCustomerSession()).resolves.not.toBeNull()
  })

  it('rejects an id token whose nonce does not match', async () => {
    await writeOAuthState(state)
    vi.mocked(exchangeCode).mockResolvedValue(tokens({ idToken: idToken('other-nonce') }))

    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))

    expect(location(response)).toBe(`${ORIGIN}/account/login?error=state`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
    expect(getCustomerSummary).not.toHaveBeenCalled()
  })

  it('redirects to /account/login?error=exchange when the token exchange fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeOAuthState(state)
    vi.mocked(exchangeCode).mockRejectedValue(
      new CustomerAccountError('token request failed', { status: 400, code: 'invalid_grant' })
    )

    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))

    expect(location(response)).toBe(`${ORIGIN}/account/login?error=exchange`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
    expect(jarStore.has(OAUTH_STATE_COOKIE)).toBe(false)
    spy.mockRestore()
  })

  it('never redirects off-origin even if the stored return_to is unsafe', async () => {
    await writeOAuthState({ ...state, returnTo: '//evil.example' })
    vi.mocked(exchangeCode).mockResolvedValue(tokens())
    const response = await callbackGET(get('/account/callback?code=the-code&state=state-1'))
    expect(location(response)).toBe(`${ORIGIN}/account`)
  })
})

describe('GET /account/refresh', () => {
  it('sends a signed-out visitor to the login page with return_to', async () => {
    const response = await refreshGET(get('/account/refresh?return_to=%2Faccount%2Forders'))
    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/account/login?return_to=%2Faccount%2Forders`)
    expect(refreshTokens).not.toHaveBeenCalled()
  })

  it('refreshes a stale session, keeps the id token, rewrites the cookie and returns', async () => {
    await writeCustomerSession(session({ tokens: tokens({ expiresAt: NOW - HOUR }) }))
    const next = { accessToken: 'atkn2', refreshToken: 'rtkn2', idToken: null, expiresAt: NOW + HOUR }
    vi.mocked(refreshTokens).mockResolvedValue(next)

    const response = await refreshGET(get('/account/refresh?return_to=%2Faccount%2Forders'))

    expect(location(response)).toBe(`${ORIGIN}/account/orders`)
    expect(refreshTokens).toHaveBeenCalledWith(DISCOVERY, 'rtkn')
    await expect(readCustomerSession()).resolves.toEqual(
      session({ tokens: { ...next, idToken: idToken('nonce-1') } })
    )
  })

  it('returns immediately when the token is still fresh', async () => {
    await writeCustomerSession(session())
    const response = await refreshGET(get('/account/refresh?return_to=%2Faccount'))
    expect(location(response)).toBe(`${ORIGIN}/account`)
    expect(refreshTokens).not.toHaveBeenCalled()
  })

  it('clears the session and sends to login with error=expired when the refresh fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeCustomerSession(session({ tokens: tokens({ expiresAt: NOW - HOUR }) }))
    vi.mocked(refreshTokens).mockRejectedValue(
      new CustomerAccountError('token request failed', { status: 400, code: 'invalid_grant' })
    )

    const response = await refreshGET(get('/account/refresh?return_to=%2Faccount%2Forders'))

    expect(location(response)).toBe(`${ORIGIN}/account/login?return_to=%2Faccount%2Forders&error=expired`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
    spy.mockRestore()
  })

  it('clears the session when there is no refresh token', async () => {
    await writeCustomerSession(session({ tokens: tokens({ expiresAt: NOW - HOUR, refreshToken: null }) }))
    const response = await refreshGET(get('/account/refresh'))
    expect(location(response)).toBe(`${ORIGIN}/account/login?return_to=%2Faccount&error=expired`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
    expect(refreshTokens).not.toHaveBeenCalled()
  })

  it('redirects to /account?unavailable=1 when unconfigured', async () => {
    vi.mocked(hasCustomerAccountEnv).mockReturnValue(false)
    const response = await refreshGET(get('/account/refresh'))
    expect(location(response)).toBe(`${ORIGIN}/account?unavailable=1`)
  })
})

describe('/account/logout', () => {
  it('GET renders a confirm page with a POST form and signs nobody out', async () => {
    await writeCustomerSession(session())

    const response = await logoutGET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(response.headers.get('cache-control')).toContain('no-store')
    const html = await response.text()
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/account\/logout"/i)
    expect(html).toMatch(/<button[^>]*>/i)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(true)
  })

  it('POST clears the cookie and redirects to the Shopify logout endpoint', async () => {
    await writeCustomerSession(session())

    const response = await logoutPOST(post('/account/logout', { origin: ORIGIN }))

    expect(response.status).toBe(302)
    const url = new URL(location(response))
    expect(`${url.origin}${url.pathname}`).toBe(DISCOVERY.logoutEndpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      id_token_hint: idToken('nonce-1'),
      post_logout_redirect_uri: ORIGIN,
    })
    expect(jar.delete).toHaveBeenCalledWith(CUSTOMER_COOKIE)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
  })

  it('POST without a session or id token goes home', async () => {
    let response = await logoutPOST(post('/account/logout'))
    expect(response.status).toBe(302)
    expect(location(response)).toBe(`${ORIGIN}/`)

    await writeCustomerSession(session({ tokens: tokens({ idToken: null }) }))
    response = await logoutPOST(post('/account/logout'))
    expect(location(response)).toBe(`${ORIGIN}/`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
  })

  it('POST still signs out locally when discovery fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await writeCustomerSession(session())
    vi.mocked(discover).mockRejectedValue(new Error('offline'))

    const response = await logoutPOST(post('/account/logout'))

    expect(location(response)).toBe(`${ORIGIN}/`)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(false)
    spy.mockRestore()
  })

  it('POST from another origin is refused and signs nobody out', async () => {
    await writeCustomerSession(session())
    const response = await logoutPOST(post('/account/logout', { origin: 'https://evil.example' }))
    expect(response.status).toBe(403)
    expect(jarStore.has(CUSTOMER_COOKIE)).toBe(true)
  })
})
