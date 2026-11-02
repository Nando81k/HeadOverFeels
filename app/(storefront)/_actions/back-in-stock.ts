'use server'

import { z } from 'zod'

import { hasCustomerAccountEnv } from '@/lib/shopify/customer/env'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import { resolveCustomer } from '@/lib/loyalty/shopify-bridge'
import { normalizeEmail, subscribe } from '@/lib/storefront/back-in-stock'
import {
  BACK_IN_STOCK_EMAIL_ERROR,
  BACK_IN_STOCK_GENERIC_ERROR as GENERIC_ERROR,
  type BackInStockFormState,
} from '@/lib/storefront/back-in-stock-form'

/**
 * Back-in-stock Server Action (Phase 5, Task 3). Signed-in customers subscribe
 * with their account email in one click; guests type an email. Nothing here
 * touches Shopify; a database outage answers with a plain error. Only async
 * functions may be exported here; the state type and copy live in
 * `lib/storefront/back-in-stock-form.ts`.
 */

const schema = z.object({
  variantId: z.string().trim().min(1).max(255).startsWith('gid://shopify/ProductVariant/'),
  handle: z.string().trim().min(1).max(255),
  email: z.string().trim().email(BACK_IN_STOCK_EMAIL_ERROR).max(254),
  /** Honeypot. */
  website: z.string().max(0).optional(),
})

function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function subscribeBackInStockAction(
  _prev: BackInStockFormState,
  formData: FormData
): Promise<BackInStockFormState> {
  const typed = field(formData, 'email')
  const values = { email: typed }

  // Signed in: the account email wins over anything typed.
  let customerId: string | null = null
  let email = typed
  if (hasCustomerAccountEnv()) {
    const session = await getCustomerSession()
    if (session) {
      email = session.email
      try {
        const customer = await resolveCustomer({
          shopifyCustomerId: session.customerId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
        })
        customerId = customer.id
      } catch (error) {
        // The alert still works by email alone.
        console.warn(`[back-in-stock] customer link skipped: ${errorMessage(error)}`)
      }
    }
  }

  const parsed = schema.safeParse({
    variantId: field(formData, 'variantId'),
    handle: field(formData, 'handle'),
    email,
    website: field(formData, 'website') || undefined,
  })
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.find((issue) => issue.path[0] === 'email')
    if (emailIssue) return { status: 'error', error: BACK_IN_STOCK_EMAIL_ERROR, code: 'INVALID_EMAIL', values }
    return { status: 'error', error: GENERIC_ERROR, values }
  }

  try {
    const result = await subscribe({
      variantId: parsed.data.variantId,
      handle: parsed.data.handle,
      email: normalizeEmail(parsed.data.email),
      customerId,
    })
    return { status: 'success', email: result.email }
  } catch (error) {
    console.error(`[back-in-stock] subscribe failed: ${errorMessage(error)}`)
    return { status: 'error', error: GENERIC_ERROR, values }
  }
}
