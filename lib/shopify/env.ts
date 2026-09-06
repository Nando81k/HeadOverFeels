import { z } from 'zod'

import { ShopifyError } from './errors'

/** Storefront API version this codebase is pinned to (see design spec §2 decision 8). */
export const SHOPIFY_API_VERSION = '2026-07' as const

export type ShopifyEnv = {
  storeDomain: string
  apiVersion: string
  privateToken: string
  publicToken: string
}

export type ShopifyAdminEnv = {
  storeDomain: string
  accessToken: string
}

const STOREFRONT_KEYS = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_STOREFRONT_API_VERSION',
  'SHOPIFY_STOREFRONT_PRIVATE_TOKEN',
  'NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN',
] as const

const ADMIN_KEYS = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'] as const

const required = z.string().min(1)

const storefrontSchema = z.object({
  SHOPIFY_STORE_DOMAIN: required,
  SHOPIFY_STOREFRONT_API_VERSION: required.default(SHOPIFY_API_VERSION),
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN: required,
  NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN: required,
})

const adminSchema = z.object({
  SHOPIFY_STORE_DOMAIN: required,
  SHOPIFY_ADMIN_ACCESS_TOKEN: required,
})

/**
 * Reads the given keys off `process.env`, trimming values and dropping blanks so
 * that an empty variable is reported as missing rather than as an invalid value.
 */
function readRaw(keys: readonly string[]): Record<string, string> {
  const raw: Record<string, string> = {}
  for (const key of keys) {
    const value = process.env[key]
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed.length > 0) raw[key] = trimmed
  }
  return raw
}

/** Turns a zod failure into ONE error naming every offending variable, in declaration order. */
function missingEnvError(
  keys: readonly string[],
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>
): ShopifyError {
  const offending = new Set(
    issues.map((issue) => String(issue.path[0] ?? '')).filter((name) => name.length > 0)
  )
  const names = keys.filter((key) => offending.has(key))
  return new ShopifyError(
    `Missing required Shopify environment variable${names.length === 1 ? '' : 's'}: ` +
      `${names.join(', ')}. Copy .env.shopify.example to .env.shopify and fill them in.`
  )
}

let storefrontCache: ShopifyEnv | null = null
let adminCache: ShopifyAdminEnv | null = null

/**
 * Validated Storefront API environment. Cached per process — call
 * `resetShopifyEnvCache()` (tests) after mutating `process.env`.
 *
 * Throws a single `ShopifyError` naming every missing variable.
 */
export function getShopifyEnv(): ShopifyEnv {
  if (storefrontCache) return storefrontCache

  const parsed = storefrontSchema.safeParse(readRaw(STOREFRONT_KEYS))
  if (!parsed.success) throw missingEnvError(STOREFRONT_KEYS, parsed.error.issues)

  storefrontCache = {
    storeDomain: parsed.data.SHOPIFY_STORE_DOMAIN,
    apiVersion: parsed.data.SHOPIFY_STOREFRONT_API_VERSION,
    privateToken: parsed.data.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
    publicToken: parsed.data.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN,
  }
  return storefrontCache
}

/**
 * Validated Admin API environment (scripts + server-side Admin calls). Requires
 * only the store domain and the Admin access token; the Storefront tokens are
 * irrelevant here so their absence is not an error.
 */
export function getShopifyAdminEnv(): ShopifyAdminEnv {
  if (adminCache) return adminCache

  const parsed = adminSchema.safeParse(readRaw(ADMIN_KEYS))
  if (!parsed.success) throw missingEnvError(ADMIN_KEYS, parsed.error.issues)

  adminCache = {
    storeDomain: parsed.data.SHOPIFY_STORE_DOMAIN,
    accessToken: parsed.data.SHOPIFY_ADMIN_ACCESS_TOKEN,
  }
  return adminCache
}

/** Test hook: forget the cached env so later `process.env` changes are picked up. */
export function resetShopifyEnvCache(): void {
  storefrontCache = null
  adminCache = null
}
