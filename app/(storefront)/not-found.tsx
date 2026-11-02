import Link from 'next/link'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import { Button } from '@/components/storefront/ui/Button'

/**
 * Route-group 404. Reached by `notFound()` from a page whose handle Shopify
 * does not know, and by any unmatched storefront URL.
 */
export default function StorefrontNotFound() {
  return (
    <Section>
      <div className="flex max-w-xl flex-col items-start gap-6">
        <Display as="h1" size="lg">
          Not found
        </Display>
        <p className="text-ink-soft">
          This page moved, sold out of existence, or never was. The rest of the shop is
          still here.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/collections/all">Shop all</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    </Section>
  )
}
