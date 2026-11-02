/**
 * Back-in-stock email sender shared by the legacy Prisma-keyed trigger
 * (`lib/back-in-stock/index.ts`) and the storefront-v2 Shopify-keyed path
 * (`lib/storefront/back-in-stock.ts`, Phase 5). Takes plain strings so a
 * product that exists only in Shopify can be announced too.
 */

import { Resend } from 'resend'
import { render } from '@react-email/components'
import BackInStockEmail from '@/emails/BackInStock'

export interface BackInStockEmailInput {
  to: string
  customerName?: string
  productTitle: string
  /** "M / Black" — appended to the product title in the subject and body. */
  variantTitle?: string | null
  productUrl: string
  productImage?: string
  unsubscribeUrl: string
}

export type SendResult = { ok: true } | { ok: false; error: string }

let client: Resend | null | undefined

function resend(): Resend | null {
  if (client !== undefined) return client
  client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  return client
}

/** Test hook: forget the cached client so a changed env takes effect. */
export function resetBackInStockEmailClient(): void {
  client = undefined
}

export function isBackInStockEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM || 'Head Over Feels <notifications@headoverfeels.com>'
}

/** "Core Hoodie — M / Black", or just the title for a single-variant product. */
export function emailProductName(productTitle: string, variantTitle?: string | null): string {
  const variant = variantTitle?.trim()
  if (!variant || variant === 'Default Title') return productTitle
  return `${productTitle} — ${variant}`
}

export async function sendBackInStockEmail(input: BackInStockEmailInput): Promise<SendResult> {
  const api = resend()
  if (!api) return { ok: false, error: 'RESEND_API_KEY is not configured' }

  const productName = emailProductName(input.productTitle, input.variantTitle)
  try {
    const html = await render(
      BackInStockEmail({
        customerName: input.customerName,
        productName,
        productImage: input.productImage,
        productUrl: input.productUrl,
        unsubscribeUrl: input.unsubscribeUrl,
      })
    )
    const { error } = await api.emails.send({
      from: emailFrom(),
      to: input.to,
      subject: `${productName} is back in stock`,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
