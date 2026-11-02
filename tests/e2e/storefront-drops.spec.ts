import { expect, test, type Page } from '@playwright/test'
import { watchConsole } from './support/console'

/**
 * Drops (Phase 5, Task 5) against the Storefront mock.
 *
 * The mock serves two drops: `drop-01-heavyweight-crew` is **live** (the
 * collection fixture's `drop_start` is in the past, no `drop_end`) and
 * `signature-tee` is promoted in memory to an **upcoming** drop opening two
 * days from now. Every mocked PDP shares the Core Hoodie fixture's options and
 * variant ids, so the live add-to-cart here puts the hoodie's variant in the
 * cart and the server-side gate (`assertPurchasable`) sees a non-drop variant:
 * the gate, early access and `max_per_order` are covered by the unit suite
 * (`purchasable.test.ts`, `early-access.test.ts`, `cart-actions.test.ts`),
 * and the signed-in early-access unlock needs Prisma, so it is unit-only too.
 */

const LIVE = '/products/drop-01-heavyweight-crew?Color=Taupe&Size=M'
const UPCOMING = '/products/signature-tee?Color=Taupe&Size=M'
const SOLD_OUT = '/products/core-hoodie?Color=Black&Size=S'

async function gotoHydrated(page: Page, path: string) {
  const response = await page.goto(path)
  expect(response?.status()).toBe(200)
  await page.waitForFunction(() => {
    const form = document.getElementById('buy-box')
    return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps$'))
  })
}

const buyBoxButton = (page: Page) => page.locator('#buy-box button[type="submit"]')

test.describe('storefront drops', () => {
  test('/drops groups the live and the upcoming drop', async ({ page }) => {
    const errors = watchConsole(page)
    const response = await page.goto('/drops')
    expect(response?.status()).toBe(200)

    const live = page.locator('[data-drop-group="drops-live"]')
    const upcoming = page.locator('[data-drop-group="drops-upcoming"]')
    await expect(live.getByRole('heading', { name: 'Open now' })).toBeVisible()
    await expect(live.locator('article[data-product-handle="drop-01-heavyweight-crew"]')).toHaveCount(1)
    await expect(upcoming.getByRole('heading', { name: 'Next drops' })).toBeVisible()
    await expect(upcoming.locator('article[data-product-handle="signature-tee"]')).toHaveCount(1)
    await expect(upcoming.locator('[data-drop-status="upcoming"]')).toBeVisible()
    await expect(upcoming.locator('[data-drop-countdown]')).toBeVisible()

    await page.waitForTimeout(1_000)
    expect(errors, `console errors on /drops:\n${errors.join('\n')}`).toEqual([])
  })

  test('an upcoming drop locks the buy box with an "Opens …" button and a countdown', async ({ page }) => {
    const errors = watchConsole(page)
    await gotoHydrated(page, UPCOMING)

    await expect(page.locator('[data-drop-status="upcoming"]')).toBeVisible()
    await expect(page.locator('[data-drop-status="upcoming"] [data-drop-countdown]')).toBeVisible()

    const button = buyBoxButton(page)
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute('data-drop', 'locked')
    await expect(button).toHaveText(/^Opens /)

    // Signed out: the gate never asks the server (access stays "unknown") and offers sign-in.
    await expect(page.locator('[data-early-access="unknown"]')).toBeVisible()
    await expect(page.locator('[data-early-access] a[href^="/account/login"]')).toBeVisible()

    // The countdown ticks.
    const countdown = page.locator('[data-drop-status="upcoming"] [data-drop-countdown]')
    const before = await countdown.textContent()
    await page.waitForTimeout(1_500)
    expect(await countdown.textContent()).not.toBe(before)

    await page.waitForTimeout(500)
    expect(errors, `console errors on ${UPCOMING}:\n${errors.join('\n')}`).toEqual([])
  })

  test('a live drop adds to the cart like any product', async ({ page }) => {
    const errors = watchConsole(page)
    await gotoHydrated(page, LIVE)

    await expect(page.locator('[data-drop-status="live"]')).toBeVisible()
    const button = buyBoxButton(page)
    await expect(button).toBeEnabled()
    await expect(button).toHaveText('Add to cart')
    await button.click()

    const drawer = page.getByRole('dialog', { name: /Cart \(1\)/ })
    await expect(drawer).toBeVisible()
    await expect(drawer.locator('[data-cart-line]')).toHaveCount(1)
    await expect(page.locator('header [data-cart-badge]')).toHaveText('1')

    await page.waitForTimeout(1_000)
    expect(errors, `console errors on ${LIVE}:\n${errors.join('\n')}`).toEqual([])
  })

  test('a sold-out variant offers a back-in-stock alert', async ({ page }) => {
    const errors = watchConsole(page)
    await gotoHydrated(page, SOLD_OUT)

    await expect(buyBoxButton(page)).toBeDisabled()
    await expect(buyBoxButton(page)).toHaveText('Sold out')
    const form = page.locator('#back-in-stock')
    await expect(form).toBeVisible()
    await expect(form).toHaveAttribute('data-back-in-stock', 'guest')
    await expect(form.getByRole('textbox', { name: 'Email' })).toBeVisible()
    await expect(form.getByRole('button', { name: /notify me/i })).toBeVisible()

    await page.waitForTimeout(1_000)
    expect(errors, `console errors on ${SOLD_OUT}:\n${errors.join('\n')}`).toEqual([])
  })

  test('the home page announces the next drop', async ({ page }) => {
    const errors = watchConsole(page)
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    // A live drop wins the marquee; the mock has one.
    await expect(page.locator('main').getByText('Drop live — shop now').first()).toBeVisible()
    await expect(page.locator('[data-drop-panel]')).toBeVisible()
    await page.waitForTimeout(1_000)
    expect(errors, `console errors on /:\n${errors.join('\n')}`).toEqual([])
  })
})
