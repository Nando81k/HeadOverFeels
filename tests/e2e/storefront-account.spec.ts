import { expect, test, type Page } from '@playwright/test'
import { watchConsole } from './support/console'

/**
 * Accounts, Care Points and wishlist (Phase 4, Task 9) against the Customer
 * Account mock mounted under `/customer` on the Storefront mock
 * (`tests/e2e/mock/customer-account-mock.mjs`). The mock has no hosted login:
 * `/oauth/authorize` 302s straight back to `/account/callback`, so the real
 * route handlers run the whole PKCE exchange, seal the `hof_customer` cookie
 * and read the fixture customer "Nando Alvarez" (orders #1012 / #1007, two
 * addresses) over the real `customerFetch`.
 *
 * What needs a database stays out of this suite: Care Points balances and the
 * server-side wishlist (`StorefrontWishlistItem`) live in Prisma, which the
 * hermetic run does not start. Those paths are covered by the unit tests; here
 * the signed-in `/loyalty` page is only asserted not to crash, and the wishlist
 * step accepts both outcomes (merged into the account when a database is
 * reachable, kept locally when not) while always requiring the saved item to
 * survive sign-in.
 */

const PDP = '/products/core-hoodie?Color=Taupe&Size=M'
const CUSTOMER_NAME = 'Nando Alvarez'
const NEW_STREET = '1 Main St'

/** Wait for React to hydrate the buy box (same as the cart spec). */
async function gotoHydratedPdp(page: Page) {
  const response = await page.goto(PDP)
  expect(response?.status()).toBe(200)
  await page.waitForFunction(() => {
    const form = document.getElementById('buy-box')
    return form !== null && Object.keys(form).some((key) => key.startsWith('__reactProps$'))
  })
}

const header = (page: Page) => page.locator('header').first()
const accountIcon = (page: Page) => header(page).getByRole('link', { name: 'Account', exact: true })
const accountMenuButton = (page: Page) =>
  header(page).getByRole('button', { name: `Account menu, ${CUSTOMER_NAME}` })

/** Drive the hosted-login round trip from `/account/login` and land on `return_to`. */
async function signIn(page: Page, returnTo = '/account') {
  await page.goto(`/account/login?return_to=${encodeURIComponent(returnTo)}`)
  await page.waitForURL((url) => url.pathname === returnTo)
}

test.describe('storefront account', () => {
  test('sign in, read the account, add an address, keep the wishlist, sign out', async ({ page }) => {
    // One journey across seven routes; `next dev` compiles each of them on first
    // hit, which alone can take longer than the suite-wide 30s budget.
    test.setTimeout(150_000)
    const errors = watchConsole(page)

    await test.step('a guest saves a variant to the wishlist on the PDP', async () => {
      await gotoHydratedPdp(page)
      const heart = page.locator('#buy-box').getByRole('button', { name: 'Save to wishlist' })
      await heart.click()
      await expect(
        page.locator('#buy-box').getByRole('button', { name: 'Remove from wishlist' })
      ).toHaveAttribute('aria-pressed', 'true')
    })

    await test.step('the header account icon points at the hosted login', async () => {
      await expect(accountIcon(page)).toHaveAttribute('href', '/account/login')
    })

    await test.step('the login round trip lands on /account signed in with initials', async () => {
      await accountIcon(page).click()
      await page.waitForURL((url) => url.pathname === '/account')

      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1, name: 'Hey, Nando.' })).toBeVisible()
      await expect(accountMenuButton(page)).toBeVisible()
      await expect(header(page).locator('[data-initials]')).toHaveText('NA')
      await expect(accountIcon(page)).toHaveCount(0)
    })

    await test.step('the overview shows the fixture profile and recent orders', async () => {
      const main = page.locator('main')
      await expect(main.getByText(CUSTOMER_NAME).first()).toBeVisible()
      await expect(main.getByText('nando@example.com')).toBeVisible()
      await expect(main.locator('[data-order-card]')).toHaveCount(2)
      await expect(main.locator('[data-order-card]').first()).toContainText('#1012')
      await expect(main.getByText('221 Bowery')).toBeVisible()
    })

    await test.step('orders list and the order detail with tracking', async () => {
      await page.goto('/account/orders')
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible()
      await expect(main.locator('[data-order-card]')).toHaveCount(2)
      await expect(main.locator('[data-order-card]').first()).toContainText('Core Hoodie')

      // Assert the link, then load the detail page directly: a `next/link`
      // soft navigation can be dropped when `next dev` pushes a Fast Refresh
      // (another worker compiling a route) while the transition is pending.
      const view = main.getByRole('link', { name: 'View order #1012' })
      await expect(view).toHaveAttribute('href', '/account/orders/6123456789')
      const detail = await page.goto('/account/orders/6123456789')
      expect(detail?.status()).toBe(200)

      await expect(main.getByRole('heading', { level: 1, name: /Order #1012/ })).toBeVisible()
      await expect(main.locator('[data-step="shipped"]')).toHaveAttribute('data-step-state', 'done')
      const tracking = main.getByRole('link', { name: /1Z999AA10123456784/ })
      await expect(tracking).toHaveAttribute('href', /ups\.com\/track/)
      await expect(main.getByRole('link', { name: 'Order status page' })).toHaveAttribute(
        'href',
        /myshopify\.com\/85215183073\/orders\//
      )
      await expect(main.getByText('Taupe / M')).toBeVisible()
    })

    await test.step('adding an address goes through the mock mutation and re-reads the list', async () => {
      await page.goto('/account/addresses')
      const main = page.locator('main')
      await expect(main.getByRole('heading', { level: 1, name: 'Addresses' })).toBeVisible()
      await expect(main.locator('[data-address-card]')).toHaveCount(2)
      await expect(main.locator('[data-address-card][data-default]')).toContainText('221 Bowery')

      await main.getByRole('button', { name: 'Add address' }).click()
      const form = main.locator('[data-address-form="create"]')
      await expect(form).toBeVisible()
      await form.getByLabel('First name').fill('Nando')
      await form.getByLabel('Last name').fill('Alvarez')
      await form.getByLabel('Address', { exact: true }).fill(NEW_STREET)
      await form.getByLabel('City').fill('Austin')
      await form.getByLabel('State / province').fill('TX')
      await form.getByLabel('ZIP / postcode').fill('73301')
      await form.getByRole('button', { name: 'Save address' }).click()

      await expect(form).toHaveCount(0)
      await expect(main.locator('[data-address-card]')).toHaveCount(3)
      await expect(main.locator('[data-address-card]').filter({ hasText: NEW_STREET })).toContainText(
        'Austin TX 73301'
      )
    })

    await test.step('the guest wishlist survives sign-in', async () => {
      await page.goto('/wishlist')
      const wishlist = page.locator('[data-wishlist-page]')
      await expect(wishlist).toHaveAttribute('data-status', /^(ready|guest)$/)
      await expect(wishlist.locator('[data-wishlist-count]')).toHaveText('[1]')
      await expect(wishlist.locator('[data-wishlist-card]')).toHaveCount(1)
      await expect(wishlist.locator('[data-wishlist-card]').first()).toContainText('Core Hoodie')

      const status = await wishlist.getAttribute('data-status')
      if (status === 'ready') {
        // A database was reachable: the guest entry was folded into the account.
        await expect(wishlist.locator('[data-wishlist-merged]')).toContainText('We merged the 1 item')
      } else {
        // Hermetic run (no Prisma): the list stays local and the page says so.
        await expect(wishlist.locator('[data-wishlist-guest]')).toBeVisible()
      }
    })

    await test.step('/loyalty renders for the signed-in customer', async () => {
      const response = await page.goto('/loyalty')
      expect(response?.status()).toBe(200)
      await expect(page.locator('[data-loyalty-hub]')).toBeVisible()
      // The hub never shows the guest buttons to a signed-in customer, whether or
      // not the balance (Prisma) could be loaded.
      await expect(page.locator('main').getByRole('link', { name: 'Join free' })).toHaveCount(0)
      await expect(accountMenuButton(page)).toBeVisible()
    })

    await test.step('sign out from the header menu clears the chip and the session', async () => {
      await accountMenuButton(page).click()
      const menu = header(page).getByRole('menu')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('menuitem', { name: 'Orders' })).toHaveAttribute('href', '/account/orders')
      await menu.getByRole('menuitem', { name: 'Sign out' }).click()

      await page.waitForURL((url) => url.pathname === '/')
      await expect(accountIcon(page)).toBeVisible()
      await expect(accountMenuButton(page)).toHaveCount(0)

      const cookies = await page.context().cookies()
      expect(cookies.find((cookie) => cookie.name === 'hof_customer')).toBeUndefined()
    })

    await test.step('signed out, /account/orders renders the gate with return_to', async () => {
      const response = await page.goto('/account/orders')
      expect(response?.status()).toBe(200)
      const gate = page.locator('main [data-account="signed-out"]')
      await expect(gate.getByRole('heading', { level: 1, name: 'Sign in to see your account' })).toBeVisible()
      await expect(gate.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        '/account/login?return_to=%2Faccount%2Forders'
      )
    })

    await test.step('no console errors beyond the allow-list', async () => {
      await page.waitForLoadState('networkidle')
      expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
    })
  })

  test('return_to brings the customer back to the page that asked for sign-in', async ({ page }) => {
    const errors = watchConsole(page)

    await signIn(page, '/account/addresses')
    await expect(page.locator('main').getByRole('heading', { level: 1, name: 'Addresses' })).toBeVisible()
    await expect(accountMenuButton(page)).toBeVisible()

    await page.waitForLoadState('networkidle')
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
  })

  test('a callback without the matching state cookie is refused', async ({ page }) => {
    // No `hof_customer_oauth` cookie in this fresh context, so the state check
    // fails before any token exchange. `maxRedirects: 0` keeps the 302 visible
    // (following it would start a new login round trip against the mock).
    const response = await page.request.get('/account/callback?code=mock-code-x&state=forged', {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(302)
    expect(response.headers().location).toMatch(/\/account\/login\?error=state$/)
    expect(response.headers()['set-cookie'] ?? '').not.toContain('hof_customer=')
  })

  test('/loyalty signed out shows the public hero and the inline gates', async ({ page }) => {
    const errors = watchConsole(page)

    const response = await page.goto('/loyalty')
    expect(response?.status()).toBe(200)

    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1, name: 'Earn on every order. Spend on what you want.' })).toBeVisible()
    await expect(main.getByRole('link', { name: 'Join free' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Floyalty'
    )
    const gates = main.locator('[data-loyalty-gate]')
    await expect(gates).toHaveCount(2)
    await expect(gates.first()).toContainText('Sign in to see your history.')
    await expect(gates.nth(1)).toContainText('Sign in to see your referral link.')

    await page.waitForLoadState('networkidle')
    expect(errors, `console errors on /loyalty:\n${errors.join('\n')}`).toEqual([])
  })

  test('/account signed out renders the gate, not a redirect', async ({ page }) => {
    const errors = watchConsole(page)

    const response = await page.goto('/account')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/account$/)
    const gate = page.locator('main [data-account="signed-out"]')
    await expect(gate).toBeVisible()
    await expect(gate.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/account/login?return_to=%2Faccount'
    )

    await page.waitForLoadState('networkidle')
    expect(errors, `console errors on /account:\n${errors.join('\n')}`).toEqual([])
  })
})
