'use server'

import { z } from 'zod'

import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import type { StorefrontActionResult } from '@/lib/shopify/types'
import { hasEarlyAccess } from '@/lib/storefront/early-access'

/**
 * Drop Server Actions (Phase 5, Task 1).
 *
 * The PDP is ISR-cached, so it cannot know who is looking at it; the
 * `EarlyAccessGate` island asks this after mount for the signed-in visitor.
 * The answer is advisory for the UI only — `addCartLine` re-checks on the
 * server before any line is added.
 */

const handleSchema = z.string().trim().min(1).max(255)

export async function checkEarlyAccessAction(
  handle: string
): Promise<StorefrontActionResult<{ hasEarlyAccess: boolean }>> {
  const parsed = handleSchema.safeParse(handle)
  if (!parsed.success) return { ok: false, error: 'Unknown product.', code: 'INVALID_INPUT' }
  if (!hasCustomerAccountEnv()) return { ok: true, data: { hasEarlyAccess: false } }
  const session = await getCustomerSession()
  if (!session) return { ok: true, data: { hasEarlyAccess: false } }
  return { ok: true, data: { hasEarlyAccess: await hasEarlyAccess(session, parsed.data) } }
}
