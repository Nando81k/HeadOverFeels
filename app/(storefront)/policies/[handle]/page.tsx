import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogUnavailable } from '@/components/storefront/CatalogUnavailable'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow, Prose } from '@/components/storefront/ui/Typography'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getPolicy } from '@/lib/shopify/queries'

/** The four policies Shopify exposes on `shop`. Anything else is a 404. */
export const POLICY_HANDLES = [
  'privacy-policy',
  'terms-of-service',
  'refund-policy',
  'shipping-policy',
] as const

export type PolicyHandle = (typeof POLICY_HANDLES)[number]

type PolicyPageProps = { params: Promise<{ handle: string }> }

/** Policy copy changes rarely; an hour of staleness is fine. */
export const revalidate = 3600

export function generateStaticParams(): { handle: PolicyHandle }[] {
  return POLICY_HANDLES.map((handle) => ({ handle }))
}

function isPolicyHandle(handle: string): handle is PolicyHandle {
  return (POLICY_HANDLES as readonly string[]).includes(handle)
}

/** `refund-policy` → `Refund Policy`; used before (or without) Shopify data. */
function humanise(handle: string): string {
  return handle
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { handle } = await params
  if (!isPolicyHandle(handle)) return { title: 'Not found' }
  if (!hasShopifyEnv()) return { title: humanise(handle) }

  const policy = await getPolicy(handle)
  return { title: policy?.title ?? humanise(handle) }
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { handle } = await params
  if (!isPolicyHandle(handle)) notFound()

  if (!hasShopifyEnv()) {
    return (
      <Section size="narrow">
        <Display as="h1" size="lg">
          {humanise(handle)}
        </Display>
        <CatalogUnavailable
          title="Policies are on their way"
          message="Legal pages publish from Shopify once the connection is live."
        />
      </Section>
    )
  }

  const policy = await getPolicy(handle)
  if (!policy) notFound()

  return (
    <Section size="narrow">
      <article className="flex flex-col gap-6">
        <Eyebrow>Policy</Eyebrow>
        <Display as="h1" size="lg">
          {policy.title}
        </Display>
        <Prose html={policy.body} />
      </article>
    </Section>
  )
}
