'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { predictiveSearchAction } from '@/app/(storefront)/_actions/catalog'
import { Dialog } from '@/components/storefront/ui/Dialog'
import { Input } from '@/components/storefront/ui/Input'
import { Price } from '@/components/storefront/ui/Price'
import { Skeleton } from '@/components/storefront/ui/Skeleton'
import type { SearchSuggestion } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'

/** Keystroke quiet period before a request goes out. */
export const SEARCH_DEBOUNCE_MS = 200
/** Shopify's predictive search ignores anything shorter. */
export const MIN_QUERY_LENGTH = 2
/** Predictive search returns 6 of each; never render more. */
const MAX_RESULTS = 6

const EMPTY_SUGGESTION: SearchSuggestion = { products: [], collections: [] }

const RESULT_LINK_CLASS = [
  'flex items-center gap-3 rounded-sharp px-2 py-2 text-sm text-ink',
  'transition-colors duration-sf-fast ease-sf-out hover:bg-rose-tint',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
].join(' ')

const GROUP_HEADING_CLASS =
  'mb-2 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute'

export interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Suggestion source. Defaults to the `predictiveSearchAction` server action. */
  searchFn?: (q: string) => Promise<SearchSuggestion>
  /** Navigation hook. Defaults to the app router's `push`. */
  onNavigate?: (href: string) => void
}

/**
 * Header search overlay (spec §5.3).
 *
 * The query lives in local state, not the URL: this is a suggestion surface,
 * and only Enter commits to `/search?q=`. Requests are debounced by
 * `SEARCH_DEBOUNCE_MS` and tagged with a monotonic id so a slow early response
 * can never overwrite a newer one.
 */
export function SearchDialog({
  open,
  onOpenChange,
  searchFn = predictiveSearchAction,
  onNavigate,
}: SearchDialogProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchSuggestion | null>(null)
  const [pending, setPending] = React.useState(false)
  // Bumped for every state change that invalidates the request in flight.
  const requestIdRef = React.useRef(0)

  const trimmed = query.trim()
  const tooShort = trimmed.length < MIN_QUERY_LENGTH

  const navigate = React.useCallback(
    (href: string) => {
      if (onNavigate) onNavigate(href)
      else router.push(href)
    },
    [onNavigate, router]
  )

  // Closing resets the surface: reopening the dialog should not flash the
  // previous visitor's query back at them.
  React.useEffect(() => {
    if (open) return
    requestIdRef.current += 1
    setQuery('')
    setResults(null)
    setPending(false)
  }, [open])

  React.useEffect(() => {
    if (!open) return

    if (tooShort) {
      requestIdRef.current += 1
      setResults(null)
      setPending(false)
      return
    }

    const id = (requestIdRef.current += 1)
    setPending(true)

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const suggestion = await searchFn(trimmed)
          if (requestIdRef.current !== id) return
          setResults(suggestion)
        } catch {
          if (requestIdRef.current !== id) return
          setResults(EMPTY_SUGGESTION)
        } finally {
          if (requestIdRef.current === id) setPending(false)
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [open, tooShort, trimmed, searchFn])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!trimmed) return
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
    onOpenChange(false)
  }

  const products = (results?.products ?? []).slice(0, MAX_RESULTS)
  const collections = (results?.collections ?? []).slice(0, MAX_RESULTS)
  const hasResults = products.length > 0 || collections.length > 0
  const showEmptyState = !pending && results !== null && !hasResults

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Search" size="lg">
      <form role="search" onSubmit={handleSubmit} className="flex items-end gap-2">
        <Input
          label="Search products"
          hideLabel
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products and collections"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          wrapperClassName="flex-1"
        />
        {/* Keeps Enter submitting the form on browsers that need an explicit
            submit control; visually the field stands alone. */}
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>

      <div data-search-results="" aria-busy={pending || undefined} className="mt-5">
        {pending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="size-12 shrink-0" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            ))}
          </div>
        ) : null}

        {!pending && tooShort ? (
          <p className="px-2 text-sm text-ink-mute">
            {`Type at least ${MIN_QUERY_LENGTH} characters to see suggestions.`}
          </p>
        ) : null}

        {showEmptyState ? (
          <p className="px-2 text-sm text-ink-soft">{`No results for “${trimmed}”`}</p>
        ) : null}

        {!pending && products.length > 0 ? (
          <section aria-labelledby="search-products-heading">
            <h3 id="search-products-heading" className={GROUP_HEADING_CLASS}>
              Products
            </h3>
            <ul className="flex flex-col">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.handle}`}
                    onClick={() => onOpenChange(false)}
                    className={RESULT_LINK_CLASS}
                  >
                    {product.image ? (
                      <Image
                        src={product.image.url}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-sharp bg-line object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="size-12 shrink-0 rounded-sharp bg-line"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{product.title}</span>
                    <Price amount={product.price} compareAt={product.compareAtPrice} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!pending && collections.length > 0 ? (
          <section
            aria-labelledby="search-collections-heading"
            className={cn(products.length > 0 && 'mt-5')}
          >
            <h3 id="search-collections-heading" className={GROUP_HEADING_CLASS}>
              Collections
            </h3>
            <ul className="flex flex-col">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <Link
                    href={`/collections/${collection.handle}`}
                    onClick={() => onOpenChange(false)}
                    className={RESULT_LINK_CLASS}
                  >
                    {collection.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
