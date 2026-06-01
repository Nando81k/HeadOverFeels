'use client'

/**
 * SubscriberInspector — read-only slide-out profile for a newsletter subscriber.
 *
 * Scope (Phase 5 spec):
 *  - Displays: email, source, sourceDetails, isActive, isVerified, verifiedAt,
 *    unsubscribedAt, UTM fields (source/medium/campaign), signup date.
 *  - Unsubscribe button: enabled only when subscriber is currently active.
 *  - Delete button: SUPER_ADMIN-gated (disabled + tooltip when not super admin).
 *    Server enforces requireAdminRole('SUPER_ADMIN'); UI gate prevents confusion.
 *  - Both actions call onMutated(id) so the parent can close + refresh.
 */

import { useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import type { SubscriberDetailFull } from '@/app/admin/marketing/actions'
import { unsubscribeSubscriber, deleteSubscriber } from '@/app/admin/marketing/actions'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SubscriberInspectorProps {
  open: boolean
  detail: SubscriberDetailFull | null
  isSuperAdmin: boolean
  onClose: () => void
  onMutated?: (id: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Read-only row ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-white/[0.04] last:border-b-0">
      <span className="text-[11px] uppercase tracking-wide text-white/40 whitespace-nowrap flex-shrink-0">
        {label}
      </span>
      <span className="text-sm text-white text-right break-all">{value}</span>
    </div>
  )
}

// ─── Status pill ─────────────────────────────────────────────────────────────

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-500/20 text-white/50 border border-white/10'
      }
    >
      {isActive ? 'Active' : 'Unsubscribed'}
    </span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SubscriberInspector({
  open,
  detail,
  isSuperAdmin,
  onClose,
  onMutated,
}: SubscriberInspectorProps) {
  const [pending, startTransition] = useTransition()

  function handleUnsubscribe() {
    if (!detail) return
    startTransition(async () => {
      const r = await unsubscribeSubscriber(detail.id)
      if (r.ok) {
        toast.success('Subscriber unsubscribed')
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to unsubscribe')
      }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm(`Permanently delete ${detail.email}? This cannot be undone.`)) return
    startTransition(async () => {
      const r = await deleteSubscriber(detail.id)
      if (r.ok) {
        toast.success('Subscriber deleted')
        onMutated?.(detail.id)
        onClose()
      } else {
        toast.error('Failed to delete subscriber')
      }
    })
  }

  return (
    <Inspector open={open} onClose={onClose} title={detail?.email ?? 'Subscriber'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* ── Identity ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Identity</p>
            <Row label="Email" value={detail.email} />
            <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-[11px] uppercase tracking-wide text-white/40">Status</span>
              <StatusPill isActive={detail.isActive} />
            </div>
            <Row label="Verified" value={detail.isVerified ? 'Yes' : 'No'} />
            {detail.verifiedAt && (
              <Row label="Verified at" value={formatDate(detail.verifiedAt)} />
            )}
            {!detail.isActive && detail.unsubscribedAt && (
              <Row label="Unsubscribed at" value={formatDate(detail.unsubscribedAt)} />
            )}
          </section>

          {/* ── Acquisition ── */}
          <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Acquisition</p>
            <Row label="Source" value={detail.source ?? '—'} />
            <Row label="Source details" value={detail.sourceDetails ?? '—'} />
            <Row label="Signed up" value={formatDate(detail.createdAt)} />
          </section>

          {/* ── UTM ── */}
          {(detail.utmSource || detail.utmMedium || detail.utmCampaign) && (
            <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">UTM Attribution</p>
              <Row label="UTM source" value={detail.utmSource ?? '—'} />
              <Row label="UTM medium" value={detail.utmMedium ?? '—'} />
              <Row label="UTM campaign" value={detail.utmCampaign ?? '—'} />
            </section>
          )}

          {/* ── Actions ── */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={pending || !detail.isActive}
              className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.12] rounded-lg text-white hover:bg-white/[0.10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Unsubscribe
            </button>

            <div className="relative flex-1" title={isSuperAdmin ? undefined : 'SUPER_ADMIN only'}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending || !isSuperAdmin}
                className="w-full px-3 py-2 text-sm bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-300 hover:bg-rose-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Inspector>
  )
}
