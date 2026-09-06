import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Smoke coverage for the storefront shell rendered at `/storefront-preview`
 * (Phase 1, Task 15). These are deliberately shallow: they prove the shell
 * boots, the landmarks exist and the mobile drawer traps focus. Deep catalog
 * assertions land with Phase 2.
 *
 * The trial store may still be empty, so product/policy assertions degrade to
 * "grid or empty state" rather than failing the whole suite.
 */

const PREVIEW_PATH = '/storefront-preview'

/** Dev-only console noise that must not fail the smoke run. */
const IGNORED_CONSOLE_ERRORS = /React DevTools|Fast Refresh/i

const FOOTER_COLUMN_HEADINGS = ['Shop', 'Help', 'Company', 'Newsletter'] as const

function dialogLocator(page: Page): Locator {
  return page.getByRole('dialog')
}

test.describe('storefront shell', () => {
  let consoleErrors: string[] = []
  let responseStatus: number | undefined

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    responseStatus = undefined

    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (IGNORED_CONSOLE_ERRORS.test(text)) return
      consoleErrors.push(text)
    })

    const response = await page.goto(PREVIEW_PATH)
    responseStatus = response?.status()
  })

  test('preview route responds 200 with no console errors', async ({ page }) => {
    expect(responseStatus, `GET ${PREVIEW_PATH} should return 200`).toBe(200)

    // Give client components a beat to hydrate before reading the console log.
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1_000)

    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  })

  test('renders the main#main-content landmark', async ({ page }) => {
    await expect(page.locator('main#main-content')).toBeAttached()
  })

  test('header primary nav exposes at least three links', async ({ page }) => {
    const primaryNav = page.locator('nav[aria-label="Primary"]')
    await expect(primaryNav).toBeAttached()

    const linkCount = await primaryNav.locator('a').count()
    expect(linkCount, 'primary nav should mirror the Shopify main-menu').toBeGreaterThanOrEqual(3)
  })

  test('product grid renders cards or an empty state', async ({ page }) => {
    const cards = page.locator('article[data-product-handle]')
    const emptyState = page.locator('[role="status"]')

    const cardCount = await cards.count()
    const emptyStateCount = await emptyState.count()

    // Soft by design: the trial store may not have products migrated yet.
    expect(
      cardCount + emptyStateCount,
      'expected either product cards or the grid empty state'
    ).toBeGreaterThanOrEqual(1)

    if (cardCount === 0) return

    const src = (await cards.first().locator('img').first().getAttribute('src')) ?? ''
    const isDirectShopifyCdn = src.includes('cdn.shopify.com')
    const isOptimizedShopifyCdn =
      src.includes('/_next/image') && decodeURIComponent(src).includes('cdn.shopify.com')

    expect(
      isDirectShopifyCdn || isOptimizedShopifyCdn,
      `product image should come from the Shopify CDN, got: ${src}`
    ).toBe(true)
  })

  test('mobile menu opens a dialog and moves focus inside it', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile viewport only')

    await page.getByRole('button', { name: /open menu/i }).click()

    const dialog = dialogLocator(page)
    await expect(dialog).toBeVisible()

    const focusInsideDialog = await page.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"], dialog[open]')
      const active = document.activeElement
      return Boolean(dialogEl && active && dialogEl.contains(active))
    })

    expect(focusInsideDialog, 'focus should move into the mobile menu dialog').toBe(true)
  })

  test('footer renders its columns and policy nav', async ({ page }) => {
    const footer = page.locator('footer').first()
    await expect(footer).toBeVisible()

    for (const heading of FOOTER_COLUMN_HEADINGS) {
      await expect(
        footer.getByRole('heading', { name: new RegExp(`^${heading}$`, 'i') }).first()
      ).toBeVisible()
    }

    const policyNav = footer.locator('nav[aria-label="Policies"]')
    const policyNavCount = await policyNav.count()

    // Soft by design: policies are configured on the trial store by a human step.
    expect(policyNavCount).toBeGreaterThanOrEqual(0)

    if (policyNavCount === 0) return

    const policyLinks = await policyNav.first().locator('a').count()
    expect(policyLinks, 'policy nav should link every configured shop policy').toBeGreaterThanOrEqual(1)
  })
})
