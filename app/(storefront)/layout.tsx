import type { ReactNode } from 'react'
import { StorefrontShell } from '@/components/storefront/layout/StorefrontShell'

/**
 * Route-group layout for the rebuilt storefront. It nests inside the root
 * `app/layout.tsx` (html/body/Providers), which is left untouched.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell announcement="Free US shipping over $75">{children}</StorefrontShell>
}
