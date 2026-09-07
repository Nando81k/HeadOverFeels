import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { StorefrontShell } from '@/components/storefront/layout/StorefrontShell'

/**
 * Storefront-wide defaults. `template` lets every page set only its own title;
 * `metadataBase` makes the relative OG/canonical URLs the pages emit absolute.
 *
 * The base URL is inlined here rather than taken from `lib/storefront/seo.ts`
 * (`siteUrl()`), which Task 7 adds — swap this for that helper once it lands.
 */
export const metadata: Metadata = {
  title: {
    default: 'Head Over Feels',
    template: '%s · Head Over Feels',
  },
  description:
    'Heavyweight streetwear, honest fits, small runs. Earn Care Points on every order.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://headoverfeels.com'),
}

/**
 * Route-group layout for the rebuilt storefront. It nests inside the root
 * `app/layout.tsx` (html/body/Providers), which is left untouched.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell announcement="Free US shipping over $75">{children}</StorefrontShell>
}
