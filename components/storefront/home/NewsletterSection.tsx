import { NewsletterForm } from '@/components/storefront/newsletter/NewsletterForm'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

export interface NewsletterSectionProps {
  className?: string
}

/**
 * Home newsletter block (design spec §5.4 row `/`). `id="newsletter"` is the
 * anchor the footer and campaign links point at.
 *
 * The form itself is the shared island — one server action, one set of copy,
 * whether it is submitted here or from the footer.
 */
export function NewsletterSection({ className }: NewsletterSectionProps) {
  return (
    <Section tone="bone" id="newsletter" aria-labelledby="home-newsletter" className={className}>
      <div className="flex flex-col items-start gap-4">
        <Eyebrow>Newsletter</Eyebrow>
        <Display as="h2" id="home-newsletter" size="md">
          Get the drop first
        </Display>
        <p className="max-w-md text-base text-ink-soft">
          Drop dates, restocks and Care Points news — nothing else. Unsubscribe any time.
        </p>
        <NewsletterForm className="w-full max-w-md" />
      </div>
    </Section>
  )
}
