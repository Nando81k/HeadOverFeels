import Link from 'next/link'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'

const SHOP_LINKS = [
  { href: '/products', label: 'All Products' },
  { href: '/products?sortBy=newest', label: 'New Arrivals' },
  { href: '/collections', label: 'Collections' },
  { href: '/drops', label: 'Drops' },
  { href: '/products?category=hoodies', label: 'Hoodies' },
  { href: '/products?category=accessories', label: 'Accessories' },
] as const

const CUSTOMER_LINKS = [
  { href: '/cart', label: 'Cart' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/contact', label: 'Contact' },
  { href: '/profile', label: 'My Account' },
  { href: '/profile#rewards', label: 'Rewards' },
  { href: '/collections', label: 'Gift Guide' },
] as const

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/collections', label: 'Lookbooks' },
  { href: '/drops', label: 'Limited Drops' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
] as const

const SOCIAL_LINKS = [
  { href: 'https://instagram.com/headoverfeels', label: 'Instagram' },
  { href: 'https://tiktok.com/@headoverfeels', label: 'TikTok' },
  { href: 'https://twitter.com/headoverfeels', label: 'Twitter' },
] as const

export function HomeFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer data-testid="home-footer" className="border-t border-black/10 bg-neutral-100" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-16">
        <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.35)] sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/45">Newsletter</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-black sm:text-3xl">
                Early access, drop alerts, and exclusive offers.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-black/60">
                Join the Head Over Feels list for new collection launches and limited-edition release updates.
              </p>
            </div>
            <div className="w-full lg:w-[28rem]">
              <NewsletterSignup
                source="footer"
                sourceDetails="homepage-footer-newsletter"
                variant="inline"
              />
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-10 border-b border-black/10 pb-10 md:grid-cols-12">
          <div className="md:col-span-4 lg:col-span-5">
            <Link
              href="/"
              data-testid="home-footer-brand-link"
              className="brand-wordmark-link inline-block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-100"
            >
              <span className="brand-wordmark brand-wordmark--hover-red text-[2.05rem] sm:text-[2.35rem] whitespace-nowrap">
                Head Over Feels
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/60">
              Premium streetwear with a mindful edge. Designed for people who wear confidence, comfort, and care.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/60">
                Secure Checkout
              </span>
              <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/60">
                Easy Returns
              </span>
              <span className="rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/60">
                Fast Support
              </span>
            </div>
          </div>

          <nav className="md:col-span-2" aria-label="Shop links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Shop</p>
            <ul className="mt-4 space-y-2.5">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-black/65 transition-colors hover:text-black">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:col-span-2" aria-label="Customer links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Customer</p>
            <ul className="mt-4 space-y-2.5">
              {CUSTOMER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-black/65 transition-colors hover:text-black">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:col-span-2" aria-label="Company links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Company</p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-black/65 transition-colors hover:text-black">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:col-span-2" aria-label="Social links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Follow</p>
            <ul className="mt-4 space-y-2.5">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-black/65 transition-colors hover:text-black"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs uppercase tracking-[0.14em] text-black/45 md:flex-row md:items-center md:justify-between">
          <p>© {currentYear} Head Over Feels. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-black">Privacy Policy</Link>
            <Link href="/terms" className="transition-colors hover:text-black">Terms of Service</Link>
            <Link href="/contact" className="transition-colors hover:text-black">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
