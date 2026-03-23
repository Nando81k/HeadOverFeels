import Link from 'next/link'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'

const SHOP_LINKS = [
  { href: '/products', label: 'All Products' },
  { href: '/collections', label: 'Collections' },
  { href: '/drops', label: 'Drops' },
] as const

const SUPPORT_LINKS = [
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
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
    <footer data-testid="home-footer" className="bg-neutral-100" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-16">
        <div className="grid gap-10 border-b border-black/10 pb-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Head Over Feels</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/60">
              Premium streetwear with a mindful edge. Designed for people who wear confidence, comfort, and care.
            </p>
          </div>

          <nav className="md:col-span-2" aria-label="Shop links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Shop</p>
            <ul className="mt-4 space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-black/65 transition-colors hover:text-black">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="md:col-span-2" aria-label="Support links">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Support</p>
            <ul className="mt-4 space-y-3">
              {SUPPORT_LINKS.map((link) => (
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
            <ul className="mt-4 space-y-3">
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

          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Newsletter</p>
            <p className="mt-3 text-sm leading-relaxed text-black/60">
              Drop alerts and early access updates.
            </p>
            <div className="mt-4">
              <NewsletterSignup
                source="footer"
                sourceDetails="homepage-footer-newsletter"
                variant="minimal"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs uppercase tracking-[0.14em] text-black/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Head Over Feels. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-black">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-black">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
