import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { getCustomerAccountEnv } from './env'
import { CustomerAccountError } from './errors'

/**
 * Customer Account API OAuth (public client + PKCE), per the Phase 4 plan's
 * "Shared contracts".
 *
 * Endpoints are never hard-coded: `discover()` reads
 * `<issuer>/.well-known/openid-configuration` (authorization, token and logout
 * endpoints) and `<issuer>/.well-known/customer-account-api` (the GraphQL
 * endpoint), where the issuer is `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER` when set
 * (the e2e mock) and `https://<store domain>` otherwise. The result is cached
 * per process for ten minutes.
 *
 * Token requests are form-encoded POSTs carrying `client_id` (no client
 * secret), the `Origin: <base url>` header Shopify requires from public
 * clients, and a `User-Agent`. A non-2xx answer becomes a
 * `CustomerAccountError({ status, code })` whose `code` is the OAuth `error`
 * value (`invalid_grant`, …). Token values never appear in error messages.
 */

export type Discovery = {
  authorizationEndpoint: string
  tokenEndpoint: string
  logoutEndpoint: string
  graphqlEndpoint: string
}

export type TokenSet = {
  accessToken: string
  refreshToken: string | null
  idToken: string | null
  expiresAt: number /* epoch ms */
}

export const USER_AGENT = 'HeadOverFeels-Storefront/1.0'
export const OAUTH_SCOPE = 'openid email customer-account-api:full'
export const DISCOVERY_TTL_MS = 10 * 60_000

/** Shopify's documented access-token lifetime, used only when `expires_in` is absent. */
const DEFAULT_EXPIRES_IN_SECONDS = 2 * 60 * 60

type OpenIdConfiguration = {
  authorization_endpoint?: unknown
  token_endpoint?: unknown
  end_session_endpoint?: unknown
}

type CustomerAccountApiConfiguration = {
  graphql_api?: unknown
}

type TokenResponse = {
  access_token?: unknown
  refresh_token?: unknown
  id_token?: unknown
  expires_in?: unknown
  error?: unknown
  error_description?: unknown
}

let discoveryCache: { issuer: string; value: Discovery; expiresAt: number } | null = null

/** Test hook: forget the cached discovery documents. */
export function resetDiscoveryCache(): void {
  discoveryCache = null
}

function issuerUrl(): string {
  const env = getCustomerAccountEnv()
  return env.issuerOverride ?? `https://${env.storeDomain}`
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CustomerAccountError(`Customer Account discovery is missing ${label}`)
  }
  return value
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new CustomerAccountError(`Customer Account discovery (${label}) failed with status ${response.status}`, {
      status: response.status,
    })
  }
  try {
    return (await response.json()) as T
  } catch (cause) {
    throw new CustomerAccountError(`Customer Account discovery (${label}) returned non-JSON`, {
      status: response.status,
      cause,
    })
  }
}

export async function discover(): Promise<Discovery> {
  const issuer = issuerUrl()
  const now = Date.now()
  if (discoveryCache && discoveryCache.issuer === issuer && discoveryCache.expiresAt > now) {
    return discoveryCache.value
  }

  const [oidc, api] = await Promise.all([
    fetchJson<OpenIdConfiguration>(`${issuer}/.well-known/openid-configuration`, 'openid-configuration'),
    fetchJson<CustomerAccountApiConfiguration>(`${issuer}/.well-known/customer-account-api`, 'customer-account-api'),
  ])

  const value: Discovery = {
    authorizationEndpoint: requireString(oidc.authorization_endpoint, 'authorization_endpoint'),
    tokenEndpoint: requireString(oidc.token_endpoint, 'token_endpoint'),
    logoutEndpoint: requireString(oidc.end_session_endpoint, 'end_session_endpoint'),
    graphqlEndpoint: requireString(api.graphql_api, 'graphql_api'),
  }

  discoveryCache = { issuer, value, expiresAt: now + DISCOVERY_TTL_MS }
  return value
}

// ---------------------------------------------------------------- PKCE

/** RFC 7636 S256: 32 random bytes → 43-char base64url verifier, SHA-256 challenge, no padding. */
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** Opaque random value for `state` / `nonce`. */
export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url')
}

// ---------------------------------------------------------------- URLs

export function buildAuthorizeUrl(
  d: Discovery,
  p: { state: string; nonce: string; challenge: string; redirectUri: string }
): string {
  const { clientId } = getCustomerAccountEnv()
  const url = new URL(d.authorizationEndpoint)
  url.searchParams.set('scope', OAUTH_SCOPE)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', p.redirectUri)
  url.searchParams.set('state', p.state)
  url.searchParams.set('nonce', p.nonce)
  url.searchParams.set('code_challenge', p.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function buildLogoutUrl(
  d: Discovery,
  p: { idToken: string; postLogoutRedirectUri: string }
): string {
  const url = new URL(d.logoutEndpoint)
  url.searchParams.set('id_token_hint', p.idToken)
  url.searchParams.set('post_logout_redirect_uri', p.postLogoutRedirectUri)
  return url.toString()
}

// ---------------------------------------------------------------- tokens

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toTokenSet(body: TokenResponse): TokenSet {
  const accessToken = optionalString(body.access_token)
  if (!accessToken) {
    throw new CustomerAccountError('Customer Account token response had no access_token')
  }
  const expiresIn =
    typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
      ? body.expires_in
      : typeof body.expires_in === 'string' && Number.isFinite(Number(body.expires_in))
        ? Number(body.expires_in)
        : DEFAULT_EXPIRES_IN_SECONDS
  return {
    accessToken,
    refreshToken: optionalString(body.refresh_token),
    idToken: optionalString(body.id_token),
    expiresAt: Date.now() + Math.max(0, expiresIn) * 1000,
  }
}

async function postTokenRequest(d: Discovery, params: Record<string, string>): Promise<TokenSet> {
  const { clientId, baseUrl } = getCustomerAccountEnv()
  const body = new URLSearchParams({ client_id: clientId, ...params })

  const response = await fetch(d.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Origin: baseUrl,
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
    cache: 'no-store',
  })

  let parsed: TokenResponse = {}
  try {
    parsed = (await response.json()) as TokenResponse
  } catch {
    parsed = {}
  }

  if (!response.ok) {
    const code = optionalString(parsed.error) ?? 'TOKEN_REQUEST_FAILED'
    const description = optionalString(parsed.error_description)
    throw new CustomerAccountError(
      `Customer Account token request failed with status ${response.status} (${code}${description ? `: ${description}` : ''})`,
      { status: response.status, code }
    )
  }

  return toTokenSet(parsed)
}

export async function exchangeCode(
  d: Discovery,
  p: { code: string; verifier: string; redirectUri: string }
): Promise<TokenSet> {
  return postTokenRequest(d, {
    grant_type: 'authorization_code',
    redirect_uri: p.redirectUri,
    code: p.code,
    code_verifier: p.verifier,
  })
}

export async function refreshTokens(d: Discovery, refreshToken: string): Promise<TokenSet> {
  return postTokenRequest(d, { grant_type: 'refresh_token', refresh_token: refreshToken })
}
