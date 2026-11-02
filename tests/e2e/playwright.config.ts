import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

/**
 * Storefront end-to-end suite (Phase 2 Task 8, Phase 3 Task 8).
 *
 * Run with `npm run test:e2e`. By default Playwright boots the Storefront API
 * mock and `npm run dev` (pointed at the mock) itself and drives the real
 * storefront routes; set `PLAYWRIGHT_BASE_URL` to point at an already-running
 * server (or a Vercel preview) and both web servers are skipped.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000'

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL ?? DEFAULT_BASE_URL
const isCI = Boolean(process.env.CI)

/**
 * Resolve a preinstalled Chromium so CI images (and this sandbox) can reuse the
 * browser at `PLAYWRIGHT_BROWSERS_PATH` instead of downloading one. Handles both
 * a direct executable path and a browser directory containing
 * `chrome-linux/chrome`. Returns `undefined` so Playwright falls back to its own
 * managed browser when nothing usable is found.
 */
function resolveChromiumExecutable(): string | undefined {
  const candidates = [process.env.PLAYWRIGHT_CHROMIUM_PATH, '/opt/pw-browsers/chromium']

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue

    // statSync follows symlinks, so `/opt/pw-browsers/chromium -> .../chrome` works.
    const stats = fs.statSync(candidate)
    if (stats.isFile()) return candidate

    if (stats.isDirectory()) {
      const nested = path.join(candidate, 'chrome-linux', 'chrome')
      if (fs.existsSync(nested)) return nested
    }
  }

  return undefined
}

const executablePath = resolveChromiumExecutable()
const launchOptions = { executablePath }

const reporter: PlaywrightTestConfig['reporter'] = isCI ? [['github'], ['list']] : 'list'

/** Port of the plain-HTTP Storefront mock (`tests/e2e/mock/storefront-mock.mjs`). */
const MOCK_PORT = 4443
const MOCK_ORIGIN = `127.0.0.1:${MOCK_PORT}`

/** Web server commands run from the repo root (Playwright defaults to this config's folder). */
const REPO_ROOT = path.resolve(__dirname, '../..')

/**
 * Two servers: the Storefront API mock (fixtures + in-memory carts + the
 * Customer Account OIDC/GraphQL mock under `/customer`) and the Next dev
 * server pointed at it. No Shopify secrets are needed — the suite is
 * hermetic. `SHOPIFY_STOREFRONT_INSECURE_LOCAL=1` lets `lib/shopify/client.ts`
 * call the mock over `http://` (it only applies to localhost/127.0.0.1);
 * `SHOPIFY_CUSTOMER_ACCOUNT_ISSUER` points OIDC discovery at the mock, and the
 * client id / shop id / base URL make `hasCustomerAccountEnv()` true so the
 * account routes, header chip and wishlist run their configured paths.
 */
const webServer: PlaywrightTestConfig['webServer'] = externalBaseURL
  ? undefined
  : [
      {
        command: `node tests/e2e/mock/storefront-mock.mjs --port ${MOCK_PORT}`,
        url: `http://${MOCK_ORIGIN}/health`,
        cwd: REPO_ROOT,
        reuseExistingServer: !isCI,
        timeout: 15_000,
        stdout: 'ignore',
      },
      {
        command: 'npm run dev',
        url: `${DEFAULT_BASE_URL}/`,
        cwd: REPO_ROOT,
        reuseExistingServer: !isCI,
        timeout: 180_000,
        env: {
          SHOPIFY_STORE_DOMAIN: MOCK_ORIGIN,
          SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'mock',
          NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN: 'mock',
          SHOPIFY_STOREFRONT_INSECURE_LOCAL: '1',
          // Customer Account API (Phase 4) against the mock's `/customer` mount.
          SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'mock',
          SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: '85215183073',
          SHOPIFY_CUSTOMER_ACCOUNT_ISSUER: `http://${MOCK_ORIGIN}/customer`,
          NEXT_PUBLIC_BASE_URL: DEFAULT_BASE_URL,
          CUSTOMER_SESSION_SECRET: 'e2e-secret',
          // The legacy root `Providers` still mount next-auth's SessionProvider,
          // which 500s on `/api/auth/session` without a secret. A placeholder keeps
          // the smoke run's console clean until Phase 6 removes NextAuth.
          AUTH_SECRET: process.env.AUTH_SECRET ?? 'e2e-placeholder-secret',
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'e2e-placeholder-secret',
        },
      },
    ]

export default defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  /**
   * One worker in CI: two workers hit `next dev` with first-time compiles of
   * different routes at once, and the resulting Fast Refresh can drop a
   * pending client transition (seen as the cart drawer never opening on a
   * cold cache: 2 workers failed 3/3 cold runs, 1 worker passed). Locally the
   * cache is warm and the default parallelism is fine.
   */
  workers: isCI ? 1 : undefined,
  reporter,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], launchOptions },
    },
  ],
  ...(webServer ? { webServer } : {}),
})
