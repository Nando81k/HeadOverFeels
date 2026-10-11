import { z } from 'zod'
import type { SupportTicketType } from '@prisma/client'

/**
 * Contact form contract (Phase 4, Task 8), shared by the server action, the
 * form island and the tests. Lives outside the `'use server'` module because
 * such a module may only export async functions.
 */

export type ContactState = {
  status: 'idle' | 'success' | 'error'
  message: string
  /** Set on success so the page can show the reference. */
  ticketNumber?: string
}

export const CONTACT_INITIAL_STATE: ContactState = { status: 'idle', message: '' }

/** Subject options; the `value` is what the `<select>` posts. */
export const CONTACT_SUBJECTS = [
  { value: 'order', label: 'Order Inquiry', type: 'ORDER_ISSUE' },
  { value: 'product', label: 'Product Question', type: 'PRODUCT_QUESTION' },
  { value: 'collaboration', label: 'Collaboration', type: 'GENERAL' },
  { value: 'feedback', label: 'Feedback', type: 'GENERAL' },
  { value: 'other', label: 'Other', type: 'GENERAL' },
] as const satisfies readonly { value: string; label: string; type: SupportTicketType }[]

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]['value']

export const CONTACT_SENT_MESSAGE = "Thank you! We'll get back to you soon."
export const CONTACT_INVALID_MESSAGE = 'Check the highlighted fields and try again.'
export const CONTACT_FAILURE_MESSAGE =
  'We could not send your message. Please try again or email hello@headoverfeels.com.'

export const CONTACT_MESSAGE_MAX_LENGTH = 4000

const SUBJECT_VALUES = CONTACT_SUBJECTS.map((subject) => subject.value) as [
  ContactSubject,
  ...ContactSubject[],
]

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().max(255),
  subject: z.enum(SUBJECT_VALUES),
  message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX_LENGTH),
})

export type ContactInput = z.infer<typeof contactSchema>

/** Static contact details carried over from the legacy page. */
export const CONTACT_DETAILS = {
  email: 'hello@headoverfeels.com',
  phone: { display: '+1 (555) 123-4567', href: 'tel:+15551234567', hours: 'Mon-Fri, 9am-6pm EST' },
  address: ['123 Street Culture Ave', 'Brooklyn, NY 11211', 'United States'],
  social: [
    { label: 'Instagram', href: 'https://instagram.com' },
    { label: 'Twitter', href: 'https://twitter.com' },
    { label: 'Facebook', href: 'https://facebook.com' },
  ],
  storeHours: [
    { days: 'Monday - Friday', hours: '10am - 8pm' },
    { days: 'Saturday', hours: '11am - 7pm' },
    { days: 'Sunday', hours: '12pm - 6pm' },
  ],
} as const
