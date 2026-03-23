import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'

export function HomeNewsletter() {
  return (
    <section
      id="home-newsletter"
      data-testid="home-newsletter"
      aria-labelledby="home-newsletter-title"
      className="border-b border-black/10 bg-neutral-50"
    >
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
        <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_30px_90px_-65px_rgba(0,0,0,0.45)]">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:p-12">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/55">Newsletter</p>
              <h2 id="home-newsletter-title" className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-black sm:text-4xl">
                Get first access to drops, restocks, and exclusive offers.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/65 sm:text-base">
                Stay in the loop with product alerts, launch reminders, and curated wellness updates from Head Over Feels.
              </p>

              <ul className="mt-6 grid gap-2 text-sm font-medium text-black/75 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden="true" />
                  Early drop notifications
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden="true" />
                  Restock and low-stock alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden="true" />
                  Subscriber-only promotions
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-black" aria-hidden="true" />
                  One-click unsubscribe anytime
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-black/12 bg-neutral-50 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">Join the community</p>
              <p className="mt-2 text-sm leading-relaxed text-black/65">
                Get concise updates only when it matters.
              </p>

              <div className="mt-4">
                <NewsletterSignup
                  source="homepage"
                  sourceDetails="homepage-premium-newsletter-block"
                  variant="inline"
                  className="[&_form]:flex-col [&_form]:gap-2.5 [&_input]:h-11 [&_input]:rounded-xl [&_input]:border-black/15 [&_input]:bg-white [&_input]:px-4 [&_input]:text-[15px] [&_button]:h-11 [&_button]:items-center [&_button]:justify-center [&_button]:rounded-xl [&_button]:px-5 [&_button]:text-xs [&_button]:font-semibold [&_button]:uppercase [&_button]:tracking-[0.12em]"
                />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-black/45">
                By subscribing, you agree to receive marketing emails. You can unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
