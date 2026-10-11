import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Heart, Leaf, ShieldCheck, Sparkles, Target, Users, Zap } from 'lucide-react'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Head Over Feels was born from a simple belief: streetwear should be more than just fashion. Our story, our values and why we do it.',
}

/**
 * Copy carried over verbatim from the legacy `app/about/page.tsx` (Phase 4,
 * Task 8). Exported so the unit test asserts against one source.
 */
export const ABOUT_COPY = {
  hero: {
    eyebrow: 'Our Story',
    headline: ['Where', 'Culture', 'Meets Soul'],
    descriptor:
      'Streetwear should be more than fashion. It should be a canvas for self-expression.',
  },
  story: {
    eyebrow: 'The Beginning',
    heading: 'Born from Passion',
    paragraphs: [
      'Head Over Feels was born from a simple belief: streetwear should be more than just fashion. It should be a canvas for self-expression, a statement of authenticity, and a celebration of urban culture.',
      'Founded in 2025, we set out to create pieces that resonate with those who dare to be different. Every hoodie, every tee, every accessory we design tells a story—your story.',
      "We blend premium quality with contemporary design, ensuring that when you wear Head Over Feels, you're not just wearing clothes—you're wearing confidence, creativity, and culture.",
    ],
  },
  values: {
    eyebrow: 'What We Stand For',
    heading: 'Our Values',
    items: [
      {
        icon: Heart,
        title: 'Authenticity',
        description: 'We believe in staying true to yourself. Our designs celebrate individuality.',
      },
      {
        icon: Sparkles,
        title: 'Quality First',
        description: 'Premium materials and meticulous craftsmanship in every piece.',
      },
      {
        icon: Users,
        title: 'Community',
        description: 'Our community is at the heart of everything we do.',
      },
      {
        icon: Leaf,
        title: 'Sustainability',
        description: 'Responsible choices and ethical manufacturing practices.',
      },
    ],
  },
  stats: [
    { value: '2025', label: 'Founded' },
    { value: '10K+', label: 'Community Members' },
    { value: '100%', label: 'Ethically Made' },
    { value: '4.9', label: 'Customer Rating' },
  ],
  mission: {
    eyebrow: 'Our Mission',
    statement:
      'To empower individuals through authentic streetwear that breaks boundaries, challenges norms, and celebrates the raw, unfiltered beauty of urban expression.',
    tagline: 'Powered by Passion',
  },
  difference: {
    eyebrow: 'The Difference',
    heading: 'Why Head Over Feels?',
    items: [
      {
        icon: ShieldCheck,
        title: 'Premium Quality',
        description:
          'Every piece is crafted with attention to detail using premium materials that last.',
      },
      {
        icon: Target,
        title: 'Limited Drops',
        description:
          'Exclusive releases ensure you stand out with unique pieces not everyone has.',
      },
      {
        icon: Heart,
        title: 'Community First',
        description: 'Join a community of like-minded individuals who value authenticity.',
      },
    ],
  },
  cta: {
    eyebrow: 'Join the Movement',
    heading: 'Ready to Express Yourself?',
    body: 'Explore our collections and find pieces that speak to your soul. Join thousands who wear their feelings on their sleeve.',
    shop: { label: 'Shop Collection', href: '/collections/all' },
    contact: { label: 'Get in Touch', href: '/contact' },
  },
} as const

const CARD_CLASS = 'flex flex-col gap-4 rounded-sharp border p-6 sm:p-8'
const ICON_TILE_CLASS = 'flex size-12 items-center justify-center rounded-sharp'

/**
 * Brand story (Phase 4, Task 8: port of the legacy About page onto the
 * storefront primitives). Static copy, no data, cacheable forever; the
 * section rhythm follows design spec §5.3 and the colour comes from
 * `Section` tones rather than per-element classes.
 */
export default function AboutPage() {
  const { hero, story, values, stats, mission, difference, cta } = ABOUT_COPY

  return (
    <>
      <Section tone="ink" aria-labelledby="about-hero">
        <div className="flex flex-col gap-8">
          <Eyebrow className="text-bone/60">{hero.eyebrow}</Eyebrow>
          <Display as="h1" id="about-hero" size="xl">
            {hero.headline.map((line, index) => (
              <span key={line} className={index === 0 ? undefined : 'block'}>
                {line}
              </span>
            ))}
          </Display>
          <p className="max-w-sm text-base text-bone/70">{hero.descriptor}</p>
        </div>
      </Section>

      <Section size="narrow" aria-labelledby="about-story">
        <div className="flex flex-col items-center gap-6 text-center">
          <Eyebrow>{story.eyebrow}</Eyebrow>
          <Display as="h2" id="about-story" size="lg">
            {story.heading}
          </Display>
          <div className="flex flex-col gap-5 text-lg text-ink-soft">
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="ink" aria-labelledby="about-values">
        <div className="flex flex-col items-center gap-6 text-center">
          <Eyebrow className="text-bone/60">{values.eyebrow}</Eyebrow>
          <Display as="h2" id="about-values" size="lg">
            {values.heading}
          </Display>
        </div>
        <ul className="mt-12 grid gap-gutter md:grid-cols-2 lg:grid-cols-4">
          {values.items.map((value) => (
            <li key={value.title} className={`${CARD_CLASS} border-bone/15 bg-bone/5`}>
              <span className={`${ICON_TILE_CLASS} bg-bone text-ink`}>
                <value.icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="text-lg font-semibold text-bone">{value.title}</h3>
              <p className="text-sm text-bone/70">{value.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-label="Head Over Feels in numbers">
        <dl className="grid grid-cols-2 gap-gutter text-center md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-2">
              <dd className="font-display text-display-md font-black tracking-display">
                {stat.value}
              </dd>
              <dt className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="ink" size="narrow" aria-labelledby="about-mission">
        <div className="flex flex-col items-center gap-8 text-center">
          <Eyebrow className="text-bone/60">{mission.eyebrow}</Eyebrow>
          <Display as="h2" id="about-mission" size="md" className="normal-case tracking-normal">
            {mission.statement}
          </Display>
          <p className="flex items-center gap-3 text-xs uppercase tracking-eyebrow text-bone/60">
            <Zap aria-hidden="true" className="size-4" />
            {mission.tagline}
            <Zap aria-hidden="true" className="size-4" />
          </p>
        </div>
      </Section>

      <Section tone="paper" aria-labelledby="about-difference">
        <div className="flex flex-col items-center gap-6 text-center">
          <Eyebrow>{difference.eyebrow}</Eyebrow>
          <Display as="h2" id="about-difference" size="lg">
            {difference.heading}
          </Display>
        </div>
        <ul className="mt-12 grid gap-gutter md:grid-cols-3">
          {difference.items.map((feature) => (
            <li key={feature.title} className={`${CARD_CLASS} border-line bg-bone`}>
              <span className={`${ICON_TILE_CLASS} bg-ink text-bone`}>
                <feature.icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-ink-soft">{feature.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section size="narrow" aria-labelledby="about-cta" className="border-t border-line">
        <div className="flex flex-col items-center gap-6 text-center">
          <Eyebrow>{cta.eyebrow}</Eyebrow>
          <Display as="h2" id="about-cta" size="lg">
            {cta.heading}
          </Display>
          <p className="max-w-prose text-lg text-ink-soft">{cta.body}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={cta.shop.href}>
                {cta.shop.label}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={cta.contact.href}>{cta.contact.label}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
