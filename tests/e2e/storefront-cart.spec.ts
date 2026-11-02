import { expect, test, type Locator, type Page } from '@playwright/test'
import { watchConsole } from './support/console'

/**
 * Cart flow (Phase 3, Task 8) against the Storefront mock
 * (`tests/e2e/mock/storefront-mock.mjs`): in-memory carts, fixture prices
 * (Core Hoodie $88), `GOLD15` = 15% off the subtotal, every other code
 * not applicable, checkout URLs on `/checkouts/cn/mock-<n>`.
 *
 * Every mutation goes through the real Server Actions, so the `hof_cart`
 * cookie round-trips through the dev server exactly as in production.
 */

const PDP = '/products/core-hoodie?Color=Taupe&Size=M'

/**
 * Wait until React has hydrated the buy-box form. Before hydration a click on
 * "Add to cart" is a native form post (the no-JS path), not the provider's
 * intercepted add that opens the drawer. React tags hydrated DOM nodes with a
 * `__reactProps$<id>` key.
 */
async function gotoHydratedPdp(page: Page) {
  const response = await page.goto(PDP)
  expect(response?.status()).toBe(200)
  await page.waitForFunction(() => {
    const form = document.getElementById('buy-box')
    return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps$'))
  })
}

/** The buy box's own submit button (the sticky bar has a second one on mobile). */
const addToCartButton = (page: Page) =>
  page.locator('#buy-box').getByRole('button', { name: 'Add to cart' })

const cartDrawer = (page: Page, count: number) =>
  page.getByRole('dialog', { name: new RegExp(`Cart \\(${count}\\)`) })

/** One `<dt>/<dd>` row of `CartSummary`. */
const summaryRow = (scope: Locator, label: string | RegExp) =>
  scope.locator('[data-cart-summary] dl > div').filter({ hasText: label })

test.describe('storefront cart', () => {
  test('add, change, discount, remove and re-open the cart from the cookie', async ({ page }) => {
    const errors = watchConsole(page)

    await test.step('PDP add opens the drawer with the line and a badge of 1', async () => {
      await gotoHydratedPdp(page)
      await addToCartButton(page).click()

      const drawer = cartDrawer(page, 1)
      await expect(drawer).toBeVisible()
      await expect(drawer.locator('[data-cart-line]')).toHaveCount(1)
      await expect(drawer.locator('[data-cart-line]').first()).toContainText('Core Hoodie')
      await expect(drawer.locator('[data-cart-line]').first()).toContainText('Taupe · M')
      await expect(page.locator('header [data-cart-badge]')).toHaveText('1')
    })

    await test.step('Increase quantity updates the subtotal to 2 × $88', async () => {
      const drawer = cartDrawer(page, 1)
      await drawer.getByRole('button', { name: 'Increase quantity' }).click()

      const updated = cartDrawer(page, 2)
      await expect(updated).toBeVisible()
      await expect(summaryRow(updated, 'Subtotal')).toContainText('$176.00')
      await expect(page.locator('header [data-cart-badge]')).toHaveText('2')
    })

    await test.step('GOLD15 adds a discount row', async () => {
      const drawer = cartDrawer(page, 2)
      const summary = drawer.locator('summary', { hasText: 'Have a code?' })
      if (await summary.isVisible()) await summary.click()

      await drawer.getByRole('textbox', { name: 'Discount code' }).fill('GOLD15')
      await drawer.getByRole('button', { name: 'Apply' }).click()

      // 15% of $176.00, shown as a negative amount (U+2212 or ASCII minus).
      await expect(summaryRow(drawer, 'GOLD15')).toContainText(/[−-]\$26\.40/)
      await expect(summaryRow(drawer, 'Estimated total')).toContainText('$149.60')
      await expect(drawer.getByRole('textbox', { name: 'Discount code' })).toHaveValue('')
    })

    await test.step('an unknown code shows an inline error and keeps GOLD15', async () => {
      const drawer = cartDrawer(page, 2)
      await drawer.getByRole('textbox', { name: 'Discount code' }).fill('NOPE')
      await drawer.getByRole('button', { name: 'Apply' }).click()

      await expect(drawer.getByRole('alert').filter({ hasText: "isn't valid" })).toBeVisible()
      await expect(summaryRow(drawer, 'GOLD15')).toBeVisible()
    })

    await test.step('Remove empties the cart', async () => {
      const drawer = cartDrawer(page, 2)
      await drawer.getByRole('button', { name: 'Remove Core Hoodie' }).click()

      const empty = cartDrawer(page, 0)
      await expect(empty.getByText('Your cart is empty.')).toBeVisible()
      await expect(page.locator('header [data-cart-badge]')).toHaveCount(0)
    })

    await test.step('add again, then /cart renders the cookie cart server-side', async () => {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: /Cart \(/ })).toBeHidden()

      await addToCartButton(page).click()
      await expect(cartDrawer(page, 1)).toBeVisible()

      const response = await page.goto('/cart')
      expect(response?.status()).toBe(200)

      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible()
      await expect(main.locator('[data-cart-line]')).toHaveCount(1)
      await expect(main.locator('[data-cart-line]').first()).toContainText('Core Hoodie')
    })

    await test.step('Checkout and Shop Pay link out to the Shopify checkout', async () => {
      const main = page.locator('main')
      await expect(main.getByRole('link', { name: /^Checkout/ })).toHaveAttribute(
        'href',
        /\/checkouts\//
      )
      await expect(main.getByRole('link', { name: 'Buy with Shop Pay' })).toHaveAttribute(
        'href',
        /[?&]payment=shop_pay(&|$)/
      )
    })

    await test.step('no console errors beyond the allow-list', async () => {
      await page.waitForLoadState('networkidle')
      expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
    })
  })

  test('/cart without a cookie shows the empty state', async ({ page }) => {
    const errors = watchConsole(page)

    const response = await page.goto('/cart')
    expect(response?.status()).toBe(200)

    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible()
    await expect(main.getByText('Your cart is empty.')).toBeVisible()

    await page.waitForLoadState('networkidle')
    expect(errors, `console errors on /cart:\n${errors.join('\n')}`).toEqual([])
  })

  test('mobile: the sticky buy bar adds to the cart and opens the drawer', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the sticky buy bar is mobile-only')

    await gotoHydratedPdp(page)

    // The bar shows once the buy box has scrolled out of view.
    await page.locator('footer').first().scrollIntoViewIfNeeded()
    const bar = page.locator('[data-sticky-buy-bar]')
    await expect(bar).toHaveAttribute('data-state', 'visible')

    await bar.getByRole('button').click()

    const drawer = cartDrawer(page, 1)
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('[data-cart-line]').first()).toContainText('Core Hoodie')
    await expect(page.locator('header [data-cart-badge]')).toHaveText('1')
  })
})
