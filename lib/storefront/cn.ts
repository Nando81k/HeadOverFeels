import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Storefront class-name joiner.
 *
 * Deliberately a private copy of the same three lines as `lib/utils.ts`:
 * storefront code must never import from `lib/utils` or `components/ui`
 * (see the Phase 1 plan, cross-cutting note 2), so the two namespaces can be
 * evolved — and eventually the legacy one deleted — independently.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export type { ClassValue }
