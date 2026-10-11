import 'server-only'

import { z } from 'zod'

import { ShopifyError } from '../errors'

/**
 * Customer Account API environment (Phase 4 plan, "Shared contracts").
 *
 * - `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID`:
 *   the public (PKCE) client of the Headless storefront.
 * - `NEXT_PUBLIC_BASE_URL`: the storefront origin registered as the callback
 *   / JavaScript origin; also sent as `Origin` on token requests.
 * - `SHOPIFY_STORE_DOMAIN`: discovery issuer `https://<domain>` by default.
 * - `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER` (tests only): overrides discovery so the
 *   Playwright mock can stand in for Shopify.
 * - `CUSTOMER_SESSION_SECRET` (fallback `AUTH_SECRET`): the `hof_customer`
 *   cookie encryption secret (see `session.ts`).
 *
 * Nothing here is cached: the values are read on every call so tests (and the
 * e2e runner) can flip `process.env` without a reset hook.
 */

export type CustomerAccountEnv = {
  storeDomain: string
  clientId: string
  shopId: string
  baseUrl: string
  issuerOverride: string | null
}

const REQUIRED_KEYS = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID',
  'NEXT_PUBLIC_BASE_URL',
] as const

const AVAILABILITY_KEYS = [
  'SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID',
  'NEXT_PUBLIC_BASE_URL',
] as const

const required = z.string().min(1)

const schema = z.object({
  SHOPIFY_STORE_DOMAIN: required,
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: required,
  SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: required,
  NEXT_PUBLIC_BASE_URL: required,
  SHOPIFY_CUSTOMER_ACCOUNT_ISSUER: required.optional(),
})

/** Trimmed, non-blank values only, so an empty variable reads as missing. */
function readRaw(keys: readonly string[]): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const key of keys) {
    const value = process.env[key]
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed.length > 0) raw[key] = trimmed
  }
  return raw
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/** Throws a single `ShopifyError` naming every missing variable, in declaration order. */
export function getCustomerAccountEnv(): CustomerAccountEnv {
  const parsed = schema.safeParse(readRaw([...REQUIRED_KEYS, 'SHOPIFY_CUSTOMER_ACCOUNT_ISSUER']))
  if (!parsed.success) {
    const offending = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')))
    const names = REQUIRED_KEYS.filter((key) => offending.has(key))
    throw new ShopifyError(
      `Missing required Customer Account environment variable${names.length === 1 ? '' : 's'}: ` +
        `${names.join(', ')}. See .env.shopify.example.`
    )
  }

  return {
    storeDomain: parsed.data.SHOPIFY_STORE_DOMAIN,
    clientId: parsed.data.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
    shopId: parsed.data.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID,
    baseUrl: stripTrailingSlash(parsed.data.NEXT_PUBLIC_BASE_URL),
    issuerOverride: parsed.data.SHOPIFY_CUSTOMER_ACCOUNT_ISSUER
      ? stripTrailingSlash(parsed.data.SHOPIFY_CUSTOMER_ACCOUNT_ISSUER)
      : null,
  }
}

/**
 * True when sign-in can be offered (client id + shop id + base url are
 * non-blank). Never throws; with `false` the login route redirects to the
 * "Sign-in is being set up" state, `getCustomerSession()` returns `null` and
 * every account action answers `Accounts unavailable` (plan, note 5).
 */
export function hasCustomerAccountEnv(): boolean {
  const raw = readRaw(AVAILABILITY_KEYS)
  return AVAILABILITY_KEYS.every((key) => Boolean(raw[key]))
}

/** The cookie secret: `CUSTOMER_SESSION_SECRET`, else `AUTH_SECRET`. Throws when neither is set. */
export function getCustomerSessionSecret(): string {
  const raw = readRaw(['CUSTOMER_SESSION_SECRET', 'AUTH_SECRET'])
  const secret = raw.CUSTOMER_SESSION_SECRET ?? raw.AUTH_SECRET
  if (!secret) {
    throw new ShopifyError(
      'Missing customer session secret: set CUSTOMER_SESSION_SECRET (or AUTH_SECRET). See .env.shopify.example.'
    )
  }
  return secret
}
