import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import { CONTACT_DETAILS } from '@/lib/storefront/contact'
import { ContactForm } from './ContactForm'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Have questions? We'd love to hear from you. Send us a message or reach out by email, phone or in store.",
}

/** Copy carried over from the legacy `app/contact/page.tsx`; one source for the test. */
export const CONTACT_COPY = {
  hero: { heading: 'Get in Touch', lede: "Have questions? We'd love to hear from you" },
  form: {
    heading: 'Send us a Message',
    lede: "Fill out the form below and we'll get back to you within 24 hours",
  },
  info: { heading: 'Contact Information', lede: 'Reach out through any of these channels' },
  social: 'Follow Us',
  hours: 'Store Hours',
  faq: {
    heading: 'Got Questions?',
    lede: 'Check out our FAQ section for quick answers to common questions',
    cta: { label: 'View FAQs', href: '/pages/faq' },
  },
} as const

const CHANNEL_ICON_CLASS = 'flex size-12 shrink-0 items-center justify-center rounded-sharp bg-ink text-bone'

function Channel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Mail
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-4">
      <span className={CHANNEL_ICON_CLASS}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  )
}

/**
 * Contact page (Phase 4, Task 8: port of the legacy page onto the storefront
 * primitives). The form posts a real support ticket through
 * `submitContactAction`; the details column is static copy.
 */
export default function ContactPage() {
  const { hero, form, info, social, hours, faq } = CONTACT_COPY
  const { email, phone, address, social: socialLinks, storeHours } = CONTACT_DETAILS

  return (
    <>
      <Section size="narrow" aria-labelledby="contact-hero" className="border-b border-line">
        <div className="flex flex-col items-center gap-4 text-center">
          <Eyebrow>Contact</Eyebrow>
          <Display as="h1" id="contact-hero" size="lg">
            {hero.heading}
          </Display>
          <p className="text-lg text-ink-soft">{hero.lede}</p>
        </div>
      </Section>

      <Section aria-label="Contact form and details">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-gutter">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Display as="h2" id="contact-form" size="md">
                {form.heading}
              </Display>
              <p className="text-base text-ink-soft">{form.lede}</p>
            </div>
            <ContactForm aria-labelledby="contact-form" />
          </div>

          <div className="flex flex-col gap-8 lg:pl-gutter">
            <div className="flex flex-col gap-3">
              <Display as="h2" id="contact-info" size="md">
                {info.heading}
              </Display>
              <p className="text-base text-ink-soft">{info.lede}</p>
            </div>

            <div className="flex flex-col gap-6">
              <Channel icon={Mail} title="Email">
                <a href={`mailto:${email}`} className="text-ink-soft underline-offset-4 hover:underline">
                  {email}
                </a>
              </Channel>
              <Channel icon={Phone} title="Phone">
                <a href={phone.href} className="text-ink-soft underline-offset-4 hover:underline">
                  {phone.display}
                </a>
                <p className="text-sm text-ink-mute">{phone.hours}</p>
              </Channel>
              <Channel icon={MapPin} title="Address">
                <address className="not-italic text-ink-soft">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </Channel>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold">{social}</h3>
              <ul className="flex gap-3">
                {socialLinks.map((link) => (
                  <li key={link.label}>
                    <Button asChild variant="outline" size="sm">
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3 rounded-sharp border border-line bg-paper p-6">
              <h3 className="text-base font-semibold">{hours}</h3>
              <dl className="flex flex-col gap-2 text-sm">
                {storeHours.map((row) => (
                  <div key={row.days} className="flex justify-between gap-4">
                    <dt className="text-ink-soft">{row.days}</dt>
                    <dd className="font-semibold">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="paper" size="narrow" aria-labelledby="contact-faq">
        <div className="flex flex-col items-center gap-4 text-center">
          <Display as="h2" id="contact-faq" size="md">
            {faq.heading}
          </Display>
          <p className="text-base text-ink-soft">{faq.lede}</p>
          <Button asChild variant="outline" size="lg">
            <Link href={faq.cta.href}>{faq.cta.label}</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
