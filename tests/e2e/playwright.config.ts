import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

/**
 * Storefront end-to-end smoke suite (Phase 2, Task 8).
 *
 * Run with `npm run test:e2e`. By default Playwright boots `npm run dev` itself
 * and drives the real storefront routes; set `PLAYWRIGHT_BASE_URL` to point at
 * an already-running server (or a Vercel preview) and the web server is skipped.
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

const webServer: PlaywrightTestConfig['webServer'] = externalBaseURL
  ? undefined
  : {
      command: 'npm run dev',
      url: `${DEFAULT_BASE_URL}/`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    }

export default defineConfig({
  testDir: __dirname,
  timeout: 30_000,
  retries: isCI ? 1 : 0,
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
