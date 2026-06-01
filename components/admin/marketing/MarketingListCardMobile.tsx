// components/admin/marketing/MarketingListCardMobile.tsx
'use client'

import { PencilSimple } from '@phosphor-icons/react/dist/ssr'
import { SwipeableRow } from '@/components/ui/SwipeableRow'
import type {
  PromotionRow,
  PopupRow,
  SubscriberRow,
  CampaignRow,
  AbandonedCartRow,
} from '@/lib/admin/marketing'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold',
        active
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-white/8 text-white/40',
      ].join(' ')}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function CampaignStatusPill({ status }: { status: CampaignRow['status'] }) {
  const map: Record<CampaignRow['status'], { bg: string; text: string }> = {
    DRAFT:   { bg: 'bg-white/8',        text: 'text-white/50' },
    QUEUED:  { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
    SENDING: { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
    SENT:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    FAILED:  { bg: 'bg-red-500/15',     text: 'text-red-400' },
  }
  const { bg, text } = map[status] ?? { bg: 'bg-white/8', text: 'text-white/40' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${bg} ${text}`}>
      {status}
    </span>
  )
}

// ── Common props ───────────────────────────────────────────────────────────

interface CommonProps {
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
  onQuickAction: (action: string, id: string) => void
}

// ── Discriminated union ────────────────────────────────────────────────────

export type MarketingListCardMobileProps =
  | ({ variant: 'promotions'; row: PromotionRow } & CommonProps)
  | ({ variant: 'popups'; row: PopupRow } & CommonProps)
  | ({ variant: 'subscribers'; row: SubscriberRow } & CommonProps)
  | ({ variant: 'campaigns'; row: CampaignRow } & CommonProps)
  | ({ variant: 'carts'; row: AbandonedCartRow } & CommonProps)

// ── Card article wrapper ───────────────────────────────────────────────────

function CardArticle({
  id,
  selected,
  onLongPress,
  children,
}: {
  id: string
  selected: boolean
  onLongPress: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <article
      data-testid="marketing-card"
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress(id)
      }}
      className={[
        'relative px-4 py-3 border-b border-white/5 last:border-0 bg-neutral-900/60 transition-colors',
        selected
          ? 'border-l-2 border-l-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-500/5'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </article>
  )
}

// ── Edit button ────────────────────────────────────────────────────────────

function EditButton({ id, label, onEdit }: { id: string; label: string; onEdit: (id: string) => void }) {
  return (
    <button
      type="button"
      aria-label={`Edit ${label}`}
      onClick={(e) => {
        e.stopPropagation()
        onEdit(id)
      }}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-white/50 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/5"
    >
      <PencilSimple size={11} aria-hidden />
      Edit
    </button>
  )
}

// ── Per-variant card bodies ────────────────────────────────────────────────

function PromotionCard({
  row,
  selected,
  onLongPress,
  onEdit,
}: {
  row: PromotionRow
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <CardArticle id={row.id} selected={selected} onLongPress={onLongPress}>
      {/* Row 1: name + status */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white truncate">{row.name}</span>
        <StatusPill active={row.isActive} />
      </div>

      {/* Row 2: code + type */}
      <p className="text-[11px] text-white/50 mb-1">
        {row.code ? (
          <span className="font-mono text-white/70">{row.code}</span>
        ) : (
          <span className="text-white/30 italic">No code</span>
        )}{' '}
        · {row.type} · {row.value}
        {row.type === 'PERCENTAGE' ? '%' : ''}
        {row.type === 'FIXED_AMOUNT' ? ' off' : ''}
      </p>

      {/* Row 3: usage + edit */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">
          Used {row.usedCount}
          {row.maxUsesTotal ? `/${row.maxUsesTotal}` : ''} · {formatCurrency(row.totalDiscountGiven)} given
        </span>
        <EditButton id={row.id} label={row.name} onEdit={onEdit} />
      </div>
    </CardArticle>
  )
}

function PopupCard({
  row,
  selected,
  onLongPress,
  onEdit,
}: {
  row: PopupRow
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <CardArticle id={row.id} selected={selected} onLongPress={onLongPress}>
      {/* Row 1: name + status */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white truncate">{row.name}</span>
        <StatusPill active={row.isActive} />
      </div>

      {/* Row 2: template + trigger */}
      <p className="text-[11px] text-white/50 mb-1">
        {row.template} · {row.triggerType} · {row.position}
      </p>

      {/* Row 3: analytics + edit */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">
          {row.impressions7d} impr · {row.conversions7d} conv (7d)
        </span>
        <EditButton id={row.id} label={row.name} onEdit={onEdit} />
      </div>
    </CardArticle>
  )
}

function SubscriberCard({
  row,
  selected,
  onLongPress,
  onEdit,
}: {
  row: SubscriberRow
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <CardArticle id={row.id} selected={selected} onLongPress={onLongPress}>
      {/* Row 1: email + status */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white/90 truncate">{row.email}</span>
        <StatusPill active={row.isActive} />
      </div>

      {/* Row 2: source + verified */}
      <p className="text-[11px] text-white/50 mb-1">
        {row.source ?? 'Unknown source'}
        {row.isVerified ? ' · Verified' : ' · Unverified'}
      </p>

      {/* Row 3: subscribed date + edit */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">
          {row.unsubscribedAt
            ? `Unsubscribed ${formatDate(row.unsubscribedAt)}`
            : `Joined ${formatDate(row.createdAt)}`}
        </span>
        <EditButton id={row.id} label={row.email} onEdit={onEdit} />
      </div>
    </CardArticle>
  )
}

function CampaignCard({
  row,
  selected,
  onLongPress,
  onEdit,
}: {
  row: CampaignRow
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <CardArticle id={row.id} selected={selected} onLongPress={onLongPress}>
      {/* Row 1: name + status */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white truncate">
          {row.name ?? row.subject}
        </span>
        <CampaignStatusPill status={row.status} />
      </div>

      {/* Row 2: subject */}
      {row.name && (
        <p className="text-[11px] text-white/50 mb-1 truncate">{row.subject}</p>
      )}

      {/* Row 3: audience + sent + edit */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">
          {row.sentCount}/{row.audienceCount} sent
          {row.failedCount > 0 ? ` · ${row.failedCount} failed` : ''}
          {row.sentAt ? ` · ${formatDate(row.sentAt)}` : ''}
        </span>
        <EditButton id={row.id} label={row.name ?? row.subject} onEdit={onEdit} />
      </div>
    </CardArticle>
  )
}

function CartCard({
  row,
  selected,
  onLongPress,
  onEdit,
}: {
  row: AbandonedCartRow
  selected: boolean
  onLongPress: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <CardArticle id={row.id} selected={selected} onLongPress={onLongPress}>
      {/* Row 1: email + recovery badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-white/90 truncate">
          {row.customerEmail}
        </span>
        {row.recoveryEmailSent && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400">
            Sent
          </span>
        )}
        {row.recovered && (
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400">
            Recovered
          </span>
        )}
      </div>

      {/* Row 2: item count + abandoned date */}
      <p className="text-[11px] text-white/50 mb-1">
        {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · Abandoned {formatDate(row.abandonedAt)}
      </p>

      {/* Row 3: total + discount code + edit */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white tabular-nums">
          {formatCurrency(row.totalValue)}
          {row.discountCode ? (
            <span className="ml-1.5 text-[10px] font-normal text-white/40 font-mono">
              {row.discountCode}
            </span>
          ) : null}
        </span>
        <EditButton id={row.id} label={row.customerEmail} onEdit={onEdit} />
      </div>
    </CardArticle>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function MarketingListCardMobile(props: MarketingListCardMobileProps) {
  const { variant, row, selected, onLongPress, onEdit, onQuickAction } = props

  // Campaigns have no swipe action — render plain card
  if (variant === 'campaigns') {
    return (
      <div className="md:hidden">
        <CampaignCard
          row={row}
          selected={selected}
          onLongPress={onLongPress}
          onEdit={onEdit}
        />
      </div>
    )
  }

  // All other variants use SwipeableRow
  if (variant === 'promotions') {
    return (
      <SwipeableRow
        rightActions={[
          {
            label: 'Activate',
            onClick: () => onQuickAction('activate', row.id),
          },
        ]}
        className="md:hidden"
      >
        <PromotionCard
          row={row}
          selected={selected}
          onLongPress={onLongPress}
          onEdit={onEdit}
        />
      </SwipeableRow>
    )
  }

  if (variant === 'popups') {
    return (
      <SwipeableRow
        rightActions={[
          {
            label: 'Activate',
            onClick: () => onQuickAction('activate', row.id),
          },
        ]}
        className="md:hidden"
      >
        <PopupCard
          row={row}
          selected={selected}
          onLongPress={onLongPress}
          onEdit={onEdit}
        />
      </SwipeableRow>
    )
  }

  if (variant === 'subscribers') {
    return (
      <SwipeableRow
        rightActions={[
          {
            label: 'Unsubscribe',
            onClick: () => onQuickAction('unsubscribe', row.id),
            variant: 'destructive',
          },
        ]}
        className="md:hidden"
      >
        <SubscriberCard
          row={row}
          selected={selected}
          onLongPress={onLongPress}
          onEdit={onEdit}
        />
      </SwipeableRow>
    )
  }

  // variant === 'carts'
  return (
    <SwipeableRow
      rightActions={[
        {
          label: 'Send Recovery',
          onClick: () => onQuickAction('send-recovery', row.id),
        },
      ]}
      className="md:hidden"
    >
      <CartCard
        row={row}
        selected={selected}
        onLongPress={onLongPress}
        onEdit={onEdit}
      />
    </SwipeableRow>
  )
}
