/**
 * Environment bootstrap for every script under scripts/shopify (Phase 1, Tasks 3–4).
 *
 * Import this module FIRST — before anything that reads `process.env` (lib/shopify/env.ts) —
 * so `.env.shopify` is on `process.env` by the time the env accessor validates it. The other
 * modules are then pulled in with `await import(...)`.
 *
 * Files are loaded without override, so real environment variables (CI) always win:
 *   1. .env.shopify   — Shopify domain + tokens (git-ignored, see .env.shopify.example)
 *   2. .env.local      — DATABASE_URL and friends for the Prisma-reading scripts
 *
 * Never log a token: only `maskToken()` output belongs in script output.
 */
import { config } from 'dotenv'

let loaded = false

/** Loads `.env.shopify` then `.env.local` onto `process.env`. Idempotent. */
export function loadShopifyEnvFiles(): void {
  if (loaded) return
  config({ path: '.env.shopify' })
  config({ path: '.env.local' })
  loaded = true
}

loadShopifyEnvFiles()

/** Shape of `lib/shopify/admin-client` (Task 1) as the scripts consume it. */
export interface AdminClientModule {
  adminRequest: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>
  assertNoUserErrors: (obj: unknown, path: string) => void
}

/**
 * Imports the Admin API client after the env files are on `process.env` — the client reads
 * the env at first use, so it must not be imported at module scope before this runs.
 * (`lib/shopify/admin-client.ts` deliberately does not `import 'server-only'` so it stays
 * usable from tsx scripts.)
 */
export async function loadAdminClient(): Promise<AdminClientModule> {
  loadShopifyEnvFiles()
  const mod = await import('../../../lib/shopify/admin-client')
  return mod as unknown as AdminClientModule
}

/** Loads the validated Admin env (`{ storeDomain, accessToken }`) after the env files. */
export async function loadAdminEnv(): Promise<{ storeDomain: string; accessToken: string }> {
  loadShopifyEnvFiles()
  const { getShopifyAdminEnv } = await import('../../../lib/shopify/env')
  return getShopifyAdminEnv()
}

/** Renders a token as `abcd…wxyz` so output can prove which credential was used, never its value. */
export function maskToken(token: string): string {
  if (token.length <= 8) return '••••'
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

/** True when `--<name>` is present in argv. */
export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

/** Value of `--<name> <value>` (or `--<name>=<value>`), else null. */
export function flagValue(name: string): string | null {
  const argv = process.argv
  const index = argv.indexOf(`--${name}`)
  if (index !== -1 && index + 1 < argv.length) {
    const next = argv[index + 1]
    if (!next.startsWith('--')) return next
  }
  const inline = argv.find((arg) => arg.startsWith(`--${name}=`))
  return inline ? inline.slice(name.length + 3) : null
}

/** `--apply` mutates; anything else (including `--dry-run`) is a dry run. */
export function isApply(): boolean {
  return hasFlag('apply')
}
