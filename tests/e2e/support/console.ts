import type { Page } from '@playwright/test'

/**
 * Console allow-list shared by the storefront specs (Phase 2 Task 8, Phase 3
 * Task 8). It lives outside the spec files because Playwright forbids one test
 * file importing another.
 */

/**
 * Console noise that must not fail the smoke run:
 * - dev-only React messages (DevTools, Fast Refresh) and dev-server hydration
 *   mismatches: `next dev` occasionally serves HTML and RSC/chunks from
 *   different compiles when a page is first hit right after a Server Action
 *   (seen once in ~20 cart flows, never in 24 cold `/cart` loads with a cookie);
 * - the 401 from the legacy `AuthProvider`'s `/api/auth/me` probe that the root
 *   `Providers` still fire on every page for signed-out visitors, and that
 *   probe's "Failed to fetch current user" log when a navigation aborts it;
 * - next-auth's `ClientFetchError` when a navigation aborts the legacy
 *   `SessionProvider`'s in-flight `/api/auth/session` fetch.
 * Phase 6 removes both legacy providers.
 */
export const IGNORED_CONSOLE_ERRORS =
  /React DevTools|Fast Refresh|hydrat|status of 401 \(Unauthorized\)|Failed to fetch current user|errors\.authjs\.dev#autherror/i

/**
 * Legacy endpoints the root `Providers` still call on every page (`AuthProvider`
 * → `/api/auth/*`, `PopupManager` → `/api/popups/*`). They need the database and
 * NextAuth, neither of which the storefront depends on; failed loads from them
 * are not storefront regressions. Phase 6 removes both providers.
 */
export const IGNORED_RESOURCE_URLS = /\/api\/(auth|popups)\//

/**
 * The e2e Storefront mock serves fixture image URLs on `cdn.shopify.com`, which
 * the dev server's image optimizer cannot reach (no network in CI, and no hosts
 * entries by design). Failed `/_next/image?url=https%3A%2F%2Fcdn.shopify.com…`
 * loads are therefore expected and are not storefront regressions.
 */
export function isIgnoredImageLoad(url: string): boolean {
  return url.includes('/_next/image') && url.includes('cdn.shopify.com')
}

/**
 * Collects console errors and uncaught page errors for the current test, minus
 * the known dev noise. `IGNORED_CONSOLE_ERRORS` applies to both: React 19
 * reports recoverable hydration errors through `reportError`, so they surface
 * as `pageerror`, not as console messages.
 */
export function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const url = message.location().url ?? ''
    if (IGNORED_CONSOLE_ERRORS.test(text)) return
    if (IGNORED_RESOURCE_URLS.test(url)) return
    if (isIgnoredImageLoad(url)) return
    errors.push(text)
  })
  page.on('pageerror', (error) => {
    const text = String(error)
    if (IGNORED_CONSOLE_ERRORS.test(text)) return
    errors.push(text)
  })
  return errors
}
