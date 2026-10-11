'use client'

import * as React from 'react'
import Link from 'next/link'
import { loadLedgerAction } from '@/app/(storefront)/_actions/loyalty'
import { Button } from '@/components/storefront/ui/Button'
import { Section } from '@/components/storefront/ui/Section'
import { Display, Eyebrow } from '@/components/storefront/ui/Typography'
import type { LedgerFilter, LedgerPage, LedgerRow } from '@/lib/loyalty/ledger'
import type { LoyaltyActionResult } from '@/lib/shopify/types'
import { cn } from '@/lib/storefront/cn'
import { formatDate, formatSignedPoints } from './format'

export type LedgerAction = (input: {
  cursor?: string | null
  limit?: number
  filter?: LedgerFilter
}) => Promise<LoyaltyActionResult<LedgerPage>>

const FILTERS: { value: LedgerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'earned', label: 'Earned' },
  { value: 'redeemed', label: 'Redeemed' },
]

const GENERIC_ERROR = 'Something went wrong. Please try again.'

export interface LedgerTableProps {
  /** The first page, read by the route during render. `null` = nothing loaded yet. */
  initialPage: LedgerPage | null
  /** Inject a fake (tests). Defaults to the Server Action. */
  loadLedger?: LedgerAction
  /** Render without the section chrome (the hub wraps it). Default: with. */
  bare?: boolean
}

function PointsCell({ row }: { row: LedgerRow }) {
  return (
    <span className={cn('num font-semibold', row.points > 0 ? 'text-ok' : row.points < 0 ? 'text-ink' : 'text-ink-mute')}>
      {formatSignedPoints(row.points)}
    </span>
  )
}

function Reference({ row }: { row: LedgerRow }) {
  const { reference } = row
  if (reference.type === 'none' || !reference.label) return <span className="text-ink-mute">—</span>
  if (reference.href) {
    return (
      <Link href={reference.href} className="underline underline-offset-4 decoration-line-strong hover:text-ink">
        {reference.label}
      </Link>
    )
  }
  return <span className={cn(reference.type === 'code' && 'num')}>{reference.label}</span>
}

/** Filter chips, the history table and Load more (`#history`). */
export function LedgerTable({ initialPage, loadLedger, bare = false }: LedgerTableProps) {
  const [filter, setFilter] = React.useState<LedgerFilter>('all')
  const [rows, setRows] = React.useState<LedgerRow[]>(initialPage?.rows ?? [])
  const [nextCursor, setNextCursor] = React.useState<string | null>(initialPage?.nextCursor ?? null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  const requestSeq = React.useRef(0)

  const load = React.useCallback(
    (nextFilter: LedgerFilter, cursor: string | null) => {
      const seq = ++requestSeq.current
      setError(null)
      startTransition(async () => {
        const run = loadLedger ?? loadLedgerAction
        let result: LoyaltyActionResult<LedgerPage>
        try {
          result = await run({ filter: nextFilter, cursor })
        } catch {
          result = { ok: false, error: GENERIC_ERROR }
        }
        if (seq !== requestSeq.current) return
        if (!result.ok) {
          setError(result.error || GENERIC_ERROR)
          return
        }
        setRows((current) => (cursor ? [...current, ...result.data.rows] : result.data.rows))
        setNextCursor(result.data.nextCursor)
      })
    },
    [loadLedger]
  )

  const changeFilter = (next: LedgerFilter) => {
    if (next === filter) return
    setFilter(next)
    load(next, null)
  }

  const body = (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Filter history" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => {
          const active = option.value === filter
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => changeFilter(option.value)}
              className={cn(
                'h-9 rounded-pill border px-4 text-xs font-semibold uppercase tracking-eyebrow',
                'transition-colors duration-sf-fast ease-sf-out',
                'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-signal focus-visible:outline-offset-2',
                active ? 'border-ink bg-ink text-bone' : 'border-line-strong bg-paper text-ink hover:bg-rose-tint'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {error ? (
        <p role="alert" className="m-0 rounded-sharp border border-danger bg-paper px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="m-0 text-sm text-ink-soft" aria-busy={pending || undefined}>
          {pending ? 'Loading…' : 'No activity yet — your first order starts the ledger.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sharp border border-line bg-paper">
          <table className="w-full border-collapse text-sm text-ink" aria-busy={pending || undefined}>
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-eyebrow text-ink-mute">
                <th scope="col" className="px-4 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Activity
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Reference
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-kind={row.kind} className="border-b border-line last:border-b-0">
                  <td className="num whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(row.at)}</td>
                  <td className="px-4 py-3">{row.label}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    <Reference row={row} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PointsCell row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor ? (
        <Button variant="outline" size="sm" className="self-start" loading={pending} onClick={() => load(filter, nextCursor)}>
          Load more
        </Button>
      ) : null}
    </div>
  )

  if (bare) return body

  return (
    <Section id="history" aria-labelledby="loyalty-history-title" className="scroll-mt-28">
      <div className="mb-8 flex flex-col gap-2">
        <Eyebrow>Ledger</Eyebrow>
        <Display as="h2" size="md" id="loyalty-history-title">
          History
        </Display>
      </div>
      {body}
    </Section>
  )
}
