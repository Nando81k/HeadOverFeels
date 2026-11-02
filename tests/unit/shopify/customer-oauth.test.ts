// tests/unit/shopify/customer-oauth.test.ts
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { CustomerAccountError } from '@/lib/shopify/customer/errors'
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  createPkce,
  discover,
  exchangeCode,
  refreshTokens,
  resetDiscoveryCache,
  USER_AGENT,
  type Discovery,
} from '@/lib/shopify/customer/oauth'

const BASE_URL = 'https://hof-preview.vercel.app'
const ISSUER = 'https://tgqucm-qg.myshopify.com'

const OIDC = {
  issuer: 'https://shopify.com/authentication/85215183073',
  authorization_endpoint: 'https://shopify.com/authentication/85215183073/oauth/authorize',
  token_endpoint: 'https://shopify.com/authentication/85215183073/oauth/token',
  end_session_endpoint: 'https://shopify.com/authentication/85215183073/logout',
}
const API = {
  graphql_api: 'https://shopify.com/85215183073/account/customer/api/2026-07/graphql',
  mcp_api: 'https://shopify.com/85215183073/account/customer/api/2026-07/mcp',
}

const DISCOVERY: Discovery = {
  authorizationEndpoint: OIDC.authorization_endpoint,
  tokenEndpoint: OIDC.token_endpoint,
  logoutEndpoint: OIDC.end_session_endpoint,
  graphqlEndpoint: API.graphql_api,
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

const mockFetch = () => vi.mocked(fetch)

function initOf(call: number): RequestInit {
  return mockFetch().mock.calls[call][1] as RequestInit
}

function urlOf(call: number): string {
  return String(mockFetch().mock.calls[call][0])
}

const ENV_KEYS = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_ISSUER',
  'NEXT_PUBLIC_BASE_URL',
] as const
const snapshot: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
  process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID = 'shp_client'
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID = '85215183073'
  process.env.NEXT_PUBLIC_BASE_URL = BASE_URL
  mockFetch().mockReset()
  resetDiscoveryCache()
})

afterEach(() => {
  vi.useRealTimers()
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetDiscoveryCache()
})

function mockDiscovery() {
  mockFetch().mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/.well-known/openid-configuration')) return jsonResponse(OIDC)
    if (url.endsWith('/.well-known/customer-account-api')) return jsonResponse(API)
    throw new Error(`unexpected fetch ${url}`)
  })
}

describe('discover', () => {
  it('reads both well-known documents from https://<store domain> with no-store and a User-Agent', async () => {
    mockDiscovery()

    const discovery = await discover()

    expect(discovery).toEqual(DISCOVERY)
    const urls = mockFetch().mock.calls.map((call) => String(call[0])).sort()
    expect(urls).toEqual([
      `${ISSUER}/.well-known/customer-account-api`,
      `${ISSUER}/.well-known/openid-configuration`,
    ])
    for (let i = 0; i < 2; i += 1) {
      expect(initOf(i).cache).toBe('no-store')
      expect(initOf(i).headers).toMatchObject({ 'User-Agent': USER_AGENT })
    }
  })

  it('uses SHOPIFY_CUSTOMER_ACCOUNT_ISSUER as the issuer when set', async () => {
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_ISSUER = 'http://127.0.0.1:4443/customer'
    mockDiscovery()

    await discover()

    expect(urlOf(0).startsWith('http://127.0.0.1:4443/customer/.well-known/')).toBe(true)
  })

  it('caches the result per process for 10 minutes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
    mockDiscovery()

    await discover()
    await discover()
    expect(mockFetch()).toHaveBeenCalledTimes(2)

    vi.setSystemTime(new Date('2026-10-11T10:09:00Z'))
    await discover()
    expect(mockFetch()).toHaveBeenCalledTimes(2)

    vi.setSystemTime(new Date('2026-10-11T10:11:00Z'))
    await discover()
    expect(mockFetch()).toHaveBeenCalledTimes(4)
  })

  it('throws CustomerAccountError with the status when a document is not 2xx', async () => {
    mockFetch().mockImplementation(async (input) =>
      String(input).endsWith('openid-configuration') ? jsonResponse({}, 503) : jsonResponse(API)
    )

    const error = await discover().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).status).toBe(503)
  })

  it('throws when a document is missing an endpoint and does not cache the failure', async () => {
    mockFetch().mockImplementation(async (input) =>
      String(input).endsWith('openid-configuration')
        ? jsonResponse({ ...OIDC, token_endpoint: undefined })
        : jsonResponse(API)
    )
    await expect(discover()).rejects.toBeInstanceOf(CustomerAccountError)

    mockDiscovery()
    await expect(discover()).resolves.toEqual(DISCOVERY)
  })
})

describe('createPkce', () => {
  it('returns a 43–128 char base64url verifier and its S256 challenge without padding', () => {
    const { verifier, challenge } = createPkce()

    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/)
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
    expect(challenge).not.toContain('=')
  })

  it('is random', () => {
    expect(createPkce().verifier).not.toBe(createPkce().verifier)
  })
})

describe('buildAuthorizeUrl', () => {
  it('carries every OAuth parameter the Customer Account API expects', () => {
    const url = new URL(
      buildAuthorizeUrl(DISCOVERY, {
        state: 'st',
        nonce: 'nn',
        challenge: 'ch',
        redirectUri: `${BASE_URL}/account/callback`,
      })
    )

    expect(`${url.origin}${url.pathname}`).toBe(OIDC.authorization_endpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: 'openid email customer-account-api:full',
      client_id: 'shp_client',
      response_type: 'code',
      redirect_uri: `${BASE_URL}/account/callback`,
      state: 'st',
      nonce: 'nn',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    })
  })
})

describe('exchangeCode', () => {
  it('POSTs a form-encoded body with client_id, the Origin header and a User-Agent', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
    mockFetch().mockResolvedValueOnce(
      jsonResponse({
        access_token: 'atkn',
        refresh_token: 'rtkn',
        id_token: 'idtkn',
        expires_in: 7200,
        token_type: 'bearer',
      })
    )

    const tokens = await exchangeCode(DISCOVERY, {
      code: 'the-code',
      verifier: 'the-verifier',
      redirectUri: `${BASE_URL}/account/callback`,
    })

    expect(tokens).toEqual({
      accessToken: 'atkn',
      refreshToken: 'rtkn',
      idToken: 'idtkn',
      expiresAt: Date.parse('2026-10-11T12:00:00Z'),
    })
    expect(urlOf(0)).toBe(OIDC.token_endpoint)
    const init = initOf(0)
    expect(init.method).toBe('POST')
    expect(init.cache).toBe('no-store')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE_URL,
      'User-Agent': USER_AGENT,
    })
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      grant_type: 'authorization_code',
      client_id: 'shp_client',
      redirect_uri: `${BASE_URL}/account/callback`,
      code: 'the-code',
      code_verifier: 'the-verifier',
    })
  })

  it('maps a 4xx token response to CustomerAccountError with status and the OAuth error code', async () => {
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_grant', error_description: 'code expired' }, 400)
    )

    const error = await exchangeCode(DISCOVERY, {
      code: 'x',
      verifier: 'y',
      redirectUri: `${BASE_URL}/account/callback`,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).status).toBe(400)
    expect((error as CustomerAccountError).code).toBe('invalid_grant')
    expect((error as Error).message).not.toContain('atkn')
  })

  it('rejects a 2xx response without an access token', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ token_type: 'bearer' }))

    await expect(
      exchangeCode(DISCOVERY, { code: 'x', verifier: 'y', redirectUri: BASE_URL })
    ).rejects.toBeInstanceOf(CustomerAccountError)
  })
})

describe('refreshTokens', () => {
  it('POSTs grant_type=refresh_token with client_id and keeps a null id token', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'))
    mockFetch().mockResolvedValueOnce(
      jsonResponse({ access_token: 'atkn2', refresh_token: 'rtkn2', expires_in: 3600 })
    )

    const tokens = await refreshTokens(DISCOVERY, 'rtkn')

    expect(tokens).toEqual({
      accessToken: 'atkn2',
      refreshToken: 'rtkn2',
      idToken: null,
      expiresAt: Date.parse('2026-10-11T11:00:00Z'),
    })
    const init = initOf(0)
    expect(init.headers).toMatchObject({ Origin: BASE_URL, 'User-Agent': USER_AGENT })
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'shp_client',
      refresh_token: 'rtkn',
    })
  })

  it('maps a 401 to CustomerAccountError', async () => {
    mockFetch().mockResolvedValueOnce(jsonResponse({ error: 'invalid_token' }, 401))
    const error = await refreshTokens(DISCOVERY, 'rtkn').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CustomerAccountError)
    expect((error as CustomerAccountError).status).toBe(401)
  })
})

describe('buildLogoutUrl', () => {
  it('adds id_token_hint and post_logout_redirect_uri to the logout endpoint', () => {
    const url = new URL(
      buildLogoutUrl(DISCOVERY, { idToken: 'idtkn', postLogoutRedirectUri: BASE_URL })
    )
    expect(`${url.origin}${url.pathname}`).toBe(OIDC.end_session_endpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      id_token_hint: 'idtkn',
      post_logout_redirect_uri: BASE_URL,
    })
  })
})
