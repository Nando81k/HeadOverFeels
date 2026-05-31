'use client'

/**
 * ProductsListView — orchestration layer for the admin products list.
 *
 * Composes:
 *  - ProductsListTable (desktop)
 *  - ProductsListCardMobile (mobile — one card per row)
 *  - ProductInspector (slide-out quick-edit panel)
 *  - ProductBulkActionsSheet (bottom sheet, shown when ≥1 row selected)
 *
 * Responsibilities:
 *  - Manages selectedIds Set state (checkbox multi-select)
 *  - Opens ProductInspector when ⋯ row-action or mobile Edit is clicked
 *  - Fetches ProductDetailForInspector via loadProductDetail on demand
 *  - Opens ProductBulkActionsSheet whenever selectedIds.size > 0
 *  - Propagates onRefresh to parent after save / bulk action
 *
 * Phase 3 Task 8.
 */

import { useCallback, useState } from 'react'
import type { ProductRow, ProductDetailForInspector } from '@/lib/admin/products'
import { loadProductDetail } from '@/lib/admin/products'
import { ProductsListTable } from './ProductsListTable'
import { ProductsListCardMobile } from './ProductsListCardMobile'
import { ProductInspector } from './ProductInspector'
import { ProductBulkActionsSheet } from './ProductBulkActionsSheet'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductsListViewProps {
  /** Rows for the current page / filter result. */
  rows: ProductRow[]
  /** Show loading skeletons instead of rows. */
  loading?: boolean
  /** Called after a successful quick-edit save or bulk action so the parent can re-fetch. */
  onRefresh?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductsListView({ rows, loading = false, onRefresh }: ProductsListViewProps) {
  // ── Selection state ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleToggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = rows.map((r) => r.id)
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id))
      if (allSelected) {
        return new Set()
      }
      return new Set(allIds)
    })
  }, [rows])

  // ── Inspector state ──────────────────────────────────────────────────────────
  const [inspectorProduct, setInspectorProduct] = useState<ProductDetailForInspector | null>(null)

  const openInspector = useCallback(async (productId: string) => {
    const detail = await loadProductDetail(productId)
    if (detail) {
      setInspectorProduct(detail)
    }
  }, [])

  const closeInspector = useCallback(() => {
    setInspectorProduct(null)
  }, [])

  const handleSaved = useCallback(
    (_productId: string) => {
      setInspectorProduct(null)
      onRefresh?.()
    },
    [onRefresh],
  )

  // ── Bulk sheet state ─────────────────────────────────────────────────────────
  const bulkOpen = selectedIds.size > 0

  const handleBulkClose = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkSuccess = useCallback(() => {
    setSelectedIds(new Set())
    onRefresh?.()
  }, [onRefresh])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Desktop table — hidden on mobile */}
      <ProductsListTable
        rows={rows}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onToggleAll={handleToggleAll}
        onRowAction={openInspector}
        loading={loading}
      />

      {/* Mobile card list — hidden on desktop */}
      <div className="md:hidden" data-testid="products-list-mobile">
        {rows.map((row) => (
          <ProductsListCardMobile
            key={row.id}
            row={row}
            isSelected={selectedIds.has(row.id)}
            onSelect={() => handleToggle(row.id)}
            onLongPress={() => handleToggle(row.id)}
            onEdit={() => openInspector(row.id)}
          />
        ))}
      </div>

      {/* Quick-edit slide-out inspector */}
      <ProductInspector
        product={inspectorProduct}
        onClose={closeInspector}
        onSaved={handleSaved}
      />

      {/* Bulk actions bottom sheet — shown when ≥1 selected */}
      <ProductBulkActionsSheet
        selectedIds={Array.from(selectedIds)}
        open={bulkOpen}
        onClose={handleBulkClose}
        onSuccess={handleBulkSuccess}
      />
    </>
  )
}
