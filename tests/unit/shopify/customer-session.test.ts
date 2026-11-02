// @vitest-environment node
// tests/unit/shopify/customer-session.test.ts
//
// Node environment on purpose: `jose` rejects jsdom's cross-realm Uint8Array
// ("plaintext must be an instance of Uint8Array"); this module only ever runs
// server-side anyway.
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

class RedirectSignal extends Error {
  constructor(public readonly location: string) {
    super(`NEXT_REDIRECT ${location}`)
  }
}
vi.mock('next/navigation', () => ({
  redirect: vi.fn((location: string) => {
    throw new RedirectSignal(location)
  }),
}))

import { SignedOutError } from '@/lib/shopify/customer/errors'
import {
  CUSTOMER_COOKIE,
  clearCustomerSession,
  clearOAuthState,
  getCustomerSession,
  isAccessTokenFresh,
  OAUTH_STATE_COOKIE,
  readCustomerSession,
  readOAuthState,
  requireFreshSession,
  sealCustomerSession,
  writeCustomerSession,
  writeOAuthState,
  type CustomerSession,
} from '@/lib/shopify/customer/session'
import { redirect } from 'next/navigation'

const NOW = Date.parse('2026-10-11T10:00:00Z')
const HOUR = 60 * 60 * 1000

function session(overrides: Partial<CustomerSession> = {}): CustomerSession {
  return {
    tokens: {
      accessToken: 'atkn',
      refreshToken: 'rtkn',
      idToken: 'idtkn',
      expiresAt: NOW + 2 * HOUR,
    },
    customerId: 'gid://shopify/Customer/8123456789',
    email: 'nando@example.com',
    firstName: 'Nando',
    lastName: 'Alvarez',
    ...overrides,
  }
}

const ENV_KEYS = [
  'SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID',
  'NEXT_PUBLIC_BASE_URL',
  'CUSTOMER_SESSION_SECRET',
  'AUTH_SECRET',
  'NODE_ENV',
] as const
const snapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) snapshot[key] = process.env[key]
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID = 'shp_client'
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID = '85215183073'
  process.env.NEXT_PUBLIC_BASE_URL = 'https://hof-preview.vercel.app'
  process.env.CUSTOMER_SESSION_SECRET = 'unit-test-secret'
  delete process.env.AUTH_SECRET
  jarStore.clear()
  jar.get.mockClear()
  jar.set.mockClear()
  jar.delete.mockClear()
  vi.mocked(redirect).mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else (process.env as Record<string, string>)[key] = value
  }
})

describe('customer session cookie', () => {
  it('round-trips a session through an encrypted hof_customer cookie', async () => {
    await writeCustomerSession(session())

    const entry = jarStore.get(CUSTOMER_COOKIE)
    expect(entry).toBeDefined()
    // JWE compact serialisation: five base64url segments, nothing readable.
    expect(entry!.value.split('.')).toHaveLength(5)
    expect(entry!.value).not.toContain('atkn')
    expect(entry!.value).not.toContain('nando@example.com')
    expect(entry!.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    await expect(readCustomerSession()).resolves.toEqual(session())
  })

  it('sets secure cookies in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await writeCustomerSession(session())
    expect(jarStore.get(CUSTOMER_COOKIE)!.options).toMatchObject({ secure: true })
    vi.unstubAllEnvs()
  })

  it('returns null when the cookie is absent', async () => {
    await expect(readCustomerSession()).resolves.toBeNull()
  })

  it('returns null (and does not delete anything) when the cookie is tampered with', async () => {
    await writeCustomerSession(session())
    const sealed = jarStore.get(CUSTOMER_COOKIE)!.value
    const parts = sealed.split('.')
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA')
    jarStore.set(CUSTOMER_COOKIE, { name: CUSTOMER_COOKIE, value: parts.join('.') })

    await expect(readCustomerSession()).resolves.toBeNull()
    expect(jar.delete).not.toHaveBeenCalled()
  })

  it('returns null for a cookie sealed with a different secret', async () => {
    process.env.CUSTOMER_SESSION_SECRET = 'other-secret'
    const foreign = await sealCustomerSession(session())
    process.env.CUSTOMER_SESSION_SECRET = 'unit-test-secret'
    jarStore.set(CUSTOMER_COOKIE, { name: CUSTOMER_COOKIE, value: foreign })

    await expect(readCustomerSession()).resolves.toBeNull()
  })

  it('returns null for a well-formed JWE whose payload is not a session', async () => {
    const { EncryptJWT } = await import('jose')
    const { createHash } = await import('node:crypto')
    const key = createHash('sha256').update('unit-test-secret').digest()
    const bogus = await new EncryptJWT({ session: { customerId: 1 } })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .encrypt(key)
    jarStore.set(CUSTOMER_COOKIE, { name: CUSTOMER_COOKIE, value: bogus })

    await expect(readCustomerSession()).resolves.toBeNull()
  })

  it('falls back to AUTH_SECRET when CUSTOMER_SESSION_SECRET is unset', async () => {
    delete process.env.CUSTOMER_SESSION_SECRET
    process.env.AUTH_SECRET = 'legacy-secret'
    await writeCustomerSession(session())
    await expect(readCustomerSession()).resolves.toEqual(session())
  })

  it('clearCustomerSession deletes the cookie', async () => {
    await writeCustomerSession(session())
    await clearCustomerSession()
    expect(jar.delete).toHaveBeenCalledWith(CUSTOMER_COOKIE)
    await expect(readCustomerSession()).resolves.toBeNull()
  })
})

describe('isAccessTokenFresh', () => {
  it('is true while the token has more than the skew left', () => {
    expect(isAccessTokenFresh(session())).toBe(true)
    expect(isAccessTokenFresh(session({ tokens: { ...session().tokens, expiresAt: NOW + 4 * 60_000 } }))).toBe(false)
    expect(isAccessTokenFresh(session({ tokens: { ...session().tokens, expiresAt: NOW + 6 * 60_000 } }))).toBe(true)
    expect(isAccessTokenFresh(session({ tokens: { ...session().tokens, expiresAt: NOW - 1 } }))).toBe(false)
  })

  it('honours a custom skew', () => {
    const soon = session({ tokens: { ...session().tokens, expiresAt: NOW + 30_000 } })
    expect(isAccessTokenFresh(soon, 0)).toBe(true)
    expect(isAccessTokenFresh(soon, 60_000)).toBe(false)
  })
})

describe('getCustomerSession', () => {
  it('returns null without reading the cookie when accounts are unconfigured', async () => {
    delete process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID
    await writeCustomerSession(session())
    jar.get.mockClear()

    await expect(getCustomerSession()).resolves.toBeNull()
    expect(jar.get).not.toHaveBeenCalled()
  })

  it('returns a stale session as-is (never refreshes)', async () => {
    const stale = session({ tokens: { ...session().tokens, expiresAt: NOW - HOUR } })
    await writeCustomerSession(stale)
    await expect(getCustomerSession()).resolves.toEqual(stale)
  })
})

describe('requireFreshSession', () => {
  it('returns a fresh session', async () => {
    await writeCustomerSession(session())
    await expect(requireFreshSession('/account')).resolves.toEqual(session())
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects to /account/refresh?return_to=<encoded> when the token is stale', async () => {
    await writeCustomerSession(session({ tokens: { ...session().tokens, expiresAt: NOW + 60_000 } }))

    const error = await requireFreshSession('/account/orders?page=2').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(RedirectSignal)
    expect((error as RedirectSignal).location).toBe(
      '/account/refresh?return_to=%2Faccount%2Forders%3Fpage%3D2'
    )
  })

  it('throws SignedOutError when there is no session', async () => {
    await expect(requireFreshSession('/account')).rejects.toBeInstanceOf(SignedOutError)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('throws SignedOutError when accounts are unconfigured', async () => {
    await writeCustomerSession(session())
    delete process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID
    await expect(requireFreshSession('/account')).rejects.toBeInstanceOf(SignedOutError)
  })
})

describe('oauth state cookie', () => {
  const state = { state: 'st', nonce: 'nn', verifier: 'vv', returnTo: '/account/orders' }

  it('round-trips through an encrypted 10 minute httpOnly cookie', async () => {
    await writeOAuthState(state)

    const entry = jarStore.get(OAUTH_STATE_COOKIE)!
    expect(entry.value).not.toContain('vv')
    expect(entry.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 })
    await expect(readOAuthState()).resolves.toEqual(state)
  })

  it('returns null when absent or expired, and clearOAuthState deletes it', async () => {
    await expect(readOAuthState()).resolves.toBeNull()

    await writeOAuthState(state)
    vi.setSystemTime(new Date(NOW + 12 * 60_000))
    await expect(readOAuthState()).resolves.toBeNull()

    await clearOAuthState()
    expect(jar.delete).toHaveBeenCalledWith(OAUTH_STATE_COOKIE)
  })
})
