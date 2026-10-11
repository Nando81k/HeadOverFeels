// tests/unit/storefront/newsletter-form.test.tsx
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The form's default action is the server action, which reaches Prisma.
vi.mock('@/app/(storefront)/_actions/newsletter', () => ({
  subscribeNewsletterAction: vi.fn(async () => ({ status: 'idle', message: '' })),
}))

import { NewsletterForm } from '@/components/storefront/newsletter/NewsletterForm'
import type { NewsletterState } from '@/app/(storefront)/_actions/newsletter'

afterEach(cleanup)

function stubAction(next: NewsletterState) {
  return vi.fn<(prev: NewsletterState, formData: FormData) => Promise<NewsletterState>>(
    async () => next
  )
}

describe('NewsletterForm', () => {
  it('renders the email field, honeypot and submit button', () => {
    const { container } = render(<NewsletterForm action={stubAction({ status: 'idle', message: '' })} />)

    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('name', 'email')
    expect(email).toHaveAttribute('autocomplete', 'email')
    expect(email).toBeRequired()

    const join = screen.getByRole('button', { name: 'Join' })
    expect(join).toHaveAttribute('type', 'submit')

    const honeypot = container.querySelector('input[name="company"]') as HTMLInputElement
    expect(honeypot).not.toBeNull()
    expect(honeypot).toHaveClass('sr-only')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot).toHaveAttribute('aria-hidden', 'true')
    expect(honeypot).toHaveAttribute('autocomplete', 'off')
    // Hidden from the accessibility tree, so it never reaches a screen reader.
    expect(screen.queryByLabelText('Company')).toBeNull()
  })

  it('submits the email to the injected action and shows the success message', async () => {
    const user = userEvent.setup()
    const action = stubAction({ status: 'success', message: "Thanks for subscribing! You're on the list." })
    render(<NewsletterForm action={action} />)

    await user.type(screen.getByLabelText('Email'), 'fan@example.com')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent("Thanks for subscribing! You're on the list.")

    expect(action).toHaveBeenCalledTimes(1)
    const formData = action.mock.calls[0][1] as FormData
    expect(formData.get('email')).toBe('fan@example.com')
    expect(formData.get('company')).toBe('')
  })

  it('hides the inputs once the subscription succeeded', async () => {
    const user = userEvent.setup()
    render(<NewsletterForm action={stubAction({ status: 'success', message: 'On the list.' })} />)

    await user.type(screen.getByLabelText('Email'), 'fan@example.com')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    await screen.findByRole('status')
    expect(screen.queryByLabelText('Email')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
  })

  it('renders an error message in an alert and keeps the form usable', async () => {
    const user = userEvent.setup()
    render(
      <NewsletterForm
        action={stubAction({ status: 'error', message: 'Failed to subscribe. Please try again.' })}
      />
    )

    // A syntactically invalid address never reaches the action: the field is
    // `type="email" required`, so the browser blocks the submit first.
    await user.type(screen.getByLabelText('Email'), 'fan@example.com')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Failed to subscribe. Please try again.')
    expect(alert).toHaveClass('text-danger')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders no message before the first submission', () => {
    render(<NewsletterForm action={stubAction({ status: 'idle', message: '' })} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('marks the button busy while the action is pending', async () => {
    const user = userEvent.setup()
    let resolve: (value: NewsletterState) => void = () => {}
    const action = vi.fn<(prev: NewsletterState, formData: FormData) => Promise<NewsletterState>>(
      () =>
        new Promise<NewsletterState>((r) => {
          resolve = r
        })
    )
    render(<NewsletterForm action={action} />)

    await user.type(screen.getByLabelText('Email'), 'fan@example.com')
    await user.click(screen.getByRole('button', { name: 'Join' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Join' })).toHaveAttribute('aria-busy', 'true')
    )

    resolve({ status: 'success', message: 'On the list.' })
    await screen.findByRole('status')
  })
})
