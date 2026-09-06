import * as React from 'react'
import Link from 'next/link'
import { Container } from '@/components/storefront/ui/Container'
import { NewsletterForm } from '@/components/storefront/newsletter/NewsletterForm'
import type { MenuItem } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

type FooterLink = { href: string; label: string }

/** Support links. Static because they are pages, not Shopify menu entries. */
const HELP_LINKS: FooterLink[] = [
  { href: '/policies/shipping-policy', label: 'Shipping & returns' },
  { href: '/pages/faq', label: 'FAQ' },
  { href: '/pages/contact', label: 'Contact' },
  { href: '/account/orders', label: 'Track order' },
]

const COMPANY_LINKS: FooterLink[] = [
  { href: '/pages/about', label: 'About' },
  { href: '/loyalty', label: 'Loyalty' },
  { href: '/collections/drops', label: 'Drops' },
]

const HEADING_CLASS = 'text-xs font-semibold uppercase tracking-eyebrow text-bone'

const LINK_CLASS = [
  'inline-block py-1 text-sm text-bone/70',
  'transition-colors duration-sf-fast ease-sf-out hover:text-bone',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
].join(' ')

function LinkColumn({
  id,
  heading,
  links,
}: {
  id: string
  heading: string
  links: FooterLink[]
}) {
  return (
    <div>
      <h2 id={id} className={HEADING_CLASS}>
        {heading}
      </h2>
      <nav aria-labelledby={id} className="mt-4">
        <ul className="flex flex-col gap-1">
          {links.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              <Link href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export interface FooterProps {
  /** Top-level Shopify menu; rendered as the "Shop" column. */
  menu: MenuItem[]
  /** Published shop policies from `getShopLayout()`. */
  policies: { handle: string; title: string }[]
  /** Shop name for the copyright line. Defaults to "Head Over Feels". */
  shopName?: string
}

/**
 * Site footer (spec §5.3): four columns over a policy row.
 *
 * Server-safe on purpose — it holds no state, so the whole subtree stays out of
 * the client bundle apart from the `NewsletterForm` island, which owns the
 * server action and its result messages.
 */
export function Footer({ menu, policies, shopName = 'Head Over Feels' }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const shopLinks: FooterLink[] = menu.map((item: MenuItem) => ({
    href: item.url,
    label: item.title,
  }))

  return (
    <footer className="bg-ink text-bone">
      <Container className="grid gap-10 py-section sm:grid-cols-2 lg:grid-cols-4">
        <LinkColumn id="footer-shop" heading="Shop" links={shopLinks} />
        <LinkColumn id="footer-help" heading="Help" links={HELP_LINKS} />
        <LinkColumn id="footer-company" heading="Company" links={COMPANY_LINKS} />

        <div>
          <h2 id="footer-newsletter" className={HEADING_CLASS}>
            Newsletter
          </h2>
          <p className="mt-4 text-sm text-bone/70">
            Drop announcements and restocks. No noise.
          </p>
          <NewsletterForm className="mt-4" />
        </div>
      </Container>

      <div className="border-t border-bone/15">
        <Container
          className={cn(
            'flex flex-col gap-4 py-6',
            'md:flex-row md:items-center md:justify-between'
          )}
        >
          <p className="text-xs text-bone/60">{`© ${currentYear} ${shopName}`}</p>

          {policies.length > 0 ? (
            <nav aria-label="Policies">
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {policies.map((policy) => (
                  <li key={policy.handle}>
                    <Link href={`/policies/${policy.handle}`} className={cn(LINK_CLASS, 'text-xs')}>
                      {policy.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </Container>
      </div>
    </footer>
  )
}
