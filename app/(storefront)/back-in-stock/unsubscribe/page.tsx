import type { Metadata } from 'next'
import Link from 'next/link'
import { cancelSubscription } from '@/lib/storefront/back-in-stock'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

/** Each visit flips one row; never cache. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Back-in-stock alerts', robots: { index: false } }

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Landing page for the unsubscribe link in a back-in-stock email (Phase 5,
 * Task 3). The link carries the row id and the email; both must match a
 * pending row. Never reveals whether an address exists.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams
  const id = typeof sp.id === 'string' ? sp.id : ''
  const email = typeof sp.email === 'string' ? sp.email : ''

  let outcome: 'cancelled' | 'nothing' | 'error' = 'nothing'
  if (id && email) {
    try {
      outcome = (await cancelSubscription(id, email)) ? 'cancelled' : 'nothing'
    } catch (error) {
      console.error(`[back-in-stock] unsubscribe failed: ${error instanceof Error ? error.message : String(error)}`)
      outcome = 'error'
    }
  }

  const copy = {
    cancelled: { headline: 'You’re unsubscribed', detail: 'That alert is off. You can set a new one from any sold-out product.' },
    nothing: { headline: 'Nothing to turn off', detail: 'That alert was already sent, cancelled or expired.' },
    error: { headline: 'Something went wrong', detail: 'We could not update your alert just now. Please try the link again later.' },
  }[outcome]

  return (
    <Section data-back-in-stock-unsubscribe={outcome}>
      <div className="mx-auto flex max-w-prose flex-col items-start gap-5">
        <Eyebrow>Back-in-stock alerts</Eyebrow>
        <Display as="h1" size="md">
          {copy.headline}
        </Display>
        <p role="status" className="text-base text-ink-soft">
          {copy.detail}
        </p>
        <Button asChild variant="link">
          <Link href="/collections/all">Back to the shop</Link>
        </Button>
      </div>
    </Section>
  )
}
