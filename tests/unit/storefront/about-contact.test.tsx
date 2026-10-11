// tests/unit/storefront/about-contact.test.tsx
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The form's default action is the server action, which reaches Prisma. The
// action's own tests below pull the real module with `vi.importActual`.
vi.mock('@/app/(storefront)/_actions/contact', () => ({
  submitContactAction: vi.fn(async () => ({ status: 'idle', message: '' })),
}))

const prisma = {
  supportTicket: {
    count: vi.fn(),
    create: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({ prisma }))

import AboutPage, { ABOUT_COPY, metadata as aboutMetadata } from '@/app/(storefront)/about/page'
import ContactPage, {
  CONTACT_COPY,
  metadata as contactMetadata,
} from '@/app/(storefront)/contact/page'
import { ContactForm } from '@/app/(storefront)/contact/ContactForm'
import {
  CONTACT_DETAILS,
  CONTACT_FAILURE_MESSAGE,
  CONTACT_INVALID_MESSAGE,
  CONTACT_SENT_MESSAGE,
  CONTACT_SUBJECTS,
  type ContactState,
} from '@/lib/storefront/contact'

type ContactAction = (prev: ContactState, formData: FormData) => Promise<ContactState>

function stubAction(next: ContactState) {
  return vi.fn<ContactAction>(async () => next)
}

afterEach(cleanup)

/* ------------------------------------------------------------------ About */

describe('app/(storefront)/about', () => {
  it('sets the page title for the layout template', () => {
    expect(aboutMetadata.title).toBe('About')
  })

  it('renders the hero, story, values, stats, mission and difference copy', () => {
    render(<AboutPage />)

    const hero = screen.getByRole('heading', { level: 1 })
    expect(hero).toHaveTextContent(/where/i)
    expect(hero).toHaveTextContent(/culture/i)
    expect(hero).toHaveTextContent(/meets soul/i)
    expect(screen.getByText(ABOUT_COPY.hero.descriptor)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: ABOUT_COPY.story.heading })).toBeInTheDocument()
    for (const paragraph of ABOUT_COPY.story.paragraphs) {
      expect(screen.getByText(paragraph)).toBeInTheDocument()
    }

    expect(screen.getByRole('heading', { name: ABOUT_COPY.values.heading })).toBeInTheDocument()
    for (const value of ABOUT_COPY.values.items) {
      expect(screen.getByRole('heading', { name: value.title, level: 3 })).toBeInTheDocument()
      expect(screen.getByText(value.description)).toBeInTheDocument()
    }

    for (const stat of ABOUT_COPY.stats) {
      expect(screen.getByText(stat.value)).toBeInTheDocument()
      expect(screen.getByText(stat.label)).toBeInTheDocument()
    }

    expect(
      screen.getByRole('heading', { name: ABOUT_COPY.mission.statement })
    ).toBeInTheDocument()
    expect(screen.getByText(ABOUT_COPY.mission.tagline)).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: ABOUT_COPY.difference.heading })
    ).toBeInTheDocument()
    for (const feature of ABOUT_COPY.difference.items) {
      expect(screen.getByRole('heading', { name: feature.title, level: 3 })).toBeInTheDocument()
    }
  })

  it('links the CTA to the catalog and the contact page (no legacy /products)', () => {
    render(<AboutPage />)

    expect(screen.getByRole('link', { name: ABOUT_COPY.cta.shop.label })).toHaveAttribute(
      'href',
      '/collections/all'
    )
    expect(screen.getByRole('link', { name: ABOUT_COPY.cta.contact.label })).toHaveAttribute(
      'href',
      '/contact'
    )
    const legacy = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/products')
    expect(legacy).toHaveLength(0)
  })

  it('uses the section primitives rather than the legacy navigation', () => {
    const { container } = render(<AboutPage />)

    // Every block is a `Section` with the page rhythm class; no hard-coded
    // colours, no `<nav>` of its own (the storefront shell owns the header).
    const sections = container.querySelectorAll('section.py-section')
    expect(sections.length).toBeGreaterThanOrEqual(6)
    expect(container.querySelector('nav')).toBeNull()
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i)
  })
})

/* ---------------------------------------------------------------- Contact */

describe('app/(storefront)/contact', () => {
  it('sets the page title for the layout template', () => {
    expect(contactMetadata.title).toBe('Contact')
  })

  it('renders the hero, the form and the contact details', () => {
    render(<ContactPage />)

    expect(screen.getByRole('heading', { level: 1, name: CONTACT_COPY.hero.heading })).toBeInTheDocument()
    expect(screen.getByText(CONTACT_COPY.hero.lede)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: CONTACT_COPY.form.heading })).toBeInTheDocument()
    expect(screen.getByText(CONTACT_COPY.form.lede)).toBeInTheDocument()

    // The form is labelled by its heading.
    const form = screen.getByRole('form', { name: CONTACT_COPY.form.heading })
    expect(within(form).getByLabelText('Name')).toBeInTheDocument()
    expect(within(form).getByLabelText('Email')).toBeInTheDocument()
    expect(within(form).getByLabelText('Subject')).toBeInTheDocument()
    expect(within(form).getByLabelText('Message')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Send Message' })).toHaveAttribute(
      'type',
      'submit'
    )

    expect(screen.getByRole('heading', { name: CONTACT_COPY.info.heading })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: CONTACT_DETAILS.email })).toHaveAttribute(
      'href',
      `mailto:${CONTACT_DETAILS.email}`
    )
    expect(screen.getByRole('link', { name: CONTACT_DETAILS.phone.display })).toHaveAttribute(
      'href',
      CONTACT_DETAILS.phone.href
    )
    expect(screen.getByText(CONTACT_DETAILS.phone.hours)).toBeInTheDocument()
    for (const line of CONTACT_DETAILS.address) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }
    for (const link of CONTACT_DETAILS.social) {
      const anchor = screen.getByRole('link', { name: link.label })
      expect(anchor).toHaveAttribute('href', link.href)
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    }
    for (const row of CONTACT_DETAILS.storeHours) {
      expect(screen.getByText(row.days)).toBeInTheDocument()
      expect(screen.getByText(row.hours)).toBeInTheDocument()
    }
  })

  it('links the FAQ teaser to the FAQ page instead of a dead button', () => {
    render(<ContactPage />)

    expect(screen.getByRole('link', { name: CONTACT_COPY.faq.cta.label })).toHaveAttribute(
      'href',
      CONTACT_COPY.faq.cta.href
    )
    expect(screen.queryByRole('button', { name: CONTACT_COPY.faq.cta.label })).toBeNull()
  })

  it('uses the section primitives rather than the legacy navigation', () => {
    const { container } = render(<ContactPage />)
    expect(container.querySelectorAll('section.py-section').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelector('nav')).toBeNull()
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i)
  })
})

/* ------------------------------------------------------------ ContactForm */

describe('ContactForm', () => {
  it('renders the fields, the subject options, the honeypot and the submit button', () => {
    const { container } = render(<ContactForm action={stubAction({ status: 'idle', message: '' })} />)

    expect(screen.getByLabelText('Name')).toBeRequired()
    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toBeRequired()

    const subject = screen.getByLabelText('Subject') as HTMLSelectElement
    expect(subject).toBeRequired()
    const options = Array.from(subject.options).map((option) => option.value)
    expect(options).toEqual(['', ...CONTACT_SUBJECTS.map((entry) => entry.value)])
    expect(subject.value).toBe('')

    expect(screen.getByLabelText('Message')).toBeRequired()

    const honeypot = container.querySelector('input[name="company"]') as HTMLInputElement
    expect(honeypot).not.toBeNull()
    expect(honeypot).toHaveClass('sr-only')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(screen.queryByLabelText('Company')).toBeNull()
  })

  it('posts the fields to the injected action and shows the confirmation', async () => {
    const user = userEvent.setup()
    const action = stubAction({
      status: 'success',
      message: CONTACT_SENT_MESSAGE,
      ticketNumber: 'TKT-2026-000042',
    })
    render(<ContactForm action={action} />)

    await user.type(screen.getByLabelText('Name'), 'Ada Lovelace')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.selectOptions(screen.getByLabelText('Subject'), 'product')
    await user.type(screen.getByLabelText('Message'), 'Does the hoodie run large?')
    await user.click(screen.getByRole('button', { name: 'Send Message' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(CONTACT_SENT_MESSAGE)
    expect(status).toHaveTextContent('TKT-2026-000042')

    expect(action).toHaveBeenCalledTimes(1)
    const formData = action.mock.calls[0][1] as FormData
    expect(formData.get('name')).toBe('Ada Lovelace')
    expect(formData.get('email')).toBe('ada@example.com')
    expect(formData.get('subject')).toBe('product')
    expect(formData.get('message')).toBe('Does the hoodie run large?')
    expect(formData.get('company')).toBe('')

    // Nothing left to submit.
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send Message' })).toBeNull()
  })

  it('shows an error in an alert and keeps the form usable', async () => {
    const user = userEvent.setup()
    render(<ContactForm action={stubAction({ status: 'error', message: CONTACT_FAILURE_MESSAGE })} />)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.selectOptions(screen.getByLabelText('Subject'), 'other')
    await user.type(screen.getByLabelText('Message'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Send Message' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(CONTACT_FAILURE_MESSAGE)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument()
  })

  it('marks the button busy while the action is pending', async () => {
    const user = userEvent.setup()
    let resolve: (value: ContactState) => void = () => {}
    const action = vi.fn<ContactAction>(
      () =>
        new Promise<ContactState>((r) => {
          resolve = r
        })
    )
    render(<ContactForm action={action} />)

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.selectOptions(screen.getByLabelText('Subject'), 'feedback')
    await user.type(screen.getByLabelText('Message'), 'Love it')
    await user.click(screen.getByRole('button', { name: 'Send Message' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send Message' })).toHaveAttribute(
        'aria-busy',
        'true'
      )
    )

    resolve({ status: 'success', message: CONTACT_SENT_MESSAGE })
    await screen.findByRole('status')
  })
})

/* ---------------------------------------------------- submitContactAction */

describe('submitContactAction', () => {
  const INITIAL: ContactState = { status: 'idle', message: '' }

  async function loadAction() {
    const actual = await vi.importActual<typeof import('@/app/(storefront)/_actions/contact')>(
      '@/app/(storefront)/_actions/contact'
    )
    return actual.submitContactAction
  }

  function formData(fields: Record<string, string>) {
    const data = new FormData()
    for (const [key, value] of Object.entries(fields)) data.set(key, value)
    return data
  }

  const VALID = {
    name: '  Ada Lovelace ',
    email: 'Ada@Example.com',
    subject: 'order',
    message: 'Where is my order?',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prisma.supportTicket.count.mockResolvedValue(41)
    prisma.supportTicket.create.mockImplementation(async ({ data }: { data: { ticketNumber: string } }) => ({
      ticketNumber: data.ticketNumber,
    }))
  })

  it('creates a support ticket with the mapped type, priority and first message', async () => {
    const action = await loadAction()

    const result = await action(INITIAL, formData(VALID))

    expect(result).toEqual({
      status: 'success',
      message: CONTACT_SENT_MESSAGE,
      ticketNumber: `TKT-${new Date().getFullYear()}-000042`,
    })
    expect(prisma.supportTicket.create).toHaveBeenCalledTimes(1)
    const { data } = prisma.supportTicket.create.mock.calls[0][0]
    expect(data).toMatchObject({
      type: 'ORDER_ISSUE',
      priority: 'MEDIUM',
      subject: 'Order Inquiry — Ada Lovelace',
      customerEmail: 'ada@example.com',
      customerName: 'Ada Lovelace',
      messages: {
        create: {
          message: 'Where is my order?',
          senderType: 'customer',
          senderName: 'Ada Lovelace',
        },
      },
    })
    // Anonymous: never attaches a client-supplied customer id.
    expect(data).not.toHaveProperty('customerId')
  })

  it('maps general subjects to a low-priority GENERAL ticket', async () => {
    const action = await loadAction()

    await action(INITIAL, formData({ ...VALID, subject: 'feedback' }))

    expect(prisma.supportTicket.create.mock.calls[0][0].data).toMatchObject({
      type: 'GENERAL',
      priority: 'LOW',
      subject: 'Feedback — Ada Lovelace',
    })
  })

  it('rejects missing or invalid fields without touching the database', async () => {
    const action = await loadAction()

    for (const bad of [
      { ...VALID, name: '   ' },
      { ...VALID, email: 'not-an-email' },
      { ...VALID, subject: '' },
      { ...VALID, subject: 'spam' },
      { ...VALID, message: '' },
    ]) {
      const result = await action(INITIAL, formData(bad))
      expect(result).toEqual({ status: 'error', message: CONTACT_INVALID_MESSAGE })
    }
    expect(prisma.supportTicket.create).not.toHaveBeenCalled()
  })

  it('answers the honeypot like a success and writes nothing', async () => {
    const action = await loadAction()

    const result = await action(INITIAL, formData({ ...VALID, company: 'Bots Inc' }))

    expect(result).toEqual({ status: 'success', message: CONTACT_SENT_MESSAGE })
    expect(prisma.supportTicket.count).not.toHaveBeenCalled()
    expect(prisma.supportTicket.create).not.toHaveBeenCalled()
  })

  it('returns the failure message when the ticket cannot be written', async () => {
    const action = await loadAction()
    prisma.supportTicket.create.mockRejectedValue(new Error('db down'))

    const result = await action(INITIAL, formData(VALID))

    expect(result).toEqual({ status: 'error', message: CONTACT_FAILURE_MESSAGE })
  })
})
