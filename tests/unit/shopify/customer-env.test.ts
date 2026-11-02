// tests/unit/shopify/customer-env.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  getCustomerAccountEnv,
  getCustomerSessionSecret,
  hasCustomerAccountEnv,
} from '@/lib/shopify/customer/env'
import { hasShopifyAdminEnv, resetShopifyEnvCache } from '@/lib/shopify/env'
import { ShopifyError } from '@/lib/shopify/errors'

const KEYS = [
  'SHOPIFY_STORE_DOMAIN',
  'SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID',
  'SHOPIFY_CUSTOMER_ACCOUNT_ISSUER',
  'NEXT_PUBLIC_BASE_URL',
  'CUSTOMER_SESSION_SECRET',
  'AUTH_SECRET',
  'SHOPIFY_ADMIN_ACCESS_TOKEN',
] as const

const snapshot: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function setAll() {
  process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID = 'shp_client'
  process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID = '85215183073'
  process.env.NEXT_PUBLIC_BASE_URL = 'https://hof-preview.vercel.app/'
}

beforeEach(() => {
  for (const key of KEYS) {
    snapshot[key] = process.env[key]
    delete process.env[key]
  }
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

describe('getCustomerAccountEnv', () => {
  it('returns the validated env with the base url trailing slash stripped and no issuer override', () => {
    setAll()
    expect(getCustomerAccountEnv()).toEqual({
      storeDomain: 'tgqucm-qg.myshopify.com',
      clientId: 'shp_client',
      shopId: '85215183073',
      baseUrl: 'https://hof-preview.vercel.app',
      issuerOverride: null,
    })
  })

  it('exposes SHOPIFY_CUSTOMER_ACCOUNT_ISSUER as issuerOverride without a trailing slash', () => {
    setAll()
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_ISSUER = 'http://127.0.0.1:4443/customer/'
    expect(getCustomerAccountEnv().issuerOverride).toBe('http://127.0.0.1:4443/customer')
  })

  it('throws one ShopifyError naming every missing variable', () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID = '   '
    let thrown: unknown
    try {
      getCustomerAccountEnv()
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ShopifyError)
    const message = (thrown as Error).message
    expect(message).toContain('SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID')
    expect(message).toContain('SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID')
    expect(message).toContain('NEXT_PUBLIC_BASE_URL')
    expect(message).not.toContain('SHOPIFY_STORE_DOMAIN')
  })
})

describe('hasCustomerAccountEnv', () => {
  it('is true only when client id, shop id and base url are all non-blank', () => {
    expect(hasCustomerAccountEnv()).toBe(false)
    setAll()
    expect(hasCustomerAccountEnv()).toBe(true)
    process.env.NEXT_PUBLIC_BASE_URL = ''
    expect(hasCustomerAccountEnv()).toBe(false)
  })

  it('never throws', () => {
    process.env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID = 'x'
    expect(() => hasCustomerAccountEnv()).not.toThrow()
    expect(hasCustomerAccountEnv()).toBe(false)
  })
})

describe('getCustomerSessionSecret', () => {
  it('prefers CUSTOMER_SESSION_SECRET and falls back to AUTH_SECRET', () => {
    process.env.AUTH_SECRET = 'auth'
    expect(getCustomerSessionSecret()).toBe('auth')
    process.env.CUSTOMER_SESSION_SECRET = 'customer'
    expect(getCustomerSessionSecret()).toBe('customer')
  })

  it('throws a ShopifyError naming both variables when neither is set', () => {
    expect(() => getCustomerSessionSecret()).toThrow(ShopifyError)
    expect(() => getCustomerSessionSecret()).toThrow(/CUSTOMER_SESSION_SECRET/)
    expect(() => getCustomerSessionSecret()).toThrow(/AUTH_SECRET/)
  })
})

describe('hasShopifyAdminEnv', () => {
  it('is true only when the store domain and the Admin token are non-blank', () => {
    expect(hasShopifyAdminEnv()).toBe(false)
    process.env.SHOPIFY_STORE_DOMAIN = 'tgqucm-qg.myshopify.com'
    expect(hasShopifyAdminEnv()).toBe(false)
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'shpat_x'
    expect(hasShopifyAdminEnv()).toBe(true)
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = ' '
    expect(hasShopifyAdminEnv()).toBe(false)
  })
})
