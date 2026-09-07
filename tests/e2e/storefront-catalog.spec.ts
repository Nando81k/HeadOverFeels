import { expect, test, type Page } from '@playwright/test'

/**
 * Catalog smoke suite (Phase 2, Task 8) — replaces the Phase 1
 * `/storefront-preview` shell spec now that the real routes exist.
 *
 * Every route is checked for the same four things: HTTP 200, the layout
 * landmarks, a clean console, and *evidence the page actually rendered
 * something* — either real catalog content or the `data-catalog="unconfigured"`
 * notice. The trial store may still hold zero products, so grid routes also
 * accept the grid's own empty state rather than failing the whole run.
 */

/** Dev-only console noise that must not fail the smoke run. */
const IGNORED_CONSOLE_ERRORS = /React DevTools|Fast Refresh|hydrat/i

/** `[data-catalog="unconfigured"]` — every route may legitimately render this. */
const UNCONFIGURED = '[data-catalog="unconfigured"]'

/** Product card root (see `components/storefront/product/ProductCard.tsx`). */
const PRODUCT_CARD = 'article[data-product-handle]'

/** `ProductGrid`'s empty state / any page-level status message. */
const EMPTY_STATE = 'main [role="status"]'

type Route = {
  /** URL to visit. */
  path: string
  /** Selectors proving the page rendered its own content; one match is enough. */
  evidence: string[]
}

const ROUTES: Route[] = [
  { path: '/', evidence: [UNCONFIGURED, PRODUCT_CARD, 'main a[href^="/collections/"]'] },
  { path: '/collections', evidence: [UNCONFIGURED, EMPTY_STATE, 'main a[href^="/collections/"]'] },
  { path: '/collections/all', evidence: [UNCONFIGURED, PRODUCT_CARD, EMPTY_STATE] },
  { path: '/drops', evidence: [UNCONFIGURED, PRODUCT_CARD, EMPTY_STATE] },
  { path: '/search?q=hoodie', evidence: [UNCONFIGURED, PRODUCT_CARD, EMPTY_STATE] },
  { path: '/policies/privacy-policy', evidence: [UNCONFIGURED, 'main .prose-sf'] },
]

/** Collects console errors for the current test, minus the known dev noise. */
function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (IGNORED_CONSOLE_ERRORS.test(text)) return
    errors.push(text)
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** Landmarks + evidence + console, asserted the same way for every route. */
async function expectHealthyPage(page: Page, route: Route, errors: string[]) {
  await expect(page.locator('header').first()).toBeVisible()
  await expect(page.locator('footer').first()).toBeVisible()
  await expect(page.locator('main#main-content')).toBeAttached()

  let matches = 0
  for (const selector of route.evidence) {
    matches += await page.locator(selector).count()
  }
  expect(
    matches,
    `${route.path} rendered neither catalog content nor the unconfigured notice`
  ).toBeGreaterThanOrEqual(1)

  // Client components need a beat to hydrate before the console is trustworthy.
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1_000)
  expect(errors, `console errors on ${route.path}:\n${errors.join('\n')}`).toEqual([])
}

test.describe('storefront catalog routes', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders with chrome, content and a clean console`, async ({ page }) => {
      const errors = watchConsole(page)

      const response = await page.goto(route.path)
      expect(response?.status(), `GET ${route.path} should return 200`).toBe(200)

      await expectHealthyPage(page, route, errors)
    })
  }

  test('a product detail page renders for the first card in /collections/all', async ({ page }) => {
    const errors = watchConsole(page)

    await page.goto('/collections/all')

    const cards = page.locator(PRODUCT_CARD)
    let handle = (await cards.count())
      ? await cards.first().getAttribute('data-product-handle')
      : null

    if (!handle) {
      // Fall back to any product link on the page before giving up.
      const link = page.locator('main a[href^="/products/"]').first()
      if (await link.count()) {
        const href = (await link.getAttribute('href')) ?? ''
        handle = href.split('/products/')[1]?.split(/[?#]/)[0] ?? null
      }
    }

    // Soft by design: the trial store may not have products migrated yet.
    test.skip(!handle, 'no products in the catalog yet')

    const path = `/products/${handle}`
    const response = await page.goto(path)
    expect(response?.status(), `GET ${path} should return 200`).toBe(200)

    await expectHealthyPage(page, { path, evidence: [UNCONFIGURED, 'main h1'] }, errors)
  })

  test('/search without a query renders the search form', async ({ page }) => {
    const response = await page.goto('/search')
    expect(response?.status()).toBe(200)

    const form = page.getByRole('search').first()
    await expect(form).toBeVisible()
    await expect(form.locator('input[name="q"]')).toBeVisible()
  })

  test('/privacy redirects to the Shopify-backed policy page', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).toHaveURL(/\/policies\/privacy-policy$/)
  })
})

test.describe('storefront header', () => {
  test('the search button opens the dialog and Enter navigates to /search', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /^search$/i }).click()

    const dialog = page.getByRole('dialog', { name: /search/i })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('searchbox').first().fill('hoodie')
    await dialog.getByRole('searchbox').first().press('Enter')

    await page.waitForURL(/\/search\?q=hoodie/)
    await expect(page.locator('main#main-content')).toBeAttached()
  })

  test('the mobile menu opens a dialog and moves focus inside it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile viewport only')

    await page.goto('/')
    await page.getByRole('button', { name: /open menu/i }).click()

    const dialog = page.getByRole('dialog').first()
    await expect(dialog).toBeVisible()

    const focusInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"], dialog[open]')
      const active = document.activeElement
      return Boolean(dialogEl && active && dialogEl.contains(active))
    })

    expect(focusInsideDialog, 'focus should move into the mobile menu dialog').toBe(true)
  })
})
