/**
 * Admin API webhook-subscription helpers (Phase 4, Task 2); the registration
 * script (Task 3) drives them. `uri` is the current field (`endpoint` is deprecated).
 *
 * Documents validated 2026-10-11 (Admin 2026-07, Shopify MCP):
 *   query LoyaltyWebhookSubscriptions { webhookSubscriptions(first: 25) { nodes { id topic uri } } }
 *   mutation LoyaltyWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) { webhookSubscription { id topic uri } userErrors { field message } } }
 * `WebhookSubscriptionInput` fields used: uri, format (JSON).
 */
import { adminRequest, assertNoUserErrors } from '../admin-client'
import { ShopifyError } from '../errors'

export const WEBHOOK_SUBSCRIPTIONS_QUERY = `query LoyaltyWebhookSubscriptions { webhookSubscriptions(first: 25) { nodes { id topic uri } } }`

export const WEBHOOK_SUBSCRIPTION_CREATE_MUTATION = `mutation LoyaltyWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) { webhookSubscription { id topic uri } userErrors { field message } } }`

/** The topics the loyalty webhook route handles. */
export const LOYALTY_WEBHOOK_TOPICS = [
  'ORDERS_PAID',
  'ORDERS_CANCELLED',
  'REFUNDS_CREATE',
  'CUSTOMERS_UPDATE',
] as const

export type WebhookTopic = (typeof LOYALTY_WEBHOOK_TOPICS)[number]

export type WebhookSubscription = { id: string; topic: string; uri: string }

type ListData = { webhookSubscriptions: { nodes: WebhookSubscription[] } }
type CreateData = { webhookSubscriptionCreate: { webhookSubscription: WebhookSubscription | null } }

export async function listWebhooks(): Promise<WebhookSubscription[]> {
  const data = await adminRequest<ListData>(WEBHOOK_SUBSCRIPTIONS_QUERY)
  return data.webhookSubscriptions.nodes
}

export async function createWebhook(input: {
  topic: WebhookTopic
  uri: string
}): Promise<WebhookSubscription> {
  const data = await adminRequest<CreateData>(WEBHOOK_SUBSCRIPTION_CREATE_MUTATION, {
    topic: input.topic,
    webhookSubscription: { uri: input.uri, format: 'JSON' },
  })
  assertNoUserErrors(data, 'webhookSubscriptionCreate')
  const subscription = data.webhookSubscriptionCreate.webhookSubscription
  if (!subscription) throw new ShopifyError('webhookSubscriptionCreate returned no subscription')
  return subscription
}
