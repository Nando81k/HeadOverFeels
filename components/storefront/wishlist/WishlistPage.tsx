'use client'

import * as React from 'react'
import Link from 'next/link'
import { wishlistCardsAction } from '@/app/(storefront)/_actions/wishlist'
import { useCart } from '@/components/storefront/cart/useCart'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display } from '@/components/storefront/ui/Typography'
import type { ProductCardVariant } from '@/lib/shopify/queries/variants'
import { cn } from '@/lib/storefront/cn'
import { useWishlist } from './useWishlist'
import { WishlistGrid, WishlistGridSkeleton, cardHref, cardState } from './WishlistGrid'

/** Entry changes within this window collapse into one card lookup. */
export const CARDS_DEBOUNCE_MS = 150

/** How long "Copied" / "Shared" stays up after the share button. */
const SHARE_FEEDBACK_MS = 2500

const SIGN_IN_HREF = '/account/login?return_to=/wishlist'

const LINK_CLASS = cn(
  'text-xs font-semibold uppercase tracking-eyebrow text-ink-soft underline underline-offset-4 decoration-line-strong',
  'transition-colors duration-sf-fast ease-sf-out hover:text-ink',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2'
)

const NOTICE_CLASS = 'flex flex-wrap items-center justify-between gap-3 border border-line bg-paper px-4 py-3 text-sm text-ink'

type CardsStatus = 'idle' | 'loading' | 'ready'

/** Share text: one PDP link per saved item, newest first. */
export function shareText(cards: ProductCardVariant[], origin: string): string {
  const lines = cards.map((card) => `${card.product.title} — ${origin}${cardHref(card)}`)
  return ['My Head Over Feels wishlist', ...lines].join('\n')
}

/**
 * The `/wishlist` page (Phase 4, Task 7, mockup board 07). Entries come from the
 * provider; card data is looked up on the client with `wishlistCardsAction`
 * whenever a variant the page has not seen yet is saved (debounced). Removing a
 * card needs no lookup — the grid is the entries projected onto the cards it
 * already holds, so it updates with the optimistic toggle.
 */
export function WishlistPage() {
  const wishlist = useWishlist()
  const cart = useCart()
  const { entries, count, status, merged, dismissMerged, toggle, error, clearError } = wishlist

  const [cardsById, setCardsById] = React.useState<ReadonlyMap<string, ProductCardVariant>>(
    () => new Map()
  )
  const [cardsStatus, setCardsStatus] = React.useState<CardsStatus>('idle')
  const [pendingVariantId, setPendingVariantId] = React.useState<string | null>(null)
  const [addingAll, setAddingAll] = React.useState(false)
  const [shareNote, setShareNote] = React.useState<string | null>(null)

  // Ids already asked for, so a removal or a known id never refetches.
  const requested = React.useRef<Set<string>>(new Set())
  const lookup = React.useRef(0)

  const key = entries.map((entry) => entry.variantId).join(',')

  React.useEffect(() => {
    if (status === 'loading') return
    const ids = key ? key.split(',') : []
    if (ids.length === 0) {
      setCardsStatus('ready')
      return
    }
    if (ids.every((id) => requested.current.has(id))) {
      setCardsStatus((current) => (current === 'idle' ? 'ready' : current))
      return
    }
    const seq = ++lookup.current
    setCardsStatus((current) => (current === 'ready' ? current : 'loading'))
    const timer = setTimeout(async () => {
      for (const id of ids) requested.current.add(id)
      let cards: ProductCardVariant[] = []
      try {
        cards = await wishlistCardsAction(ids)
      } catch {
        cards = []
      }
      if (seq !== lookup.current) return
      setCardsById((current) => {
        const next = new Map(current)
        for (const card of cards) next.set(card.id, card)
        return next
      })
      setCardsStatus('ready')
    }, CARDS_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [key, status])

  React.useEffect(() => {
    if (!shareNote) return
    const timer = setTimeout(() => setShareNote(null), SHARE_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [shareNote])

  const cards = React.useMemo(
    () =>
      entries
        .map((entry) => cardsById.get(entry.variantId))
        .filter((card): card is ProductCardVariant => Boolean(card)),
    [entries, cardsById]
  )
  const addable = React.useMemo(() => cards.filter((card) => cardState(card) === 'addable'), [cards])
  const unavailable = cardsStatus === 'ready' ? count - cards.length : 0

  const handleRemove = React.useCallback(
    (card: ProductCardVariant) => {
      void toggle(card.id, card.product.handle)
    },
    [toggle]
  )

  const handleAddToCart = React.useCallback(
    (card: ProductCardVariant) => {
      if (pendingVariantId || addingAll) return
      setPendingVariantId(card.id)
      cart.addLine({ variantId: card.id }).finally(() => setPendingVariantId(null))
    },
    [cart, pendingVariantId, addingAll]
  )

  const handleAddAll = React.useCallback(async () => {
    if (addingAll || addable.length === 0) return
    setAddingAll(true)
    try {
      let added = 0
      for (const card of addable) {
        setPendingVariantId(card.id)
        const result = await cart.addLine({ variantId: card.id }, { open: false })
        if (result.ok) added += 1
      }
      if (added > 0) cart.openDrawer()
    } finally {
      setPendingVariantId(null)
      setAddingAll(false)
    }
  }, [addingAll, addable, cart])

  const handleShare = React.useCallback(async () => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin
    const text = shareText(cards, origin)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'My wishlist', text })
        setShareNote('Shared')
        return
      }
      await navigator.clipboard.writeText(text)
      setShareNote('Copied to clipboard')
    } catch {
      setShareNote('Could not share this list')
    }
  }, [cards])

  const empty = count === 0
  const loading = status === 'loading' || (cardsStatus !== 'ready' && !empty)

  return (
    <Section aria-labelledby="wishlist-title" data-wishlist-page="" data-status={status}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <Display as="h1" size="lg" id="wishlist-title">
          Wishlist{' '}
          <span className="num font-mono text-ink-mute" data-wishlist-count="">
            [{count}]
          </span>
        </Display>
        {!empty ? (
          <div className="flex flex-wrap items-center gap-3">
            {addable.length > 0 ? (
              <Button size="sm" variant="ink" loading={addingAll} onClick={() => void handleAddAll()}>
                {addingAll ? 'Adding…' : 'Add all available to cart'}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void handleShare()} disabled={cards.length === 0}>
              Share list
            </Button>
            {shareNote ? (
              <span role="status" className="text-xs text-ink-mute">
                {shareNote}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {merged > 0 ? (
        <p role="status" aria-label="Wishlist merged" data-wishlist-merged="" className={cn(NOTICE_CLASS, 'mb-6')}>
          <span>
            We merged the <span className="num">{merged}</span> {merged === 1 ? 'item' : 'items'}{' '}
            you saved before signing in.
          </span>
          <button type="button" onClick={dismissMerged} className={LINK_CLASS}>
            Dismiss
          </button>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className={cn(NOTICE_CLASS, 'mb-6 text-danger')}>
          <span>{error}</span>
          <button type="button" onClick={clearError} className={LINK_CLASS}>
            Dismiss
          </button>
        </p>
      ) : null}

      {status === 'guest' ? (
        <p data-wishlist-guest="" className={cn(NOTICE_CLASS, 'mb-6')}>
          <span>Sign in to keep this list on every device.</span>
          <Link href={SIGN_IN_HREF} className={LINK_CLASS}>
            Sign in
          </Link>
        </p>
      ) : null}

      {empty ? (
        <div data-wishlist-empty="" className="flex flex-col items-start gap-3 py-8">
          <p className="text-base font-semibold text-ink">Your wishlist is empty.</p>
          <p className="text-xs text-ink-mute">Tap the heart on anything you want to come back to.</p>
          <Button asChild size="sm">
            <Link href="/collections/all">Shop the collection</Link>
          </Button>
        </div>
      ) : loading ? (
        <div role="status" aria-label="Loading your wishlist">
          <WishlistGridSkeleton count={Math.min(count, 8)} />
        </div>
      ) : (
        <WishlistGrid
          cards={cards}
          onRemove={handleRemove}
          onAddToCart={handleAddToCart}
          pendingVariantId={pendingVariantId}
        />
      )}

      {!empty ? (
        <footer data-wishlist-footer="" className="mt-10 flex flex-col gap-1 text-xs text-ink-mute">
          {unavailable > 0 ? (
            <p className="num">
              {`${unavailable} saved ${unavailable === 1 ? 'item is' : 'items are'} no longer available.`}
            </p>
          ) : null}
          <p>Prices and stock update live. Saved items stay here until you remove them.</p>
        </footer>
      ) : null}
    </Section>
  )
}
