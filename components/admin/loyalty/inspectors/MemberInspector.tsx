'use client'

/**
 * MemberInspector — read-only slide-out profile for a loyalty member.
 *
 * Scope (Phase 7 Task 7):
 *  - Read-only profile: email, name, tier badge (color-chip + tierName),
 *    currentPoints, lifetimePoints, annualPointsEarned, tierStartDate, lastOrderDate.
 *  - Scrollable last-50 PointsTransaction ledger via <MemberLedger> (Task 18).
 *  - "Adjust Points" button opens <AdjustPointsDialog> (Task 13) in single-member mode.
 *  - "Recompute Tier" button calls recomputeMemberTier server action.
 *
 * Parallel-dependency strategy:
 *  - MemberLedger (Task 18) and AdjustPointsDialog (Task 13) are parallel Wave 3
 *    siblings. This component imports them directly by path. The test file mocks
 *    both modules with vi.mock(), so tests pass without the real implementations.
 *    When Tasks 13 and 18 are merged, the real components slot in automatically.
 *    No render-prop indirection needed — the mock-at-test-boundary pattern is
 *    sufficient and is the same approach used by Phase 5/6 inspectors.
 */

import { useState, useTransition } from 'react'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import { recomputeMemberTier } from '@/app/admin/loyalty/actions'
import type { MemberDetailFull } from '@/app/admin/loyalty/actions'
import { MemberLedger } from '@/components/admin/loyalty/MemberLedger'
import { AdjustPointsDialog } from '@/components/admin/loyalty/AdjustPointsDialog'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MemberInspectorProps {
  open: boolean
  detail: MemberDetailFull | null
  isSuperAdmin: boolean
  onClose: () => void
  onMutated?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nFmt = new Intl.NumberFormat('en-US')

function formatDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function PointsStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-neutral-900/40 border border-white/[0.06] rounded-lg px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label}</span>
      <span className="text-sm font-semibold text-white">{nFmt.format(value)}</span>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemberInspector({
  open,
  detail,
  isSuperAdmin,
  onClose,
  onMutated,
}: MemberInspectorProps) {
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleRecompute() {
    if (!detail) return
    startTransition(async () => {
      const r = await recomputeMemberTier(detail.id)
      if (r.ok) {
        toast.success('Tier recomputed')
        onMutated?.()
      } else {
        toast.error('Failed to recompute tier')
      }
    })
  }

  return (
    <>
      <Inspector open={open} onClose={onClose} title={detail?.name ?? 'Member'} width={460}>
        {!detail ? (
          <div className="p-6 text-sm text-white/40">Loading…</div>
        ) : (
          <div className="space-y-4">
            {/* ── Identity ── */}
            <section className="bg-neutral-900/60 border border-white/[0.08] rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Identity</p>
              <Row label="Email" value={detail.email} />
              {detail.name && <Row label="Name" value={detail.name} />}

              {/* Tier badge */}
              <div className="flex justify-between items-center py-1.5 border-b border-white/[0.04] last:border-b-0">
                <span className="text-[11px] uppercase tracking-wide text-white/40 whitespace-nowrap flex-shrink-0">
                  Tier
                </span>
                <div className="flex items-center gap-1.5">
                  {detail.tierColor && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: detail.tierColor }}
                    />
                  )}
                  <span className="text-sm text-white">{detail.tierName ?? '—'}</span>
                </div>
              </div>

              <Row label="Tier since" value={formatDate(detail.tierStartDate)} />
              <Row label="Last order" value={formatDate(detail.lastOrderDate)} />
            </section>

            {/* ── Points ── */}
            <section>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Points</p>
              <div className="grid grid-cols-3 gap-2">
                <PointsStat label="Current" value={detail.currentPoints} />
                <PointsStat label="Lifetime" value={detail.lifetimePoints} />
                <PointsStat label="Annual" value={detail.annualPointsEarned} />
              </div>
            </section>

            {/* ── Actions ── */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAdjustOpen(true)}
                className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.12] rounded-lg text-white hover:bg-white/[0.10] transition-colors"
              >
                Adjust Points
              </button>
              <button
                type="button"
                onClick={handleRecompute}
                disabled={pending}
                className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/[0.12] rounded-lg text-white hover:bg-white/[0.10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? 'Recomputing…' : 'Recompute Tier'}
              </button>
            </div>

            {/* ── Ledger ── */}
            <section>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
                Recent Activity
              </p>
              <MemberLedger entries={detail.transactions} />
            </section>
          </div>
        )}
      </Inspector>

      {detail && (
        <AdjustPointsDialog
          open={adjustOpen}
          memberIds={[detail.id]}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setAdjustOpen(false)}
          onSaved={() => {
            setAdjustOpen(false)
            onMutated?.()
          }}
        />
      )}
    </>
  )
}
