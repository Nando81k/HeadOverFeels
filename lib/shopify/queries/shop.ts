import { storefrontFetch } from '../client'
import { getShopifyEnv } from '../env'
import type { MenuItem, Policy, ShopLayoutData } from '../types'
import { CATALOG_REVALIDATE } from './fragments'

export const SHOP_LAYOUT_QUERY = `query ShopLayout {
  shop {
    name
    description
    primaryDomain { url }
    privacyPolicy { handle title }
    termsOfService { handle title }
    refundPolicy { handle title }
    shippingPolicy { handle title }
  }
  menu(handle: "main-menu") {
    items { id title url type resourceId items { id title url type resourceId } }
  }
}`

export const POLICIES_QUERY = `query Policies {
  shop {
    privacyPolicy { handle title body }
    termsOfService { handle title body }
    refundPolicy { handle title body }
    shippingPolicy { handle title body }
  }
}`

// ---------------------------------------------------------------- raw shapes

export type RawMenuItem = {
  id: string
  title: string
  url: string | null
  type?: string | null
  resourceId?: string | null
  items?: RawMenuItem[] | null
}

type RawPolicyRef = { handle: string; title: string } | null
type RawPolicyBody = { handle: string; title: string; body: string } | null

export type RawShopLayout = {
  shop: {
    name: string
    description: string | null
    primaryDomain: { url: string } | null
    privacyPolicy: RawPolicyRef
    termsOfService: RawPolicyRef
    refundPolicy: RawPolicyRef
    shippingPolicy: RawPolicyRef
  } | null
  menu: { items: RawMenuItem[] } | null
}

export type RawPolicies = {
  shop: {
    privacyPolicy: RawPolicyBody
    termsOfService: RawPolicyBody
    refundPolicy: RawPolicyBody
    shippingPolicy: RawPolicyBody
  } | null
}

export type MenuDomains = { storeDomain: string; primaryDomain: string | null }

// ---------------------------------------------------------------- normalisers

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null
  const candidate = value.includes('://') ? value : `https://${value}`
  try {
    return new URL(candidate).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Storefront menu items carry ABSOLUTE urls on the shop's own domain
 * (`https://tgqucm-qg.myshopify.com/collections/all`). Those become relative
 * paths so Next can route them; anything on another host is left alone.
 */
function toRelativeUrl(url: string | null | undefined, hosts: Set<string>): string {
  if (!url) return '/'
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url // already relative
  }
  if (!hosts.has(parsed.host.toLowerCase())) return url
  return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
}

export function normalizeMenu(
  items: RawMenuItem[] | null | undefined,
  domains: MenuDomains
): MenuItem[] {
  const hosts = new Set<string>()
  for (const host of [hostOf(domains.storeDomain), hostOf(domains.primaryDomain)]) {
    if (host) hosts.add(host)
  }

  // Shopify menus are two levels deep in this design; grandchildren are dropped.
  return (items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    url: toRelativeUrl(item.url, hosts),
    items: (item.items ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      url: toRelativeUrl(child.url, hosts),
      items: [],
    })),
  }))
}

/** Policies in the order the footer renders them; unpublished ones are skipped. */
function toPolicyRefs(shop: RawShopLayout['shop']): { handle: string; title: string }[] {
  const ordered = [shop?.privacyPolicy, shop?.termsOfService, shop?.refundPolicy, shop?.shippingPolicy]
  return ordered.flatMap((policy) => (policy ? [{ handle: policy.handle, title: policy.title }] : []))
}

export function normalizeShopLayout(raw: RawShopLayout, storeDomain: string): ShopLayoutData {
  const shop = raw.shop
  return {
    name: shop?.name ?? '',
    description: shop?.description ?? null,
    menu: normalizeMenu(raw.menu?.items, {
      storeDomain,
      primaryDomain: shop?.primaryDomain?.url ?? null,
    }),
    policies: toPolicyRefs(shop),
  }
}

// ---------------------------------------------------------------- fetchers

export async function getShopLayout(): Promise<ShopLayoutData> {
  const data = await storefrontFetch<RawShopLayout>(SHOP_LAYOUT_QUERY, {
    tags: ['shop', 'menu'],
    revalidate: CATALOG_REVALIDATE,
  })
  return normalizeShopLayout(data, getShopifyEnv().storeDomain)
}

export async function getPolicy(handle: string): Promise<Policy | null> {
  const data = await storefrontFetch<RawPolicies>(POLICIES_QUERY, {
    tags: ['shop'],
    revalidate: CATALOG_REVALIDATE,
  })
  const shop = data.shop
  const policies = [
    shop?.privacyPolicy,
    shop?.termsOfService,
    shop?.refundPolicy,
    shop?.shippingPolicy,
  ]
  const match = policies.find((policy) => policy && policy.handle === handle)
  return match ? { handle: match.handle, title: match.title, body: match.body } : null
}
