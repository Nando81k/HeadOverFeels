'use server'

import type { SupportPriority, SupportTicketType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CONTACT_FAILURE_MESSAGE,
  CONTACT_INVALID_MESSAGE,
  CONTACT_SENT_MESSAGE,
  CONTACT_SUBJECTS,
  contactSchema,
  type ContactState,
} from '@/lib/storefront/contact'

/**
 * Contact-page server action (Phase 4, Task 8).
 *
 * The legacy page faked its submit with a timer. This one writes a real
 * support ticket through the same anonymous path `POST /api/support/tickets`
 * exposes (no auth, a customer row is optional), so the message lands in the
 * admin support inbox like any other ticket. Prisma is called directly rather
 * than fetching our own route handler from the server.
 */

/** Same rule as `POST /api/support/tickets`: GENERAL and PRODUCT_QUESTION are low priority. */
function priorityFor(type: SupportTicketType): SupportPriority {
  return type === 'PRODUCT_QUESTION' || type === 'GENERAL' ? 'LOW' : 'MEDIUM'
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function submitContactAction(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  // Invisible anti-bot field (same pattern as the newsletter form): answer
  // exactly like a real success so a bot learns nothing, and never write a row.
  const honeypot = formData.get('company')
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { status: 'success', message: CONTACT_SENT_MESSAGE }
  }

  const parsed = contactSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    subject: field(formData, 'subject'),
    message: field(formData, 'message'),
  })
  if (!parsed.success) {
    return { status: 'error', message: CONTACT_INVALID_MESSAGE }
  }

  const { name, email, subject, message } = parsed.data
  const option = CONTACT_SUBJECTS.find((entry) => entry.value === subject)
  if (!option) {
    return { status: 'error', message: CONTACT_INVALID_MESSAGE }
  }

  try {
    // Ticket numbers follow the route handler's scheme so the admin inbox
    // stays one sequence.
    const ticketCount = await prisma.supportTicket.count()
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(6, '0')}`

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        type: option.type,
        priority: priorityFor(option.type),
        subject: `${option.label} — ${name}`,
        customerEmail: email.toLowerCase(),
        customerName: name,
        messages: {
          create: {
            message,
            senderType: 'customer',
            senderName: name,
          },
        },
      },
      select: { ticketNumber: true },
    })

    return { status: 'success', message: CONTACT_SENT_MESSAGE, ticketNumber: ticket.ticketNumber }
  } catch (error) {
    // Message only: the body is the visitor's and would otherwise land in the
    // server log next to their address.
    console.error(
      `[storefront] contact ticket failed: ${error instanceof Error ? error.message : String(error)}`
    )
    return { status: 'error', message: CONTACT_FAILURE_MESSAGE }
  }
}
