'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateReward, deleteReward } from '@/app/admin/loyalty/actions'
import type { RewardDetailFull, RewardType } from '@/app/admin/loyalty/actions'
import { toast } from '@/lib/toast'

const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
  { value: 'EARLY_ACCESS', label: 'Early Access' },
  { value: 'EXCLUSIVE_PRODUCT', label: 'Exclusive Product' },
  { value: 'CHARITY_DONATION', label: 'Charity Donation' },
  { value: 'DIGITAL_CONTENT', label: 'Digital Content' },
  { value: 'PHYSICAL_PERK', label: 'Physical Perk' },
]

export interface RewardEditorTierOption {
  id: string
  name: string
  slug: string
}

export interface RewardEditorProps {
  detail: RewardDetailFull
  rewardId: string
  tiers: RewardEditorTierOption[]
  isSuperAdmin?: boolean
}

const inputCls =
  'w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-white/20'
const labelCls = 'text-white/60 text-xs font-medium'

export function RewardEditor({ detail, rewardId, tiers, isSuperAdmin = false }: RewardEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDeleteTransition] = useTransition()

  const [name, setName] = useState(detail.name)
  const [slug, setSlug] = useState(detail.slug)
  const [description, setDescription] = useState(detail.description ?? '')
  const [pointsCost, setPointsCost] = useState(detail.pointsCost)
  const [rewardType, setRewardType] = useState<RewardType>(detail.rewardType)
  const [value, setValue] = useState<string>(detail.value == null ? '' : String(detail.value))
  const [isActive, setIsActive] = useState(detail.isActive)
  const [maxPerCustomer, setMaxPerCustomer] = useState<string>(
    detail.maxRedemptionsPerCustomer == null ? '' : String(detail.maxRedemptionsPerCustomer),
  )
  const [totalAvailable, setTotalAvailable] = useState<string>(
    detail.totalAvailable == null ? '' : String(detail.totalAvailable),
  )
  const [minTierRequired, setMinTierRequired] = useState<string>(detail.minTierRequired ?? '')
  const [metadata, setMetadata] = useState(detail.metadata ?? '')
  const [image, setImage] = useState(detail.image ?? '')
  const [sortOrder, setSortOrder] = useState(detail.sortOrder)

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val)
    setSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    )
  }

  const handleSave = () => {
    startTransition(async () => {
      const r = await updateReward(rewardId, {
        name,
        slug,
        description: description.trim() || null,
        pointsCost,
        rewardType,
        value: value === '' ? null : Number(value),
        isActive,
        maxRedemptionsPerCustomer: maxPerCustomer === '' ? null : Number(maxPerCustomer),
        totalAvailable: totalAvailable === '' ? null : Number(totalAvailable),
        minTierRequired: minTierRequired || null,
        metadata: metadata.trim() || null,
        image: image.trim() || null,
        sortOrder,
      })
      if (r.ok) {
        toast.success('Reward saved')
        router.push('/admin/loyalty?tab=rewards')
      } else {
        toast.error(r.error ?? 'Failed to save reward')
      }
    })
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this reward? This cannot be undone.')) return
    startDeleteTransition(async () => {
      const r = await deleteReward(rewardId)
      if (r.ok) {
        toast.success('Reward deleted')
        router.push('/admin/loyalty?tab=rewards')
      } else {
        toast.error(r.error ?? 'Failed to delete reward')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Edit Reward</h1>
        <span className="text-white/40 text-xs">ID: {rewardId}</span>
      </div>

      {/* Basic fields */}
      <section className="space-y-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
        <h2 className="text-white/70 font-medium text-xs uppercase tracking-widest">Basic Info</h2>

        <label className="block">
          <span className={labelCls}>Name</span>
          <input
            aria-label="name"
            className={inputCls}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Slug</span>
          <input
            aria-label="slug"
            className={inputCls}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <span className="text-white/30 text-xs mt-0.5 block">URL-friendly identifier (auto-generated from name)</span>
        </label>

        <label className="block">
          <span className={labelCls}>Description</span>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what the customer gets"
          />
        </label>
      </section>

      {/* Pricing & Type */}
      <section className="space-y-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
        <h2 className="text-white/70 font-medium text-xs uppercase tracking-widest">Pricing &amp; Type</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Points cost</span>
            <input
              type="number"
              step="1"
              min="0"
              aria-label="points cost"
              className={inputCls}
              value={pointsCost}
              onChange={(e) => setPointsCost(Number(e.target.value))}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Reward type</span>
            <select
              aria-label="reward type"
              className={inputCls}
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value as RewardType)}
            >
              {REWARD_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-neutral-900">
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Value (blank = none)</span>
            <input
              type="number"
              step="0.01"
              aria-label="value"
              className={inputCls}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 10 for $10 discount"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Sort order</span>
            <input
              type="number"
              step="1"
              aria-label="sort order"
              className={inputCls}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      {/* Availability */}
      <section className="space-y-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
        <h2 className="text-white/70 font-medium text-xs uppercase tracking-widest">Availability</h2>

        <label className="block">
          <span className={labelCls}>Min tier required</span>
          <select
            aria-label="min tier required"
            className={inputCls}
            value={minTierRequired}
            onChange={(e) => setMinTierRequired(e.target.value)}
          >
            <option value="" className="bg-neutral-900">All tiers</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.slug} className="bg-neutral-900">
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Max per customer (blank = unlimited)</span>
            <input
              type="number"
              step="1"
              min="0"
              aria-label="max per customer"
              className={inputCls}
              value={maxPerCustomer}
              onChange={(e) => setMaxPerCustomer(e.target.value)}
              placeholder="Unlimited"
            />
          </label>

          <label className="block">
            <span className={labelCls}>Total available (blank = unlimited)</span>
            <input
              type="number"
              step="1"
              min="0"
              aria-label="total available"
              className={inputCls}
              value={totalAvailable}
              onChange={(e) => setTotalAvailable(e.target.value)}
              placeholder="Unlimited"
            />
          </label>
        </div>

        <label className="flex items-center gap-3 p-3 bg-white/[0.04] border border-white/[0.08] rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded"
            aria-label="is active"
          />
          <div>
            <span className="text-white font-medium text-sm">Active</span>
            <p className="text-white/40 text-xs">Visible to customers for redemption</p>
          </div>
        </label>
      </section>

      {/* Additional */}
      <section className="space-y-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
        <h2 className="text-white/70 font-medium text-xs uppercase tracking-widest">Additional</h2>

        <label className="block">
          <span className={labelCls}>Image URL</span>
          <input
            type="url"
            aria-label="image url"
            className={inputCls}
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="block">
          <span className={labelCls}>Metadata (JSON)</span>
          <textarea
            aria-label="metadata"
            className={`${inputCls} min-h-[80px] font-mono resize-y`}
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder='{"key": "value"}'
          />
          <span className="text-white/30 text-xs mt-0.5 block">Optional JSON for special reward properties</span>
        </label>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending || deleting}
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-[#FF3131] hover:bg-[#E02828] text-white font-medium text-sm disabled:opacity-50 transition-colors"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2 rounded-lg border border-white/[0.08] text-white/60 hover:text-white font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            disabled={pending || deleting}
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-medium text-sm disabled:opacity-50 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete reward'}
          </button>
        )}
      </div>
    </div>
  )
}
