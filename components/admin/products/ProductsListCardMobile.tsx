// components/admin/products/ProductsListCardMobile.tsx
'use client'

import Image from 'next/image'
import { Package, Timer, CheckCircle } from '@phosphor-icons/react'
import type { ProductRow } from '@/lib/admin/products'

// ── helpers ────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function stockColor(inventory: number) {
  if (inventory === 0) return 'text-red-400'
  if (inventory <= 10) return 'text-amber-400'
  return 'text-white'
}

function statusBadge(status: ProductRow['status'], isDrop: boolean) {
  if (isDrop)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF3131]/15 text-[#FF3131] ring-1 ring-inset ring-[#FF3131]/30">
        <Timer size={10} weight="bold" />
        Drop · Live
      </span>
    )
  if (status === 'ACTIVE')
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
        Active
      </span>
    )
  if (status === 'ARCHIVED')
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50">
        Archived
      </span>
    )
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/40">
      Draft
    </span>
  )
}

// ── types ──────────────────────────────────────────────────────────────────

export interface ProductsListCardMobileProps {
  row: ProductRow
  isSelected: boolean
  onSelect: () => void
  /** Triggered by right-click / long-press (via onContextMenu) */
  onLongPress: () => void
  onEdit: () => void
}

// ── component ──────────────────────────────────────────────────────────────

export function ProductsListCardMobile({
  row,
  isSelected,
  onSelect,
  onLongPress,
  onEdit,
}: ProductsListCardMobileProps) {
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress()
      }}
      className={[
        'relative flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0',
        'transition-colors active:bg-white/5',
        isSelected ? 'bg-[#FF3131]/8' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="products-list-card-mobile"
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={isSelected ? 'Deselect product' : 'Select product'}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className={[
          'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
          isSelected
            ? 'bg-[#FF3131] border-[#FF3131]'
            : 'border-white/20 bg-white/5',
        ].join(' ')}
      >
        {isSelected && <CheckCircle size={12} weight="bold" className="text-white" aria-hidden />}
      </button>

      {/* Thumbnail */}
      <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
        {row.primaryImage ? (
          <Image
            src={row.primaryImage}
            alt={row.name}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <Package size={20} className="text-white/20" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Row 1: name + status badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-white leading-tight truncate">{row.name}</p>
          {statusBadge(row.status, row.isDrop)}
        </div>

        {/* Row 2: category · SKU */}
        <p className="text-[11px] text-white/40 truncate mb-1.5">
          {[row.category, row.sku ? `SKU: ${row.sku}` : null].filter(Boolean).join(' · ')}
        </p>

        {/* Row 3: price / inventory / edit */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{formatPrice(row.price)}</span>
          <span className={['text-xs font-medium', stockColor(row.inventory)].join(' ')}>
            {row.inventory} in stock
          </span>
          {row.variantCount > 1 && (
            <span className="text-[10px] text-white/30">{row.variantCount} variants</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="ml-auto text-[11px] font-medium text-white/50 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/5"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}
