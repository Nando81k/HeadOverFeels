import { ChatCenteredDots, Package, ShieldCheck, Truck } from '@phosphor-icons/react/dist/ssr'

const TRUST_ITEMS = [
  {
    title: 'Secure Checkout',
    description: 'Encrypted payments with trusted providers.',
    Icon: ShieldCheck,
  },
  {
    title: 'Free Shipping',
    description: 'Free shipping on US orders over $75.',
    Icon: Truck,
  },
  {
    title: 'Easy Returns',
    description: 'Simple 14-day returns on eligible items.',
    Icon: Package,
  },
  {
    title: 'Fast Support',
    description: 'Real human support when you need it.',
    Icon: ChatCenteredDots,
  },
] as const

export function HomeTrustBar() {
  return (
    <section
      data-testid="home-trust-bar"
      aria-labelledby="home-trust-title"
      className="border-b border-black/10 bg-neutral-50"
    >
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <h2 id="home-trust-title" className="sr-only">
          Shopping Benefits
        </h2>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {TRUST_ITEMS.map(({ title, description, Icon }) => (
            <li key={title} className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                  <Icon size={16} weight="bold" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-black">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-black/60">{description}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
