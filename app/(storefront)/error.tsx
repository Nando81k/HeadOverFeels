'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { Button } from '@/components/storefront/ui/Button'

export interface StorefrontErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Route-group error boundary. Anything a storefront page throws with the store
 * configured (a `ShopifyError`, a bad response) lands here; an unconfigured
 * store renders `CatalogUnavailable` instead and never reaches this.
 */
export default function StorefrontError({ error, reset }: StorefrontErrorProps) {
  useEffect(() => {
    // Only the digest: the message can carry Storefront internals, and the
    // production build replaces it with the digest anyway.
    console.error(`[storefront] render failed (digest: ${error.digest ?? 'none'})`)
  }, [error.digest])

  return (
    <Section>
      <div className="flex max-w-xl flex-col items-start gap-6">
        <Eyebrow>Error</Eyebrow>
        <Display as="h1" size="md">
          Something went wrong
        </Display>
        <p className="text-ink-soft">
          That page did not load. Try again — if it keeps happening, the shop is having a
          moment and we are on it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}
