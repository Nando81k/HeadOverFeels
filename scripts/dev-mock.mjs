#!/usr/bin/env node
/**
 * Run the storefront against the Playwright catalog mock — no Shopify
 * credentials needed:
 *
 *   npm run dev:mock
 *
 * Starts `tests/e2e/mock/storefront-mock.mjs` (fixture catalog, in-memory
 * carts, images from `public/assets`) and `next dev` pointed at it with the
 * same env the e2e config uses. Ctrl-C stops both.
 */
import { spawn } from 'node:child_process'

const MOCK_PORT = Number(process.env.MOCK_PORT || 4443)
const MOCK_ORIGIN = `127.0.0.1:${MOCK_PORT}`

const mock = spawn(process.execPath, ['tests/e2e/mock/storefront-mock.mjs', '--port', String(MOCK_PORT), '--serve-images'], {
  stdio: 'inherit',
})

const next = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SHOPIFY_STORE_DOMAIN: MOCK_ORIGIN,
    SHOPIFY_STOREFRONT_PRIVATE_TOKEN: 'mock',
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN: 'mock',
    SHOPIFY_STOREFRONT_INSECURE_LOCAL: '1',
    AUTH_SECRET: process.env.AUTH_SECRET ?? 'dev-mock-placeholder-secret',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'dev-mock-placeholder-secret',
  },
})

const stop = () => {
  mock.kill()
  next.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
next.on('exit', (code) => {
  mock.kill()
  process.exit(code ?? 0)
})
