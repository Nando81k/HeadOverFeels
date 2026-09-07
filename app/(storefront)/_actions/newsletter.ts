'use server'

import { z } from 'zod'
import { subscribeToNewsletter } from '@/lib/newsletter/subscribers'

/**
 * Footer newsletter server action.
 *
 * Message copy is kept identical to `app/api/newsletter/route.ts` so the two
 * entry points stay indistinguishable while the legacy JSON endpoint survives
 * (see the Phase 2 plan, "Legacy surface").
 */

export type NewsletterState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const SUBSCRIBED_MESSAGE = "Thanks for subscribing! You're on the list."
const ALREADY_SUBSCRIBED_MESSAGE = "You're already subscribed to our newsletter!"
const RESUBSCRIBED_MESSAGE = "Welcome back! You've been resubscribed to our newsletter."
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.'
const FAILURE_MESSAGE = 'Failed to subscribe. Please try again.'

/** Where these subscriptions come from, for the admin's source breakdown. */
const SOURCE = 'storefront-footer'

const emailSchema = z.email()

export async function subscribeNewsletterAction(
  _prev: NewsletterState,
  formData: FormData
): Promise<NewsletterState> {
  // Invisible anti-bot field: answer exactly like a real success so a bot
  // learns nothing, and never write a row.
  const honeypot = formData.get('company')
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { status: 'success', message: SUBSCRIBED_MESSAGE }
  }

  const raw = formData.get('email')
  const parsed = emailSchema.safeParse(typeof raw === 'string' ? raw.trim() : '')
  if (!parsed.success) {
    return { status: 'error', message: INVALID_EMAIL_MESSAGE }
  }

  try {
    const result = await subscribeToNewsletter({ email: parsed.data, source: SOURCE })

    if (result.alreadySubscribed) {
      return { status: 'success', message: ALREADY_SUBSCRIBED_MESSAGE }
    }
    if (result.reactivated) {
      return { status: 'success', message: RESUBSCRIBED_MESSAGE }
    }
    return { status: 'success', message: SUBSCRIBED_MESSAGE }
  } catch (error) {
    // Message only: the address is the visitor's, and a stack trace here would
    // travel straight into the server log next to it.
    console.error(
      `[storefront] newsletter subscribe failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return { status: 'error', message: FAILURE_MESSAGE }
  }
}
