import 'server-only'

import { createHash } from 'node:crypto'

import { EncryptJWT, jwtDecrypt } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getCustomerSessionSecret, hasCustomerAccountEnv } from './env'
import { SignedOutError } from './errors'
import type { TokenSet } from './oauth'

/**
 * The `hof_customer` session cookie and the `hof_customer_oauth` state cookie.
 *
 * Customer Account tokens live only server-side, sealed in an AES-256-GCM JWE
 * (`jose` `EncryptJWT`, `alg: dir`, key = SHA-256 of `CUSTOMER_SESSION_SECRET`
 * with `AUTH_SECRET` as the fallback). Both cookies are httpOnly, `sameSite:
 * lax`, `secure` in production; the session lives 30 days, the OAuth state 10
 * minutes. Writes are only legal inside Server Actions and route handlers
 * (Next 16); reads work anywhere `cookies()` does.
 *
 * A malformed, tampered or foreign cookie reads as `null` and is left alone —
 * RSC cannot delete cookies — so it is overwritten on the next write instead.
 *
 * `getCustomerSession()` is the RSC-safe read: it returns the session even
 * when the access token is stale and never refreshes. `requireFreshSession()`
 * is for pages that are about to call the API: stale → `redirect` to
 * `/account/refresh?return_to=…` (a route handler, which can set cookies);
 * none → `SignedOutError` for the `SignInGate` boundary.
 */

export { SignedOutError } from './errors'

export const CUSTOMER_COOKIE = 'hof_customer'
export const OAUTH_STATE_COOKIE = 'hof_customer_oauth'

export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60
/** Leeway for clock drift between the issuing and reading server (seconds). */
const CLOCK_TOLERANCE_SECONDS = 60

export type CustomerSession = {
  tokens: TokenSet
  customerId: string /* gid */
  email: string
  firstName: string | null
  lastName: string | null
}

export type OAuthState = { state: string; nonce: string; verifier: string; returnTo: string }

const sessionSchema = z.object({
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1).nullable(),
    idToken: z.string().min(1).nullable(),
    expiresAt: z.number().finite(),
  }),
  customerId: z.string().min(1),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
})

const oauthStateSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  verifier: z.string().min(1),
  returnTo: z.string(),
})

const SESSION_CLAIM = 'session'
const STATE_CLAIM = 'oauth'

// ---------------------------------------------------------------- sealing

function encryptionKey(): Uint8Array {
  return new Uint8Array(createHash('sha256').update(getCustomerSessionSecret()).digest())
}

async function seal(claim: string, payload: unknown, maxAgeSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new EncryptJWT({ [claim]: payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds)
    .encrypt(encryptionKey())
}

async function open<T>(claim: string, token: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const { payload } = await jwtDecrypt(token, encryptionKey(), {
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      contentEncryptionAlgorithms: ['A256GCM'],
      keyManagementAlgorithms: ['dir'],
    })
    const parsed = schema.safeParse(payload[claim])
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Seal a session the way `writeCustomerSession` does (e2e mock / tests). */
export async function sealCustomerSession(session: CustomerSession): Promise<string> {
  return seal(SESSION_CLAIM, session, CUSTOMER_SESSION_MAX_AGE_SECONDS)
}

/** Decrypt a sealed session string; `null` when invalid, expired or foreign. */
export async function openCustomerSession(token: string): Promise<CustomerSession | null> {
  return open(SESSION_CLAIM, token, sessionSchema)
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

// ---------------------------------------------------------------- session cookie

/** Decrypts the cookie; `null` when absent or invalid. Does NOT refresh. */
export async function readCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies()
  const value = jar.get(CUSTOMER_COOKIE)?.value
  if (!value) return null
  return openCustomerSession(value)
}

/** Server Actions / route handlers only. */
export async function writeCustomerSession(session: CustomerSession): Promise<void> {
  const sealed = await sealCustomerSession(session)
  const jar = await cookies()
  jar.set(CUSTOMER_COOKIE, sealed, cookieOptions(CUSTOMER_SESSION_MAX_AGE_SECONDS))
}

export async function clearCustomerSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(CUSTOMER_COOKIE)
}

export function isAccessTokenFresh(session: CustomerSession, skewMs = 5 * 60_000): boolean {
  return session.tokens.expiresAt - skewMs > Date.now()
}

/** RSC-safe: `null` when unconfigured or signed out; a stale session is returned as-is. */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  if (!hasCustomerAccountEnv()) return null
  return readCustomerSession()
}

/** The refresh route for a page, with the page to come back to. */
export function refreshPath(returnTo: string): string {
  return `/account/refresh?return_to=${encodeURIComponent(returnTo)}`
}

/**
 * In RSC: stale → `redirect('/account/refresh?return_to=…')`; none →
 * `SignedOutError` (caught by the `SignInGate` boundary).
 */
export async function requireFreshSession(returnTo: string): Promise<CustomerSession> {
  const session = await getCustomerSession()
  if (!session) throw new SignedOutError()
  if (!isAccessTokenFresh(session)) redirect(refreshPath(returnTo))
  return session
}

// ---------------------------------------------------------------- oauth state cookie

export async function writeOAuthState(state: OAuthState): Promise<void> {
  const sealed = await seal(STATE_CLAIM, state, OAUTH_STATE_MAX_AGE_SECONDS)
  const jar = await cookies()
  jar.set(OAUTH_STATE_COOKIE, sealed, cookieOptions(OAUTH_STATE_MAX_AGE_SECONDS))
}

export async function readOAuthState(): Promise<OAuthState | null> {
  const jar = await cookies()
  const value = jar.get(OAUTH_STATE_COOKIE)?.value
  if (!value) return null
  return open(STATE_CLAIM, value, oauthStateSchema)
}

export async function clearOAuthState(): Promise<void> {
  const jar = await cookies()
  jar.delete(OAUTH_STATE_COOKIE)
}

// ---------------------------------------------------------------- helpers

const MAX_RETURN_TO_LENGTH = 2048

/**
 * `return_to` whitelist: a same-origin path only. Must start with a single
 * `/` (so `//host` and `/\host` are out), carry no scheme and no control
 * characters, and stay a sane length; anything else yields `fallback`.
 */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback
  if (value.length === 0 || value.length > MAX_RETURN_TO_LENGTH) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}

/**
 * Merge a refresh answer into the session. Shopify's refresh response carries
 * no `id_token` (and may omit `refresh_token`), so those fall back to the
 * values from sign-in; the id token is still needed for the logout redirect.
 */
export function withRefreshedTokens(session: CustomerSession, next: TokenSet): CustomerSession {
  return {
    ...session,
    tokens: {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken ?? session.tokens.refreshToken,
      idToken: next.idToken ?? session.tokens.idToken,
      expiresAt: next.expiresAt,
    },
  }
}
