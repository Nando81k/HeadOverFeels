// tests/unit/scripts/shopify-register-webhooks.test.ts
import { describe, it, expect, vi } from 'vitest'

import {
  WEBHOOK_LIST_QUERY,
  WEBHOOK_PATH,
  WEBHOOK_SUBSCRIBE_MUTATION,
  WEBHOOK_TOPICS,
  buildWebhookUri,
  planWebhooks,
  registerWebhooks,
  toSubscribeVariables,
  wantedSubscriptions,
  type WebhookListResponse,
  type WebhookSubscribeResponse,
} from '@/scripts/shopify/lib/register-webhooks'

const URI = 'https://hof-preview.vercel.app/api/webhooks/shopify'

describe('GraphQL documents', () => {
  it('match the validated Admin documents verbatim', () => {
    expect(WEBHOOK_SUBSCRIBE_MUTATION).toBe(
      'mutation WebhookSubscribe($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) { webhookSubscription { id topic uri } userErrors { field message } } }'
    )
    expect(WEBHOOK_LIST_QUERY).toBe(
      'query WebhookList { webhookSubscriptions(first: 25) { nodes { id topic uri } } }'
    )
  })

  it('subscribes the four loyalty topics', () => {
    expect([...WEBHOOK_TOPICS]).toEqual(['ORDERS_PAID', 'ORDERS_CANCELLED', 'REFUNDS_CREATE', 'CUSTOMERS_UPDATE'])
    expect(WEBHOOK_PATH).toBe('/api/webhooks/shopify')
  })
})

describe('buildWebhookUri', () => {
  it('appends the webhook path to an https origin, dropping trailing slashes', () => {
    expect(buildWebhookUri('https://hof-preview.vercel.app')).toBe(URI)
    expect(buildWebhookUri('https://hof-preview.vercel.app/')).toBe(URI)
    expect(buildWebhookUri(' https://hof-preview.vercel.app ')).toBe(URI)
  })
  it('refuses http, localhost and paths', () => {
    expect(() => buildWebhookUri('http://hof-preview.vercel.app')).toThrow(/https/)
    expect(() => buildWebhookUri('https://localhost:3000')).toThrow(/localhost/)
    expect(() => buildWebhookUri('https://hof.example/app')).toThrow(/origin/)
    expect(() => buildWebhookUri('')).toThrow(/base-url/)
    expect(() => buildWebhookUri('nope')).toThrow(/https/)
  })
})

describe('wantedSubscriptions + toSubscribeVariables', () => {
  it('pairs every topic with the same uri', () => {
    expect(wantedSubscriptions('https://hof-preview.vercel.app')).toEqual(
      WEBHOOK_TOPICS.map((topic) => ({ topic, uri: URI }))
    )
  })
  it('builds the JSON subscription input', () => {
    expect(toSubscribeVariables({ topic: 'ORDERS_PAID', uri: URI })).toEqual({
      topic: 'ORDERS_PAID',
      webhookSubscription: { uri: URI, format: 'JSON' },
    })
  })
})

describe('planWebhooks', () => {
  const wanted = wantedSubscriptions('https://hof-preview.vercel.app')

  it('creates everything on an empty store', () => {
    const plan = planWebhooks([], wanted)
    expect(plan.create).toEqual(wanted)
    expect(plan.existing).toEqual([])
    expect(plan.foreign).toEqual([])
  })

  it('is idempotent: an exact (topic, uri) match is skipped', () => {
    const existing = [
      { id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_PAID', uri: URI },
      { id: 'gid://shopify/WebhookSubscription/2', topic: 'CUSTOMERS_UPDATE', uri: URI },
    ]
    const plan = planWebhooks(existing, wanted)
    expect(plan.create.map((w) => w.topic)).toEqual(['ORDERS_CANCELLED', 'REFUNDS_CREATE'])
    expect(plan.existing).toEqual(existing)
  })

  it('a fully registered store yields an empty create list', () => {
    const existing = wanted.map((w, i) => ({ id: `gid://shopify/WebhookSubscription/${i}`, ...w }))
    expect(planWebhooks(existing, wanted).create).toEqual([])
  })

  it('a same-topic subscription at another uri is reported, not reused', () => {
    const other = { id: 'gid://shopify/WebhookSubscription/7', topic: 'ORDERS_PAID', uri: 'https://old.example/api/webhooks/shopify' }
    const plan = planWebhooks([other], wanted)
    expect(plan.create.map((w) => w.topic)).toContain('ORDERS_PAID')
    expect(plan.foreign).toEqual([other])
  })

  it('ignores unrelated topics', () => {
    const unrelated = { id: 'gid://shopify/WebhookSubscription/8', topic: 'PRODUCTS_UPDATE', uri: URI }
    const plan = planWebhooks([unrelated], wanted)
    expect(plan.create).toEqual(wanted)
    expect(plan.foreign).toEqual([])
    expect(plan.existing).toEqual([])
  })
})

/** `adminRequest` double answering by document. */
function makeRequest(existing: WebhookListResponse['webhookSubscriptions']['nodes'], create?: (v: Record<string, unknown>) => WebhookSubscribeResponse) {
  return vi.fn(async (query: string, variables?: Record<string, unknown>) => {
    if (query === WEBHOOK_LIST_QUERY) return { webhookSubscriptions: { nodes: existing } }
    if (query === WEBHOOK_SUBSCRIBE_MUTATION) {
      if (!create) throw new Error('unexpected mutation')
      return create(variables ?? {})
    }
    throw new Error('unexpected document')
  }) as unknown as <T>(query: string, variables?: Record<string, unknown>) => Promise<T>
}
const calls = (request: unknown) => (request as ReturnType<typeof vi.fn>).mock.calls as [string, Record<string, unknown>?][]

describe('registerWebhooks', () => {
  it('dry run lists existing subscriptions and performs no mutation', async () => {
    const request = makeRequest([{ id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_PAID', uri: URI }])
    const result = await registerWebhooks({ request, baseUrl: 'https://hof-preview.vercel.app', apply: false })
    expect(result.plan.create.map((w) => w.topic)).toEqual(['ORDERS_CANCELLED', 'REFUNDS_CREATE', 'CUSTOMERS_UPDATE'])
    expect(result.created).toEqual([])
    expect(result.errors).toEqual([])
    expect(calls(request).map(([q]) => q)).toEqual([WEBHOOK_LIST_QUERY])
  })

  it('apply creates only the missing (topic, uri) pairs', async () => {
    let n = 10
    const request = makeRequest(
      [{ id: 'gid://shopify/WebhookSubscription/1', topic: 'ORDERS_PAID', uri: URI }],
      (v) => {
        n += 1
        const sub = v.webhookSubscription as { uri: string }
        return { webhookSubscriptionCreate: { webhookSubscription: { id: `gid://shopify/WebhookSubscription/${n}`, topic: String(v.topic), uri: sub.uri }, userErrors: [] } }
      }
    )
    const result = await registerWebhooks({ request, baseUrl: 'https://hof-preview.vercel.app', apply: true })
    const mutations = calls(request).filter(([q]) => q === WEBHOOK_SUBSCRIBE_MUTATION)
    expect(mutations.map(([, v]) => v)).toEqual([
      toSubscribeVariables({ topic: 'ORDERS_CANCELLED', uri: URI }),
      toSubscribeVariables({ topic: 'REFUNDS_CREATE', uri: URI }),
      toSubscribeVariables({ topic: 'CUSTOMERS_UPDATE', uri: URI }),
    ])
    expect(result.created.map((c) => c.topic)).toEqual(['ORDERS_CANCELLED', 'REFUNDS_CREATE', 'CUSTOMERS_UPDATE'])
    expect(result.errors).toEqual([])
  })

  it('a second apply on a fully registered store creates nothing', async () => {
    const existing = wantedSubscriptions('https://hof-preview.vercel.app').map((w, i) => ({ id: `gid://shopify/WebhookSubscription/${i}`, ...w }))
    const request = makeRequest(existing)
    const result = await registerWebhooks({ request, baseUrl: 'https://hof-preview.vercel.app', apply: true })
    expect(result.plan.create).toEqual([])
    expect(result.created).toEqual([])
    expect(calls(request).map(([q]) => q)).toEqual([WEBHOOK_LIST_QUERY])
  })

  it('collects userErrors per topic and continues with the rest', async () => {
    const request = makeRequest([], (v) =>
      v.topic === 'REFUNDS_CREATE'
        ? { webhookSubscriptionCreate: { webhookSubscription: null, userErrors: [{ field: ['topic'], message: 'Access denied for refunds' }] } }
        : { webhookSubscriptionCreate: { webhookSubscription: { id: 'gid://shopify/WebhookSubscription/1', topic: String(v.topic), uri: URI }, userErrors: [] } }
    )
    const result = await registerWebhooks({ request, baseUrl: 'https://hof-preview.vercel.app', apply: true })
    expect(result.errors).toEqual([{ topic: 'REFUNDS_CREATE', uri: URI, message: 'topic: Access denied for refunds' }])
    expect(result.created.map((c) => c.topic)).toEqual(['ORDERS_PAID', 'ORDERS_CANCELLED', 'CUSTOMERS_UPDATE'])
  })

  it('rejects an invalid base url before touching the store', async () => {
    const request = makeRequest([])
    await expect(registerWebhooks({ request, baseUrl: 'http://localhost:3000', apply: true })).rejects.toThrow(/https/)
    expect(calls(request)).toHaveLength(0)
  })
})
