// tests/unit/shopify/env.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  SHOPIFY_API_VERSION,
  getShopifyAdminEnv,
  getShopifyEnv,
  resetShopifyEnvCache,
} from '@/lib/shopify/env'

const KEYS = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_STOREFRONT_API_VERSION',
  'SHOPIFY_STOREFRONT_PRIVATE_TOKEN',
  'NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
] as const

const snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function clearShopifyEnv() {
  for (const key of KEYS) delete process.env[key]
}

function setStorefrontEnv() {
  process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
  process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = 'private-token'
  process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN = 'public-token'
}

beforeEach(() => {
  for (const key of KEYS) snapshot[key] = process.env[key]
  clearShopifyEnv()
  resetShopifyEnvCache()
})

afterEach(() => {
  for (const key of KEYS) {
    const value = snapshot[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetShopifyEnvCache()
})

describe('SHOPIFY_API_VERSION', () => {
  it('is pinned to 2026-07', () => {
    expect(SHOPIFY_API_VERSION).toBe('2026-07')
  })
})

describe('getShopifyEnv', () => {
  it('throws a single error naming every missing variable when none are set', () => {
    let thrown: unknown
    try {
      getShopifyEnv()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(Error)
    const message = (thrown as Error).message
    expect(message).toContain('SHOPIFY_STORE_DOMAIN')
    expect(message).toContain('SHOPIFY_STOREFRONT_PRIVATE_TOKEN')
    expect(message).toContain('NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN')
    // the API version has a default, so it is never "missing"
    expect(message).not.toContain('SHOPIFY_STOREFRONT_API_VERSION')
  })

  it('names only the variables that are actually missing', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'

    expect(() => getShopifyEnv()).toThrow(/SHOPIFY_STOREFRONT_PRIVATE_TOKEN/)
    expect(() => getShopifyEnv()).toThrow(/NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN/)
    expect(() => getShopifyEnv()).not.toThrow(/SHOPIFY_STORE_DOMAIN/)
  })

  it('treats an empty or whitespace-only value as missing', () => {
    setStorefrontEnv()
    process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = '   '

    expect(() => getShopifyEnv()).toThrow(/SHOPIFY_STOREFRONT_PRIVATE_TOKEN/)
  })

  it('returns the parsed env and defaults apiVersion to 2026-07', () => {
    setStorefrontEnv()

    expect(getShopifyEnv()).toEqual({
      storeDomain: 'tgqucm-qg.myshopify.com',
      apiVersion: '2026-07',
      privateToken: 'private-token',
      publicToken: 'public-token',
    })
  })

  it('honours SHOPIFY_STOREFRONT_API_VERSION when set', () => {
    setStorefrontEnv()
    process.env.SHOPIFY_STOREFRONT_API_VERSION = '2026-10'

    expect(getShopifyEnv().apiVersion).toBe('2026-10')
  })

  it('caches the parsed env per process until the cache is reset', () => {
    setStorefrontEnv()
    const first = getShopifyEnv()

    process.env.SHOPIFY_STORE_DOMAIN = 'changed.myshopify.com'
    expect(getShopifyEnv()).toBe(first)

    resetShopifyEnvCache()
    expect(getShopifyEnv().storeDomain).toBe('changed.myshopify.com')
  })
})

describe('getShopifyAdminEnv', () => {
  it('only requires SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'admin-token'

    expect(getShopifyAdminEnv()).toEqual({
      storeDomain: 'tgqucm-qg.myshopify.com',
      accessToken: 'admin-token',
    })
    // storefront tokens are absent and that is fine
    expect(() => getShopifyEnv()).toThrow()
  })

  it('throws one error naming every missing admin variable', () => {
    let thrown: unknown
    try {
      getShopifyAdminEnv()
    } catch (error) {
      thrown = error
    }

    const message = (thrown as Error).message
    expect(message).toContain('SHOPIFY_STORE_DOMAIN')
    expect(message).toContain('SHOPIFY_ADMIN_ACCESS_TOKEN')
  })

  it('caches independently of the storefront env and honours the reset', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'admin-token'
    const first = getShopifyAdminEnv()

    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'rotated-token'
    expect(getShopifyAdminEnv()).toBe(first)

    resetShopifyEnvCache()
    expect(getShopifyAdminEnv().accessToken).toBe('rotated-token')
  })
})
