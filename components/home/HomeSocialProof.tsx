import Link from 'next/link'
import { ArrowRight, Star } from '@phosphor-icons/react/dist/ssr'
import type { HomeReviewHighlight, HomeReviewSummary } from '@/components/home/types'

interface HomeSocialProofProps {
  summary: HomeReviewSummary
  highlights: HomeReviewHighlight[]
}

function StarRow({ rating }: { rating: number }) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)))

  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={`star-${index}`}
          size={14}
          weight={index < rounded ? 'fill' : 'regular'}
          className={index < rounded ? 'text-black' : 'text-black/20'}
        />
      ))}
    </div>
  )
}

export function HomeSocialProof({ summary, highlights }: HomeSocialProofProps) {
  return (
    <section
      id="home-social-proof"
      data-testid="home-social-proof"
      aria-labelledby="home-social-proof-title"
      className="border-b border-black/10 bg-white"
    >
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Social proof</p>
            <h2 id="home-social-proof-title" className="mt-2 text-3xl font-black tracking-tight text-black sm:text-4xl">
              What customers are saying.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
              Real feedback from approved reviews across the shop.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 transition-colors hover:text-black"
          >
            Read reviews
            <ArrowRight size={12} weight="bold" />
          </Link>
        </div>

        <div className="mt-8 rounded-2xl border border-black/10 bg-neutral-50 p-6">
          {summary.totalReviews === 0 ? (
            <p className="text-sm text-black/65">
              No approved reviews yet. Be the first to share your feedback after your first order.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-4">
              <p className="text-4xl font-black tracking-tight text-black">{summary.averageRating.toFixed(1)}</p>
              <div className="pb-1">
                <StarRow rating={summary.averageRating} />
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-black/55">
                  {summary.totalReviews} approved review{summary.totalReviews === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}
        </div>

        {summary.totalReviews > 0 && highlights.length > 0 && (
          <ul className="mt-6 grid gap-4 md:grid-cols-3" role="list" aria-label="Review highlights">
            {highlights.map((highlight) => (
              <li key={highlight.id} className="rounded-2xl border border-black/10 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <StarRow rating={highlight.rating} />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">
                    {highlight.customerName}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-black/70">“{highlight.snippet}”</p>
                <Link
                  href={`/products/${highlight.productSlug}`}
                  className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/65 hover:text-black"
                >
                  {highlight.productName}
                  <ArrowRight size={12} weight="bold" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
