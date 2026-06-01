'use client'

/**
 * CollectionDetailView — drag-and-drop product ordering within a collection.
 *
 * Uses dnd-kit's DndContext + SortableContext + useSortable to let admins
 * reorder products in a collection. Calls reorderCollectionProducts server
 * action on drag-end.
 *
 * Phase 3 Task 10 — schema notes:
 *   - Junction field is `sortOrder` (not `position`). The loader exposes it
 *     as `position` on CollectionProductRef; this component reads `position`
 *     for initial sort key.
 *   - reorderCollectionProducts(collectionId, productIds) handles sortOrder
 *     mapping internally.
 */

import Image from 'next/image'
import { useOptimistic, useTransition, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { reorderCollectionProducts } from '@/app/admin/products/actions'
import type { CollectionWithProducts, CollectionProductRef } from '@/lib/admin/products'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionDetailViewProps {
  collection: CollectionWithProducts
}

// ─── SortableItem ─────────────────────────────────────────────────────────────

interface SortableItemProps {
  product: CollectionProductRef
  index: number
}

function SortableItem({ product, index }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="sortable-item"
      className={[
        'flex items-center gap-4 rounded-lg border p-3 transition-colors',
        'bg-neutral-900/60 border-white/8 hover:bg-neutral-900/80',
        isDragging ? 'shadow-lg ring-1 ring-red-500/40 bg-neutral-900' : '',
      ].join(' ')}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab text-white/30 hover:text-white/60 active:cursor-grabbing focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500/40 rounded"
        data-testid="drag-handle"
      >
        {/* Hamburger dots icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="4" cy="4" r="1.5" />
          <circle cx="12" cy="4" r="1.5" />
          <circle cx="4" cy="8" r="1.5" />
          <circle cx="12" cy="8" r="1.5" />
          <circle cx="4" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      </button>

      {/* Position badge */}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-white/55">
        {index + 1}
      </span>

      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/5 border border-white/8">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage}
            alt={product.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/20">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zm0 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-3 6.5c0-1.657 1.343-3 3-3s3 1.343 3 3H7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Product name */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
        {product.name}
      </span>
    </div>
  )
}

// ─── CollectionDetailView ─────────────────────────────────────────────────────

export function CollectionDetailView({ collection }: CollectionDetailViewProps) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  // Optimistic ordered list — starts from loader-provided order (already sorted by sortOrder).
  const [optimisticProducts, updateOptimisticProducts] = useOptimistic(
    collection.products,
    (_prev: CollectionProductRef[], next: CollectionProductRef[]) => next,
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = optimisticProducts.findIndex((p) => p.id === active.id)
    const newIndex = optimisticProducts.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(optimisticProducts, oldIndex, newIndex)
    const productIds = reordered.map((p) => p.id)

    setSaveError(null)

    startTransition(async () => {
      updateOptimisticProducts(reordered)
      const result = await reorderCollectionProducts(collection.id, productIds)
      if (!result.ok) {
        setSaveError((result as { ok: false; error: string }).error ?? 'Reorder failed.')
      }
    })
  }

  return (
    <div className="space-y-4" data-testid="collection-detail-view">
      {/* Header */}
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-white">
          {collection.name}
        </h2>
        {collection.description && (
          <p className="mt-1 text-sm text-white/50">
            {collection.description}
          </p>
        )}
        <p className="mt-1 text-xs text-white/30">
          {collection.products.length} product{collection.products.length !== 1 ? 's' : ''} — drag to reorder
        </p>
      </div>

      {/* Saving indicator */}
      {isPending && (
        <p className="text-xs text-red-400" data-testid="saving-indicator">
          Saving order…
        </p>
      )}

      {/* Error */}
      {saveError && (
        <p className="text-xs text-red-400" role="alert" data-testid="save-error">
          {saveError}
        </p>
      )}

      {/* Empty state */}
      {optimisticProducts.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 py-12 text-center">
          <p className="text-sm text-white/40">No products in this collection yet.</p>
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={optimisticProducts.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" data-testid="sortable-list">
            {optimisticProducts.map((product, index) => (
              <SortableItem key={product.id} product={product} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
