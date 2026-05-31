'use client'

/**
 * ProductInspector — quick-edit slide-out panel for admin products.
 *
 * Renders a right-anchored slide-over drawer that:
 *  - Displays read-only product metadata (image, name, price, inventory,
 *    isDrop indicator, dropStock progress bar, accessTier placeholder)
 *  - Allows quick-editing: name, price, status (Active / Archived toggle),
 *    and isFeatured checkbox
 *  - Submits via saveProductQuickEdit server action
 *  - Shows inline success / error feedback
 *
 * Phase 3 Task 6 — schema adaptations vs plan:
 *  - Plan assumed `featured: boolean` in QuickEditFields
 *    → actual: `isFeatured: boolean` (Product.isFeatured in schema)
 *  - Plan assumed `status` was a 3-value enum with DRAFT
 *    → actual: ProductStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
 *      But schema uses isActive boolean; DRAFT is not representable.
 *      Status rendered as 2-button toggle (Active / Archived) — DRAFT omitted.
 *  - Plan assumed `tags: string[]` in QuickEditFields
 *    → tags NOT in QuickEditFields (no Product.tags in schema).
 *      Tags UI block is omitted.
 * // TODO: tags UI when Product.tags is added to schema
 */

import Image from 'next/image'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { ProductDetailForInspector } from '@/lib/admin/products'
import {
  saveProductQuickEdit,
  type QuickEditFields,
  type ProductStatus,
} from '@/app/admin/products/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductInspectorProps {
  /** Product to display and edit. `null` means the panel is closed. */
  product: ProductDetailForInspector | null
  /** Called when the user dismisses the panel (X button or backdrop click). */
  onClose: () => void
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: (productId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function dropStockPercent(dropStock: { used: number; max: number }): number {
  if (dropStock.max === 0) return 0
  return Math.min(100, Math.round((dropStock.used / dropStock.max) * 100))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductInspector({ product, onClose, onSaved }: ProductInspectorProps) {
  const isOpen = product !== null

  // Form state — initialised / reset whenever `product` changes.
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<ProductStatus>('ACTIVE')
  const [isFeatured, setIsFeatured] = useState(false)

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const nameInputRef = useRef<HTMLInputElement>(null)

  // Sync form to new product
  useEffect(() => {
    if (!product) return
    setName(product.name)
    setPrice(String(product.price))
    // Only map ACTIVE / ARCHIVED — DRAFT not representable in schema
    setStatus(product.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE')
    setIsFeatured(product.featured)
    setSaveError(null)
    setSaveSuccess(false)
  }, [product])

  // Focus name input when drawer opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => nameInputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  function handleSave() {
    if (!product) return
    setSaveError(null)
    setSaveSuccess(false)

    const priceNum = parseFloat(price)
    if (!name.trim()) {
      setSaveError('Name is required.')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setSaveError('Price must be a positive number.')
      return
    }

    const fields: QuickEditFields = {
      name: name.trim(),
      price: priceNum,
      status,
      isFeatured,
    }

    startTransition(async () => {
      const result = await saveProductQuickEdit(product.id, fields)
      if (result.ok) {
        setSaveSuccess(true)
        onSaved?.(product.id)
      } else {
        setSaveError(result.error)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Product Inspector"
        data-testid="product-inspector"
        className={[
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col',
          'bg-[#0a0a0a] border-l border-white/10 shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {product && (
          <>
            {/* ── Header ─────────────────────────────────────────────── */}
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/60">
                Product Inspector
              </h2>
              <button
                aria-label="Close inspector"
                onClick={onClose}
                className="rounded p-1 text-white/40 hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

              {/* Product hero */}
              <div className="flex gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                  {product.primaryImage ? (
                    <Image
                      src={product.primaryImage}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-1 overflow-hidden">
                  <p className="truncate text-base font-semibold text-white">{product.name}</p>
                  <p className="text-sm text-white/50">{formatPrice(product.price)}</p>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span>{product.inventory} in stock</span>
                    {product.isDrop && (
                      <span className="rounded bg-[#FF3131]/20 px-1.5 py-0.5 text-[#FF3131] font-medium">
                        Drop
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Drop stock bar */}
              {product.dropStock && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/50">
                    <span>Drop stock</span>
                    <span>
                      {product.dropStock.used} / {product.dropStock.max} sold
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#FF3131]"
                      style={{ width: `${dropStockPercent(product.dropStock)}%` }}
                      data-testid="drop-stock-bar"
                    />
                  </div>
                </div>
              )}

              {/* Access tier placeholder */}
              {/* TODO: render accessTier UI when dropAccessTier is added to schema */}

              <hr className="border-white/10" />

              {/* ── Quick-edit fields ──────────────────────────────── */}

              {/* Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="inspector-name"
                  className="block text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Name
                </label>
                <input
                  ref={nameInputRef}
                  id="inspector-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={[
                    'w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white',
                    'placeholder:text-white/30 focus:outline-none focus-visible:ring-2',
                    'focus-visible:ring-[#FF3131]/60',
                    !name.trim() && saveError ? 'border-red-500' : 'border-white/10',
                  ].join(' ')}
                />
              </div>

              {/* Price */}
              <div className="space-y-1.5">
                <label
                  htmlFor="inspector-price"
                  className="block text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Price ($)
                </label>
                <input
                  id="inspector-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60"
                />
              </div>

              {/* Status toggle — Active / Archived only (DRAFT not in schema) */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Status
                </p>
                <div
                  role="group"
                  aria-label="Product status"
                  className="flex overflow-hidden rounded-lg border border-white/10"
                >
                  {(['ACTIVE', 'ARCHIVED'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={status === s}
                      onClick={() => setStatus(s)}
                      className={[
                        'flex-1 py-2 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF3131]/60',
                        status === s
                          ? s === 'ACTIVE'
                            ? 'bg-emerald-600/20 text-emerald-400'
                            : 'bg-white/10 text-white/60'
                          : 'bg-transparent text-white/30 hover:text-white/60',
                      ].join(' ')}
                    >
                      {s === 'ACTIVE' ? 'Active' : 'Archived'}
                    </button>
                  ))}
                </div>
              </div>

              {/* isFeatured */}
              <div className="flex items-center gap-3">
                <input
                  id="inspector-featured"
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[#FF3131] cursor-pointer"
                />
                <label
                  htmlFor="inspector-featured"
                  className="cursor-pointer select-none text-sm text-white/70"
                >
                  Featured product
                </label>
              </div>

              {/* TODO: tags UI when Product.tags is added to schema */}

              {/* Feedback */}
              {saveSuccess && (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-600/15 px-3 py-2 text-xs font-medium text-emerald-400"
                >
                  Changes saved successfully.
                </p>
              )}
              {saveError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400"
                >
                  {saveError}
                </p>
              )}
            </div>

            {/* ── Footer actions ─────────────────────────────────────── */}
            <footer className="flex gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-white/60 hover:text-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className={[
                  'flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors',
                  'bg-[#FF3131] hover:bg-[#e02020] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3131]/60',
                  isPending ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </>
        )}
      </aside>
    </>
  )
}
