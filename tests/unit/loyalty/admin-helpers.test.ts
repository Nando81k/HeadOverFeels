// tests/unit/loyalty/admin-helpers.test.ts — lib/shopify/admin/{discounts,customers,webhooks}
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { adminRequest } = vi.hoisted(() => ({ adminRequest: vi.fn() }))

vi.mock('@/lib/shopify/admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/admin-client')>('@/lib/shopify/admin-client')
  return { ...actual, adminRequest }
})

import {
  buildBasicDiscountInput,
  buildFreeShippingInput,
  createCustomerDiscountCode,
  createFreeShippingCode,
  deleteDiscountCode,
  DISCOUNT_CODE_BASIC_CREATE_MUTATION,
  DISCOUNT_CODE_DELETE_MUTATION,
  DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION,
} from '@/lib/shopify/admin/discounts'
import {
  buildCustomerInput,
  createCustomer,
  CUSTOMER_BY_EMAIL_QUERY,
  CUSTOMER_CREATE_MUTATION,
  emailSearchQuery,
  findCustomerByEmail,
} from '@/lib/shopify/admin/customers'
import {
  createWebhook,
  listWebhooks,
  LOYALTY_WEBHOOK_TOPICS,
  WEBHOOK_SUBSCRIPTION_CREATE_MUTATION,
  WEBHOOK_SUBSCRIPTIONS_QUERY,
} from '@/lib/shopify/admin/webhooks'
import { ShopifyError } from '@/lib/shopify/errors'

const GID = 'gid://shopify/Customer/8125374129377'
const base = {
  title: 'Care Points · $5 Off · 8125374129377',
  code: 'HOF-DISC-K7M2P9',
  customerGid: GID,
  startsAt: '2026-10-11T00:00:00.000Z',
  endsAt: '2027-01-09T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('discount inputs', () => {
  it('builds the validated DiscountCodeBasicInput (context, not customerSelection)', () => {
    expect(buildBasicDiscountInput({ ...base, value: { amount: '5.00' } })).toEqual({
      title: base.title,
      code: base.code,
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      usageLimit: 1,
      appliesOncePerCustomer: true,
      context: { customers: { add: [GID] } },
      customerGets: { value: { discountAmount: { amount: '5.00', appliesOnEachItem: false } }, items: { all: true } },
    })
    expect(buildBasicDiscountInput({ ...base, value: { percentage: 0.15 } }).customerGets.value).toEqual({ percentage: 0.15 })
  })

  it('builds the validated DiscountCodeFreeShippingInput', () => {
    expect(buildFreeShippingInput(base)).toEqual({
      title: base.title,
      code: base.code,
      startsAt: base.startsAt,
      endsAt: base.endsAt,
      usageLimit: 1,
      appliesOncePerCustomer: true,
      context: { customers: { add: [GID] } },
      destination: { all: true },
    })
  })

  it('documents use the validated operation names and selection sets', () => {
    expect(DISCOUNT_CODE_BASIC_CREATE_MUTATION).toContain('discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount)')
    expect(DISCOUNT_CODE_BASIC_CREATE_MUTATION).toContain('... on DiscountCodeBasic { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer }')
    expect(DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION).toContain('discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount)')
    expect(DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION).toContain('... on DiscountCodeFreeShipping {')
    expect(DISCOUNT_CODE_DELETE_MUTATION).toContain('discountCodeDelete(id: $id) { deletedCodeDiscountId userErrors { field message } }')
  })
})

describe('createCustomerDiscountCode / createFreeShippingCode / deleteDiscountCode', () => {
  it('returns the node id, code and endsAt from the mutation payload', async () => {
    adminRequest.mockResolvedValue({
      discountCodeBasicCreate: {
        codeDiscountNode: { id: 'gid://shopify/DiscountCodeNode/1', codeDiscount: { title: base.title, codes: { nodes: [{ code: base.code }] }, startsAt: base.startsAt, endsAt: base.endsAt, usageLimit: 1, appliesOncePerCustomer: true } },
        userErrors: [],
      },
    })
    await expect(createCustomerDiscountCode({ ...base, value: { amount: '5.00' } })).resolves.toEqual({ discountId: 'gid://shopify/DiscountCodeNode/1', code: base.code, endsAt: base.endsAt })
    expect(adminRequest).toHaveBeenCalledWith(DISCOUNT_CODE_BASIC_CREATE_MUTATION, { basicCodeDiscount: buildBasicDiscountInput({ ...base, value: { amount: '5.00' } }) })
  })

  it('throws a ShopifyError carrying userErrors', async () => {
    adminRequest.mockResolvedValue({ discountCodeFreeShippingCreate: { codeDiscountNode: null, userErrors: [{ field: ['code'], message: 'Code has already been taken', code: 'TAKEN' }] } })
    await expect(createFreeShippingCode(base)).rejects.toMatchObject({ name: 'ShopifyError', userErrors: [{ message: 'Code has already been taken' }] })
    expect(adminRequest).toHaveBeenCalledWith(DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION, { freeShippingCodeDiscount: buildFreeShippingInput(base) })
  })

  it('throws when Shopify returns no node and deletes by id', async () => {
    adminRequest.mockResolvedValue({ discountCodeBasicCreate: { codeDiscountNode: null, userErrors: [] } })
    await expect(createCustomerDiscountCode({ ...base, value: { amount: '5.00' } })).rejects.toBeInstanceOf(ShopifyError)

    adminRequest.mockResolvedValue({ discountCodeDelete: { deletedCodeDiscountId: 'gid://shopify/DiscountCodeNode/1', userErrors: [] } })
    await expect(deleteDiscountCode('gid://shopify/DiscountCodeNode/1')).resolves.toBe('gid://shopify/DiscountCodeNode/1')
    expect(adminRequest).toHaveBeenLastCalledWith(DISCOUNT_CODE_DELETE_MUTATION, { id: 'gid://shopify/DiscountCodeNode/1' })
  })
})

describe('customers', () => {
  it('escapes the search query and matches the email exactly', async () => {
    expect(emailSearchQuery(' a"b@x.io ')).toBe('email:"a\\"b@x.io"')
    adminRequest.mockResolvedValue({ customers: { nodes: [{ id: GID, defaultEmailAddress: { emailAddress: 'Nando@Example.com' } }] } })
    await expect(findCustomerByEmail('nando@example.com')).resolves.toEqual({ id: GID, email: 'Nando@Example.com' })
    expect(adminRequest).toHaveBeenCalledWith(CUSTOMER_BY_EMAIL_QUERY, { query: 'email:"nando@example.com"' })
    await expect(findCustomerByEmail('other@example.com')).resolves.toBeNull()
  })

  it('creates a customer with marketing consent mapped from the newsletter flag', async () => {
    expect(buildCustomerInput({ email: 'n@x.io', firstName: 'N', lastName: null, emailMarketingConsent: true })).toEqual({
      email: 'n@x.io',
      firstName: 'N',
      emailMarketingConsent: { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' },
    })
    expect(buildCustomerInput({ email: 'n@x.io' }).emailMarketingConsent).toEqual({ marketingState: 'NOT_SUBSCRIBED' })

    adminRequest.mockResolvedValue({ customerCreate: { customer: { id: GID, defaultEmailAddress: { emailAddress: 'n@x.io' } }, userErrors: [] } })
    await expect(createCustomer({ email: 'n@x.io' })).resolves.toEqual({ id: GID, email: 'n@x.io' })
    expect(adminRequest).toHaveBeenCalledWith(CUSTOMER_CREATE_MUTATION, { input: buildCustomerInput({ email: 'n@x.io' }) })

    adminRequest.mockResolvedValue({ customerCreate: { customer: null, userErrors: [{ field: ['email'], message: 'Email has already been taken' }] } })
    await expect(createCustomer({ email: 'n@x.io' })).rejects.toMatchObject({ name: 'ShopifyError' })
  })
})

describe('webhooks', () => {
  it('lists subscriptions with uri and creates JSON subscriptions by topic', async () => {
    expect(LOYALTY_WEBHOOK_TOPICS).toEqual(['ORDERS_PAID', 'ORDERS_CANCELLED', 'REFUNDS_CREATE', 'CUSTOMERS_UPDATE'])
    expect(WEBHOOK_SUBSCRIPTIONS_QUERY).toContain('webhookSubscriptions(first: 25) { nodes { id topic uri } }')
    expect(WEBHOOK_SUBSCRIPTION_CREATE_MUTATION).toContain('webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription)')

    adminRequest.mockResolvedValue({ webhookSubscriptions: { nodes: [{ id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_PAID', uri: 'https://x/api/webhooks/shopify' }] } })
    await expect(listWebhooks()).resolves.toEqual([{ id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_PAID', uri: 'https://x/api/webhooks/shopify' }])

    adminRequest.mockResolvedValue({ webhookSubscriptionCreate: { webhookSubscription: { id: 'gid://shopify/WebhookSubscription/2', topic: 'ORDERS_CANCELLED', uri: 'https://x/api/webhooks/shopify' }, userErrors: [] } })
    await expect(createWebhook({ topic: 'ORDERS_CANCELLED', uri: 'https://x/api/webhooks/shopify' })).resolves.toMatchObject({ topic: 'ORDERS_CANCELLED' })
    expect(adminRequest).toHaveBeenLastCalledWith(WEBHOOK_SUBSCRIPTION_CREATE_MUTATION, { topic: 'ORDERS_CANCELLED', webhookSubscription: { uri: 'https://x/api/webhooks/shopify', format: 'JSON' } })

    adminRequest.mockResolvedValue({ webhookSubscriptionCreate: { webhookSubscription: null, userErrors: [{ field: ['uri'], message: 'Address is invalid' }] } })
    await expect(createWebhook({ topic: 'ORDERS_PAID', uri: 'nope' })).rejects.toBeInstanceOf(ShopifyError)
  })
})
