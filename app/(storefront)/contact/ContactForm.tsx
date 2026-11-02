'use client'

import * as React from 'react'
import { Send } from 'lucide-react'
import { submitContactAction } from '@/app/(storefront)/_actions/contact'
import { Button } from '@/components/storefront/ui/Button'
import { fieldHintClass, fieldLabelClass, Input } from '@/components/storefront/ui/Input'
import { Select } from '@/components/storefront/ui/Select'
import {
  CONTACT_INITIAL_STATE,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_SUBJECTS,
} from '@/lib/storefront/contact'
import { cn } from '@/lib/storefront/cn'

export interface ContactFormProps {
  /** Injected in tests; defaults to the server action. */
  action?: typeof submitContactAction
  className?: string
  /** Id of the heading that names the form. */
  'aria-labelledby'?: string
}

const TEXTAREA_CLASS = [
  'min-h-40 w-full resize-y rounded-sharp border border-line-strong bg-paper px-4 py-3 text-sm text-ink',
  'placeholder:text-ink-mute',
  'transition-colors duration-sf-fast ease-sf-out',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
].join(' ')

/**
 * Contact form island (Phase 4, Task 8). Same progressive-enhancement shape
 * as `NewsletterForm`: a plain form that posts to the server action with or
 * without JS, and the returned `ContactState` is the only thing rendered
 * back. On success the fields give way to the confirmation.
 */
export function ContactForm({
  action = submitContactAction,
  className,
  'aria-labelledby': ariaLabelledBy,
}: ContactFormProps) {
  const [state, formAction, pending] = React.useActionState(action, CONTACT_INITIAL_STATE)
  const messageId = React.useId()
  const succeeded = state.status === 'success'

  return (
    <form
      action={formAction}
      aria-labelledby={ariaLabelledBy}
      className={cn('flex flex-col gap-6', className)}
      data-contact-form
    >
      {succeeded ? null : (
        <>
          <Input
            label="Name"
            name="name"
            type="text"
            required
            maxLength={120}
            autoComplete="name"
            placeholder="Your name"
          />
          <Input
            label="Email"
            name="email"
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            placeholder="your@email.com"
          />
          <Select label="Subject" name="subject" required defaultValue="">
            <option value="" disabled>
              Select a subject
            </option>
            {CONTACT_SUBJECTS.map((subject) => (
              <option key={subject.value} value={subject.value}>
                {subject.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-2">
            <label htmlFor={messageId} className={fieldLabelClass}>
              Message
            </label>
            <textarea
              id={messageId}
              name="message"
              required
              rows={6}
              maxLength={CONTACT_MESSAGE_MAX_LENGTH}
              aria-describedby={`${messageId}-hint`}
              placeholder="Tell us what's on your mind..."
              className={TEXTAREA_CLASS}
            />
            <p id={`${messageId}-hint`} className={fieldHintClass}>
              We reply within 24 hours on business days.
            </p>
          </div>

          {/* Honeypot: invisible to people, irresistible to bots. Hidden from
              the accessibility tree and skipped by the tab order, so only a
              script ever fills it in. */}
          <div aria-hidden="true">
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="sr-only"
            />
          </div>

          <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
            <Send aria-hidden="true" className="size-4" />
            Send Message
          </Button>
        </>
      )}

      {state.message ? (
        succeeded ? (
          <p role="status" className="text-base">
            {state.message}
            {state.ticketNumber ? (
              <span className="mt-1 block font-mono text-xs text-ink-mute">
                Reference {state.ticketNumber}
              </span>
            ) : null}
          </p>
        ) : (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        )
      ) : null}
    </form>
  )
}
