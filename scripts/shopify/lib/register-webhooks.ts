/**
 * Pure helpers for scripts/shopify/register-webhooks.ts (Phase 4, Task 3).
 *
 * Subscribes the loyalty webhooks (`orders/paid`, `orders/cancelled`, `refunds/create`,
 * `customers/update`) to `<base>/api/webhooks/shopify` (JSON). Idempotent by (topic, uri):
 * the store's subscriptions are listed first and only the missing pairs are created. The
 * `adminRequest` call is injected so the plan and the apply loop are unit-testable.
 *
 * Admin API 2026-07. Both documents were validated with the Shopify MCP on 2026-10-11 and
 * must be copied verbatim (the tests pin them). Webhooks created through the API by an
 * admin-created custom app are signed with that app's API secret key (SHOPIFY_WEBHOOK_SECRET).
 */

// ---------------------------------------------------------------------------
// GraphQL documents (validated — do not reformat)
// ---------------------------------------------------------------------------

export const WEBHOOK_SUBSCRIBE_MUTATION =
  'mutation WebhookSubscribe($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) { webhookSubscription { id topic uri } userErrors { field message } } }'

export const WEBHOOK_LIST_QUERY =
  'query WebhookList { webhookSubscriptions(first: 25) { nodes { id topic uri } } }'

// ---------------------------------------------------------------------------
// Constants + types
// ---------------------------------------------------------------------------

/** `WebhookSubscriptionTopic` values the loyalty bridge handles (app/api/webhooks/shopify). */
export const WEBHOOK_TOPICS = [
  'ORDERS_PAID',
  'ORDERS_CANCELLED',
  'REFUNDS_CREATE',
  'CUSTOMERS_UPDATE',
] as const

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number]

export const WEBHOOK_PATH = '/api/webhooks/shopify'

export interface WantedSubscription {
  topic: WebhookTopic
  uri: string
}

export interface ExistingSubscription {
  id: string
  topic: string
  uri: string
}

export interface WebhookListResponse {
  webhookSubscriptions: { nodes: ExistingSubscription[] }
}

export interface WebhookSubscribeResponse {
  webhookSubscriptionCreate: {
    webhookSubscription: ExistingSubscription | null
    userErrors: { field?: string[] | null; message: string }[]
  }
}

export interface WebhookPlan {
  /** Wanted pairs with no exact (topic, uri) match — created on `--apply`. */
  create: WantedSubscription[]
  /** Exact matches already on the store — left alone. */
  existing: ExistingSubscription[]
  /** Same topic, different uri (an older deploy's endpoint) — reported, never deleted here. */
  foreign: ExistingSubscription[]
}

export interface WebhookError {
  topic: WebhookTopic
  uri: string
  message: string
}

export interface RegisterWebhooksResult {
  uri: string
  plan: WebhookPlan
  created: ExistingSubscription[]
  errors: WebhookError[]
}

/** Same shape as `adminRequest` from `lib/shopify/admin-client`. */
export type AdminRequestFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * `https://<host>` (+ optional port) → `https://<host>/api/webhooks/shopify`. Shopify only
 * delivers to public https endpoints, so http://, localhost and any path are refused.
 */
export function buildWebhookUri(baseUrl: string): string {
  const trimmed = (baseUrl ?? '').trim()
  if (!trimmed) throw new Error('--base-url (or NEXT_PUBLIC_BASE_URL) is required')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`base url must be an https origin, got "${trimmed}"`)
  }
  if (url.protocol !== 'https:') throw new Error(`base url must use https (Shopify refuses ${url.protocol}//)`)
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1') {
    throw new Error('base url cannot be localhost — Shopify cannot reach it (use the Vercel preview URL)')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`base url must be a bare origin (no path/query), got "${trimmed}"`)
  }
  return `${url.origin}${WEBHOOK_PATH}`
}

export function wantedSubscriptions(baseUrl: string): WantedSubscription[] {
  const uri = buildWebhookUri(baseUrl)
  return WEBHOOK_TOPICS.map((topic) => ({ topic, uri }))
}

/** Variables for `WebhookSubscribe`. */
export function toSubscribeVariables(wanted: WantedSubscription): Record<string, unknown> {
  return { topic: wanted.topic, webhookSubscription: { uri: wanted.uri, format: 'JSON' } }
}

/** Diff of the store's subscriptions against the wanted set, keyed by (topic, uri). */
export function planWebhooks(
  existing: ExistingSubscription[],
  wanted: WantedSubscription[]
): WebhookPlan {
  const wantedTopics = new Set<string>(wanted.map((item) => item.topic))
  const key = (item: { topic: string; uri: string }): string => `${item.topic}\u0000${item.uri}`
  const existingKeys = new Set(existing.map(key))
  const wantedKeys = new Set(wanted.map(key))

  return {
    create: wanted.filter((item) => !existingKeys.has(key(item))),
    existing: existing.filter((item) => wantedKeys.has(key(item))),
    foreign: existing.filter((item) => wantedTopics.has(item.topic) && !wantedKeys.has(key(item))),
  }
}

function formatUserErrors(errors: { field?: string[] | null; message: string }[]): string {
  return errors
    .map((error) => (error.field?.length ? `${error.field.join('.')}: ${error.message}` : error.message))
    .join('; ')
}

// ---------------------------------------------------------------------------
// Orchestration (I/O injected)
// ---------------------------------------------------------------------------

export interface RegisterWebhooksOptions {
  request: AdminRequestFn
  baseUrl: string
  /** `false` = dry run: list + plan only. */
  apply: boolean
}

/** Lists the store's subscriptions, plans the diff and (on apply) creates the missing pairs. */
export async function registerWebhooks(options: RegisterWebhooksOptions): Promise<RegisterWebhooksResult> {
  const { request, apply } = options
  const wanted = wantedSubscriptions(options.baseUrl)
  const uri = wanted[0].uri

  const list = await request<WebhookListResponse>(WEBHOOK_LIST_QUERY)
  const plan = planWebhooks(list.webhookSubscriptions?.nodes ?? [], wanted)

  const created: ExistingSubscription[] = []
  const errors: WebhookError[] = []
  if (!apply) return { uri, plan, created, errors }

  for (const item of plan.create) {
    const data = await request<WebhookSubscribeResponse>(
      WEBHOOK_SUBSCRIBE_MUTATION,
      toSubscribeVariables(item)
    )
    const userErrors = data.webhookSubscriptionCreate?.userErrors ?? []
    const subscription = data.webhookSubscriptionCreate?.webhookSubscription ?? null
    if (userErrors.length > 0 || !subscription) {
      errors.push({
        topic: item.topic,
        uri: item.uri,
        message: userErrors.length > 0 ? formatUserErrors(userErrors) : 'no subscription returned',
      })
      continue
    }
    created.push(subscription)
  }

  return { uri, plan, created, errors }
}
