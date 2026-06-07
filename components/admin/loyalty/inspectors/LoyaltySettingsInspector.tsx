'use client'

/**
 * LoyaltySettingsInspector — slide-out drawer for editing the LoyaltySettings singleton.
 *
 * Phase 7 Task 12 (Wave 3):
 *  - Props: open, settings (LoyaltySettingsRow), onClose, onSaved?
 *  - All editable fields: isEnabled, programName, pointsPerDollar, pointsRoundingMode,
 *    minimumOrderForPoints, all referral fields, all birthday fields, all review fields,
 *    all display flags, pointsExpireEnabled, tierDowngradeEnabled.
 *  - READ-ONLY CRON FIELDS: pointsExpireMonths, tierEvaluationPeriod — rendered as text
 *    with note: "Cron schedule managed in .github/workflows/birthday-points-cron.yml.
 *    Manual triggers planned for Phase 7.5."
 *  - Save calls updateLoyaltySettings (server action strips cron fields server-side too).
 *  - Toast feedback via lib/toast (Sonner).
 *  - No dark: Tailwind modifiers (V2 always-dark).
 *  - Width 540.
 */

import { useEffect, useState, useTransition } from 'react'
import { type LoyaltySettingsRow, updateLoyaltySettings } from '@/app/admin/loyalty/actions'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoyaltySettingsInspectorProps {
  /** Whether the drawer is open. */
  open: boolean
  /** LoyaltySettings singleton row to display and edit. */
  settings: LoyaltySettingsRow
  /** Called when the user dismisses the panel. */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its data. */
  onSaved?: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelCls = 'block text-xs font-medium uppercase tracking-wider text-white/50 mb-1'
const inputCls = [
  'w-full rounded-lg border border-white/10 bg-neutral-900/60',
  'px-3 py-2 text-sm text-white',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
].join(' ')
const sectionHeadingCls = 'text-xs font-semibold uppercase tracking-widest text-white/30 mb-2'

// ─── Component ────────────────────────────────────────────────────────────────

export function LoyaltySettingsInspector({
  open,
  settings,
  onClose,
  onSaved,
}: LoyaltySettingsInspectorProps) {
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<LoyaltySettingsRow>(settings)

  // Sync form state whenever the drawer opens or settings change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setForm(settings)
  }, [open, settings])
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Field helpers ──────────────────────────────────────────────────────────

  function set<K extends keyof LoyaltySettingsRow>(key: K, value: LoyaltySettingsRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ── Save handler ───────────────────────────────────────────────────────────

  function handleSave() {
    startTransition(async () => {
      // Explicitly enumerate editable fields; cron fields are intentionally omitted.
      // The server action also strips them (defence in depth).
      const r = await updateLoyaltySettings({
        isEnabled: form.isEnabled,
        programName: form.programName,
        pointsPerDollar: form.pointsPerDollar,
        pointsRoundingMode: form.pointsRoundingMode,
        minimumOrderForPoints: form.minimumOrderForPoints,
        referralEnabled: form.referralEnabled,
        referralPointsReferrer: form.referralPointsReferrer,
        referralPointsReferred: form.referralPointsReferred,
        reviewPointsEnabled: form.reviewPointsEnabled,
        reviewPointsAmount: form.reviewPointsAmount,
        reviewWithPhotoBonus: form.reviewWithPhotoBonus,
        birthdayRewardsEnabled: form.birthdayRewardsEnabled,
        birthdayRewardType: form.birthdayRewardType,
        birthdayRewardValue: form.birthdayRewardValue,
        birthdayRewardExpireDays: form.birthdayRewardExpireDays,
        pointsExpireEnabled: form.pointsExpireEnabled,
        tierDowngradeEnabled: form.tierDowngradeEnabled,
        showPointsInCart: form.showPointsInCart,
        showPointsInCheckout: form.showPointsInCheckout,
        showTierProgress: form.showTierProgress,
      })

      if (r.ok) {
        toast.success('Loyalty settings saved')
        onSaved?.()
        onClose()
      } else {
        toast.error((r as { ok: false; error: string }).error ?? 'Failed to save settings')
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Inspector open={open} onClose={onClose} title="Loyalty Settings" width={540}>
      <div className="space-y-6 text-sm">

        {/* ── Last updated (read-only) ─────────────────────────────────── */}
        <p className="text-xs text-white/40">
          Last updated:{' '}
          <span className="text-white/60">
            {settings.updatedAt
              ? new Date(settings.updatedAt).toLocaleString()
              : 'never'}
          </span>
        </p>

        {/* ══ PROGRAM ══════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Program</p>

          {/* isEnabled */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isEnabled}
              disabled={pending}
              onChange={(e) => set('isEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Program enabled</span>
          </label>

          {/* programName */}
          <div>
            <label htmlFor="lsi-programName" className={labelCls}>
              Program name
            </label>
            <input
              id="lsi-programName"
              aria-label="program name"
              type="text"
              value={form.programName}
              disabled={pending}
              onChange={(e) => set('programName', e.target.value)}
              className={inputCls}
            />
          </div>

          {/* pointsPerDollar */}
          <div>
            <label htmlFor="lsi-pointsPerDollar" className={labelCls}>
              Points per dollar
            </label>
            <input
              id="lsi-pointsPerDollar"
              aria-label="points per dollar"
              type="number"
              min={0}
              step="any"
              value={form.pointsPerDollar}
              disabled={pending}
              onChange={(e) => set('pointsPerDollar', Number(e.target.value))}
              className={inputCls}
            />
          </div>

          {/* pointsRoundingMode */}
          <div>
            <label htmlFor="lsi-pointsRoundingMode" className={labelCls}>
              Points rounding mode
            </label>
            <select
              id="lsi-pointsRoundingMode"
              aria-label="points rounding mode"
              value={form.pointsRoundingMode}
              disabled={pending}
              onChange={(e) => set('pointsRoundingMode', e.target.value)}
              className={inputCls}
            >
              <option value="floor">floor</option>
              <option value="round">round</option>
              <option value="ceil">ceil</option>
            </select>
          </div>

          {/* minimumOrderForPoints */}
          <div>
            <label htmlFor="lsi-minimumOrderForPoints" className={labelCls}>
              Minimum order for points ($)
            </label>
            <input
              id="lsi-minimumOrderForPoints"
              aria-label="minimum order for points"
              type="number"
              min={0}
              step="any"
              value={form.minimumOrderForPoints}
              disabled={pending}
              onChange={(e) => set('minimumOrderForPoints', Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </section>

        {/* ══ REFERRAL ═════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Referral</p>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.referralEnabled}
              disabled={pending}
              onChange={(e) => set('referralEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Referral enabled</span>
          </label>

          <div>
            <label htmlFor="lsi-referralPointsReferrer" className={labelCls}>
              Referrer points
            </label>
            <input
              id="lsi-referralPointsReferrer"
              aria-label="referrer points"
              type="number"
              min={0}
              step={1}
              value={form.referralPointsReferrer}
              disabled={pending}
              onChange={(e) => set('referralPointsReferrer', Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="lsi-referralPointsReferred" className={labelCls}>
              Referred (new member) points
            </label>
            <input
              id="lsi-referralPointsReferred"
              aria-label="referred points"
              type="number"
              min={0}
              step={1}
              value={form.referralPointsReferred}
              disabled={pending}
              onChange={(e) => set('referralPointsReferred', Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </section>

        {/* ══ REVIEWS ══════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Reviews</p>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.reviewPointsEnabled}
              disabled={pending}
              onChange={(e) => set('reviewPointsEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Review points enabled</span>
          </label>

          <div>
            <label htmlFor="lsi-reviewPointsAmount" className={labelCls}>
              Points per review
            </label>
            <input
              id="lsi-reviewPointsAmount"
              aria-label="review points amount"
              type="number"
              min={0}
              step={1}
              value={form.reviewPointsAmount}
              disabled={pending}
              onChange={(e) => set('reviewPointsAmount', Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="lsi-reviewWithPhotoBonus" className={labelCls}>
              Bonus for photo review
            </label>
            <input
              id="lsi-reviewWithPhotoBonus"
              aria-label="review with photo bonus"
              type="number"
              min={0}
              step={1}
              value={form.reviewWithPhotoBonus}
              disabled={pending}
              onChange={(e) => set('reviewWithPhotoBonus', Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </section>

        {/* ══ BIRTHDAY ═════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Birthday</p>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.birthdayRewardsEnabled}
              disabled={pending}
              onChange={(e) => set('birthdayRewardsEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Birthday rewards enabled</span>
          </label>

          <div>
            <label htmlFor="lsi-birthdayRewardType" className={labelCls}>
              Birthday reward type
            </label>
            <select
              id="lsi-birthdayRewardType"
              aria-label="birthday reward type"
              value={form.birthdayRewardType}
              disabled={pending}
              onChange={(e) => set('birthdayRewardType', e.target.value)}
              className={inputCls}
            >
              <option value="points">points</option>
              <option value="discount">discount</option>
            </select>
          </div>

          <div>
            <label htmlFor="lsi-birthdayRewardValue" className={labelCls}>
              Birthday reward value
            </label>
            <input
              id="lsi-birthdayRewardValue"
              aria-label="birthday reward value"
              type="number"
              min={0}
              step={1}
              value={form.birthdayRewardValue}
              disabled={pending}
              onChange={(e) => set('birthdayRewardValue', Number(e.target.value))}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="lsi-birthdayRewardExpireDays" className={labelCls}>
              Birthday reward expire (days)
            </label>
            <input
              id="lsi-birthdayRewardExpireDays"
              aria-label="birthday reward expire days"
              type="number"
              min={0}
              step={1}
              value={form.birthdayRewardExpireDays}
              disabled={pending}
              onChange={(e) => set('birthdayRewardExpireDays', Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </section>

        {/* ══ EXPIRY & TIERS ═══════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Expiry &amp; Tier Evaluation</p>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.pointsExpireEnabled}
              disabled={pending}
              onChange={(e) => set('pointsExpireEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Points expiry enabled</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.tierDowngradeEnabled}
              disabled={pending}
              onChange={(e) => set('tierDowngradeEnabled', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Tier downgrade enabled</span>
          </label>

          {/* ── READ-ONLY cron fields ────────────────────────────────── */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/30">
              Cron-managed (read-only)
            </p>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Points expire after</span>
              <span className="text-xs text-white/80 font-mono">
                {form.pointsExpireMonths} months
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Tier evaluation period</span>
              <span className="text-xs text-white/80 font-mono">
                {form.tierEvaluationPeriod}
              </span>
            </div>

            <p className="text-xs text-white/30 pt-1 border-t border-white/8">
              Cron schedule managed in{' '}
              <code className="font-mono text-white/40">
                .github/workflows/birthday-points-cron.yml
              </code>
              . Manual triggers planned for Phase 7.5.
            </p>
          </div>
        </section>

        {/* ══ DISPLAY ══════════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <p className={sectionHeadingCls}>Display</p>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.showPointsInCart}
              disabled={pending}
              onChange={(e) => set('showPointsInCart', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Show points in cart</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.showPointsInCheckout}
              disabled={pending}
              onChange={(e) => set('showPointsInCheckout', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Show points in checkout</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.showTierProgress}
              disabled={pending}
              onChange={(e) => set('showTierProgress', e.target.checked)}
              className="accent-[#FF3131] h-4 w-4 rounded"
            />
            <span className="text-white/80 text-xs">Show tier progress</span>
          </label>
        </section>

        {/* ── Footer actions ────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={[
              'flex-1 rounded-lg border border-white/10 py-2',
              'text-sm font-medium text-white/60 hover:text-white/90',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
              pending ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className={[
              'flex-1 rounded-lg py-2',
              'text-sm font-semibold text-white',
              'bg-[#FF3131] hover:bg-[#e02020]',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
              pending ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Inspector>
  )
}
