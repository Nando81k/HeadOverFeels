'use client'

/**
 * MarketingListTable — generic desktop list table for all 5 marketing tabs.
 *
 * One component, 5 variants. CVA drives column sets and status pill colors
 * per variant. Props are a discriminated union over `variant + rows`.
 *
 * Features:
 *   - Sticky header (sticky top-0 z-10)
 *   - Per-row checkbox + select-all in header
 *   - Per-variant column sets
 *   - Status pills tailored per variant
 *   - Loading skeleton rows
 *   - Per-variant empty state copy
 *   - ⋯ action button → calls onOpenInspector(id)
 *
 * Hidden on mobile (`hidden md:block`). Mobile uses MarketingListCardMobile.
 *
 * Phase 5 Task 3.
 */

import type {
  PromotionRow,
  PopupRow,
  SubscriberRow,
  CampaignRow,
  AbandonedCartRow,
} from '@/lib/admin/marketing'

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = 'promotions' | 'popups' | 'subscribers' | 'campaigns' | 'carts'

type CommonProps = {
  selected: Set<string>
  onSelect: (id: string, checked: boolean) => void
  onSelectAll?: (checked: boolean) => void
  onOpenInspector: (id: string) => void
  loading?: boolean
  skeletonRows?: number
}

export type MarketingListTableProps =
  | ({ variant: 'promotions'; rows: PromotionRow[] } & CommonProps)
  | ({ variant: 'popups'; rows: PopupRow[] } & CommonProps)
  | ({ variant: 'subscribers'; rows: SubscriberRow[] } & CommonProps)
  | ({ variant: 'campaigns'; rows: CampaignRow[] } & CommonProps)
  | ({ variant: 'carts'; rows: AbandonedCartRow[] } & CommonProps)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`
}

// ─── Status pill styles ───────────────────────────────────────────────────────

const ACTIVE_PILL = 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
const INACTIVE_PILL = 'bg-white/5 text-white/40 border border-white/10'
const SCHEDULED_PILL = 'bg-amber-500/15 text-amber-300 border border-amber-500/30'

const CAMPAIGN_STATUS_PILL: Record<string, string> = {
  DRAFT:   'bg-white/8 text-white/60 border border-white/15',
  QUEUED:  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  SENDING: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  SENT:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  FAILED:  'bg-rose-500/15 text-rose-300 border border-rose-500/30',
}

const CART_STATUS_PILL: Record<string, string> = {
  recovered: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  pending:   'bg-amber-500/15 text-amber-300 border border-amber-500/30',
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function ActiveStatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
        active ? ACTIVE_PILL : INACTIVE_PILL,
      ].join(' ')}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function PromotionStatusPill({ isActive, startDate, endDate }: {
  isActive: boolean
  startDate: Date
  endDate: Date | null
}) {
  const now = new Date()
  if (!isActive) {
    return (
      <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', INACTIVE_PILL].join(' ')}>
        Inactive
      </span>
    )
  }
  if (startDate > now) {
    return (
      <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', SCHEDULED_PILL].join(' ')}>
        Scheduled
      </span>
    )
  }
  if (endDate && endDate < now) {
    return (
      <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', INACTIVE_PILL].join(' ')}>
        Expired
      </span>
    )
  }
  return (
    <span className={['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', ACTIVE_PILL].join(' ')}>
      Active
    </span>
  )
}

function CampaignStatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
        CAMPAIGN_STATUS_PILL[status] ?? INACTIVE_PILL,
      ].join(' ')}
    >
      {status}
    </span>
  )
}

function CartStatusPill({ recovered }: { recovered: boolean }) {
  const key = recovered ? 'recovered' : 'pending'
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
        CART_STATUS_PILL[key],
      ].join(' ')}
    >
      {recovered ? 'Recovered' : 'Pending'}
    </span>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-white/[0.04]" data-testid="marketing-list-skeleton-row">
      {/* checkbox col */}
      <td className="px-3 py-3 w-10">
        <div className="w-4 h-4 bg-white/5 animate-pulse rounded" />
      </td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-white/5 animate-pulse rounded" style={{ width: `${60 + (i % 3) * 20}px` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Column header labels per variant ────────────────────────────────────────

const HEADERS: Record<Variant, string[]> = {
  promotions:  ['Name', 'Code', 'Type', 'Value', 'Used', 'Status', 'Start'],
  popups:      ['Name', 'Template', 'Position', 'Impressions 7d', 'Conv 7d', 'Status'],
  subscribers: ['Email', 'Source', 'UTM', 'Status', 'Signed up'],
  campaigns:   ['Subject', 'Status', 'Audience', 'Sent', 'Failed', 'Sent at'],
  carts:       ['Customer', 'Items', 'Value', 'Status', 'Email sent', 'Code', 'Abandoned'],
}

// ─── Empty state copy per variant ─────────────────────────────────────────────

const EMPTY_LABEL: Record<Variant, string> = {
  promotions:  'No promotions yet. Create your first promotion to get started.',
  popups:      'No popups yet. Create your first popup to engage visitors.',
  subscribers: 'No subscribers yet. Share your signup form to grow your list.',
  campaigns:   'No campaigns yet. Draft your first newsletter campaign.',
  carts:       'No abandoned carts to recover. Check back later.',
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Desktop-only marketing list table.
 * Hidden on mobile via `hidden md:block` — pair with MarketingListCardMobile for small viewports.
 */
export function MarketingListTable(props: MarketingListTableProps) {
  const {
    variant,
    selected,
    onSelect,
    onSelectAll,
    onOpenInspector,
    loading = false,
    skeletonRows = 8,
  } = props

  const headers = HEADERS[variant]
  // total cols = checkbox col + header cols + actions col
  const totalCols = headers.length + 2

  const allSelected =
    props.rows.length > 0 && props.rows.every((r) => selected.has(r.id))
  const someSelected = props.rows.some((r) => selected.has(r.id))

  // Empty state (not loading, no rows)
  if (!loading && props.rows.length === 0) {
    return (
      <div className="hidden md:flex items-center justify-center py-16 border border-white/8 rounded-lg bg-neutral-900/40">
        <p className="text-sm text-white/35">{EMPTY_LABEL[variant]}</p>
      </div>
    )
  }

  return (
    <div className="hidden md:block bg-neutral-900/60 border border-white/8 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          {/* ── Sticky header ─────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10 bg-neutral-950">
            <tr className="border-b border-white/[0.06]">
              {/* Select-all checkbox */}
              <th className="px-3 py-2.5 w-10 text-left">
                <input
                  type="checkbox"
                  data-testid="marketing-select-all"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected
                  }}
                  onChange={(e) => onSelectAll?.(e.currentTarget.checked)}
                  aria-label={`Select all ${variant}`}
                  className="w-4 h-4 cursor-pointer accent-emerald-500"
                />
              </th>

              {/* Per-variant column headers */}
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-white/40"
                >
                  {h}
                </th>
              ))}

              {/* Actions column — no label */}
              <th className="px-3 py-2.5 w-10" aria-hidden />
            </tr>
          </thead>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} cols={totalCols} />
              ))
            ) : variant === 'promotions' ? (
              (props.rows as PromotionRow[]).map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    data-testid="marketing-table-row"
                    className={[
                      'transition-colors group',
                      isSelected
                        ? 'bg-emerald-500/[0.04] shadow-[inset_2px_0_0_theme(colors.emerald.500)]'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                        aria-label={`Select ${r.name}`}
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-white font-medium">{r.name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-white/70">
                      {r.code ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-white/60">{r.type}</td>
                    <td className="px-3 py-3 tabular-nums text-white/80">
                      {r.value}{r.type === 'PERCENTAGE' ? '%' : ''}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/70">
                      {r.usedCount}
                      {r.maxUsesTotal != null && (
                        <span className="text-white/35">/{r.maxUsesTotal}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <PromotionStatusPill
                        isActive={r.isActive}
                        startDate={r.startDate}
                        endDate={r.endDate}
                      />
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                      {formatDate(r.startDate)}
                    </td>
                    <td className="px-3 py-3 w-10 text-right">
                      <button
                        type="button"
                        data-testid={`row-actions-${r.id}`}
                        onClick={() => onOpenInspector(r.id)}
                        aria-label={`Open inspector for ${r.name}`}
                        className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : variant === 'popups' ? (
              (props.rows as PopupRow[]).map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    data-testid="marketing-table-row"
                    className={[
                      'transition-colors group',
                      isSelected
                        ? 'bg-emerald-500/[0.04] shadow-[inset_2px_0_0_theme(colors.emerald.500)]'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                        aria-label={`Select ${r.name}`}
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-white font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-xs text-white/60">{r.template}</td>
                    <td className="px-3 py-3 text-xs text-white/50">{r.position}</td>
                    <td className="px-3 py-3 tabular-nums text-white/80">{r.impressions7d}</td>
                    <td className="px-3 py-3 tabular-nums text-white/80">{r.conversions7d}</td>
                    <td className="px-3 py-3">
                      <ActiveStatusPill active={r.isActive} />
                    </td>
                    <td className="px-3 py-3 w-10 text-right">
                      <button
                        type="button"
                        data-testid={`row-actions-${r.id}`}
                        onClick={() => onOpenInspector(r.id)}
                        aria-label={`Open inspector for ${r.name}`}
                        className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : variant === 'subscribers' ? (
              (props.rows as SubscriberRow[]).map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    data-testid="marketing-table-row"
                    className={[
                      'transition-colors group',
                      isSelected
                        ? 'bg-emerald-500/[0.04] shadow-[inset_2px_0_0_theme(colors.emerald.500)]'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                        aria-label={`Select ${r.email}`}
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-white">{r.email}</td>
                    <td className="px-3 py-3 text-xs text-white/60">
                      {r.source ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-white/50">
                      {r.utmSource ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <ActiveStatusPill active={r.isActive} />
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-3 w-10 text-right">
                      <button
                        type="button"
                        data-testid={`row-actions-${r.id}`}
                        onClick={() => onOpenInspector(r.id)}
                        aria-label={`Open inspector for ${r.email}`}
                        className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : variant === 'campaigns' ? (
              (props.rows as CampaignRow[]).map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    data-testid="marketing-table-row"
                    className={[
                      'transition-colors group',
                      isSelected
                        ? 'bg-emerald-500/[0.04] shadow-[inset_2px_0_0_theme(colors.emerald.500)]'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                        aria-label={`Select ${r.subject}`}
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-white font-medium">{r.subject}</td>
                    <td className="px-3 py-3">
                      <CampaignStatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/70">{r.audienceCount.toLocaleString()}</td>
                    <td className="px-3 py-3 tabular-nums text-white/70">{r.sentCount.toLocaleString()}</td>
                    <td className="px-3 py-3 tabular-nums text-rose-300/80">
                      {r.failedCount > 0 ? r.failedCount : <span className="text-white/25">0</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                      {r.sentAt ? formatDate(r.sentAt) : <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 w-10 text-right">
                      <button
                        type="button"
                        data-testid={`row-actions-${r.id}`}
                        onClick={() => onOpenInspector(r.id)}
                        aria-label={`Open inspector for ${r.subject}`}
                        className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              // variant === 'carts'
              (props.rows as AbandonedCartRow[]).map((r) => {
                const isSelected = selected.has(r.id)
                return (
                  <tr
                    key={r.id}
                    data-testid="marketing-table-row"
                    className={[
                      'transition-colors group',
                      isSelected
                        ? 'bg-emerald-500/[0.04] shadow-[inset_2px_0_0_theme(colors.emerald.500)]'
                        : 'hover:bg-white/[0.02]',
                    ].join(' ')}
                  >
                    <td className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => onSelect(r.id, e.currentTarget.checked)}
                        aria-label={`Select cart for ${r.customerEmail}`}
                        className="w-4 h-4 cursor-pointer accent-emerald-500"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-white text-[11px] font-medium leading-tight">
                        {r.customerName ?? r.customerEmail}
                      </div>
                      {r.customerName && (
                        <div className="text-[10px] text-white/40 mt-0.5">{r.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/70">{r.itemCount}</td>
                    <td className="px-3 py-3 tabular-nums text-white/85 whitespace-nowrap">
                      {formatCurrency(r.totalValue)}
                    </td>
                    <td className="px-3 py-3">
                      <CartStatusPill recovered={r.recovered} />
                    </td>
                    <td className="px-3 py-3 text-xs text-white/50">
                      {r.recoveryEmailSent ? 'Sent' : <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-[10px] text-white/60">
                      {r.discountCode ?? <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/50 whitespace-nowrap">
                      {formatDate(r.abandonedAt)}
                    </td>
                    <td className="px-3 py-3 w-10 text-right">
                      <button
                        type="button"
                        data-testid={`row-actions-${r.id}`}
                        onClick={() => onOpenInspector(r.id)}
                        aria-label={`Open inspector for cart — ${r.customerEmail}`}
                        className="text-white/30 hover:text-white/70 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        ⋯
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
