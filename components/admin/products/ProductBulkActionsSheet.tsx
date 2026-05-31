'use client'

/**
 * ProductBulkActionsSheet
 *
 * A bottom-anchored slide-over sheet listing 7 bulk actions for a selection
 * of products. Wires directly to server actions in app/admin/products/actions.ts.
 *
 * Actions (v1 — prompt/confirm UX is intentional simplicity):
 *  1. Archive           → bulkArchive
 *  2. Delete            → bulkDelete  (SUPER_ADMIN only, shown to all, server enforces role)
 *  3. Duplicate         → bulkDuplicate
 *  4. Change Category   → bulkChangeCategory (prompt for categoryId)
 *  5. Price Update      → bulkPriceUpdate    (prompt for amount / mode)
 *  6. Add Tag           → bulkAddTag         (stubs — server returns error toast)
 *  7. Set Featured      → bulkSetFeatured    (toggle on/off)
 *
 * Phase 3 Task 7.
 */

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  bulkArchive,
  bulkDelete,
  bulkDuplicate,
  bulkChangeCategory,
  bulkPriceUpdate,
  bulkAddTag,
  bulkSetFeatured,
} from '@/app/admin/products/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProductBulkActionsSheetProps {
  /** IDs of currently selected products. */
  selectedIds: string[]
  /** Whether the sheet is visible. */
  open: boolean
  /** Called when the sheet should close (e.g. backdrop click, close button, or after action). */
  onClose: () => void
  /** Called after a successful action so the parent can refresh the list. */
  onSuccess: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function label(ids: string[]): string {
  const n = ids.length
  return n === 1 ? '1 product' : `${n} products`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ProductBulkActionsSheet({
  selectedIds,
  open,
  onClose,
  onSuccess,
}: ProductBulkActionsSheetProps) {
  const [pending, startTransition] = useTransition()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  function isLoading(action: string) {
    return loadingAction === action && pending
  }

  // ── Action wrappers ───────────────────────────────────────────────────────────

  function run(
    actionKey: string,
    fn: () => Promise<{ ok: boolean; error?: string; affected?: number }>,
  ) {
    setLoadingAction(actionKey)
    startTransition(async () => {
      try {
        const result = await fn()
        if (result.ok) {
          const affected = 'affected' in result ? result.affected : undefined
          const count = affected !== undefined ? affected : selectedIds.length
          toast.success(`Done — ${count} ${count === 1 ? 'product' : 'products'} updated.`)
          onSuccess()
          onClose()
        } else {
          toast.error(result.error ?? 'Action failed.')
        }
      } catch {
        toast.error('An unexpected error occurred.')
      } finally {
        setLoadingAction(null)
      }
    })
  }

  // 1. Archive
  function handleArchive() {
    if (!confirm(`Archive ${label(selectedIds)}?`)) return
    run('archive', () => bulkArchive(selectedIds))
  }

  // 2. Delete
  function handleDelete() {
    if (
      !confirm(
        `Permanently delete ${label(selectedIds)}? This requires SUPER_ADMIN role and cannot be undone.`,
      )
    )
      return
    run('delete', () => bulkDelete(selectedIds))
  }

  // 3. Duplicate
  function handleDuplicate() {
    if (!confirm(`Duplicate ${label(selectedIds)}? Copies start as inactive drafts.`)) return
    run('duplicate', () => bulkDuplicate(selectedIds))
  }

  // 4. Change Category
  function handleChangeCategory() {
    const categoryId = prompt('Enter the target Category ID:')
    if (!categoryId || !categoryId.trim()) return
    run('change-category', () => bulkChangeCategory(selectedIds, categoryId.trim()))
  }

  // 5. Price Update
  function handlePriceUpdate() {
    const raw = prompt(
      'Enter price update:\n' +
        '  • Set price:          set:<amount>   e.g. set:99.99\n' +
        '  • Adjust by amount:   +<amount>      e.g. +10 or -5\n' +
        '  • Adjust by percent:  <value>%       e.g. 10% or -15%',
    )
    if (!raw || !raw.trim()) return

    const trimmed = raw.trim()

    let mode: 'set' | 'adjust-amount' | 'adjust-pct'
    let value: number

    if (trimmed.startsWith('set:')) {
      mode = 'set'
      value = parseFloat(trimmed.slice(4))
    } else if (trimmed.endsWith('%')) {
      mode = 'adjust-pct'
      value = parseFloat(trimmed.slice(0, -1))
    } else {
      mode = 'adjust-amount'
      value = parseFloat(trimmed)
    }

    if (!Number.isFinite(value)) {
      toast.error('Invalid price value.')
      return
    }

    run('price-update', () => bulkPriceUpdate(selectedIds, { mode, value }))
  }

  // 6. Add Tag
  function handleAddTag() {
    const tag = prompt('Enter tag to add (note: tag support is coming soon):')
    if (!tag || !tag.trim()) return
    run('add-tag', () => bulkAddTag(selectedIds, tag.trim()))
  }

  // 7. Set Featured
  function handleSetFeatured(featured: boolean) {
    const verb = featured ? 'Mark' : 'Unmark'
    if (!confirm(`${verb} ${label(selectedIds)} as featured?`)) return
    run('set-featured', () => bulkSetFeatured(selectedIds, featured))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bulk-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="bulk-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Bulk actions for ${label(selectedIds)}`}
            data-testid="bulk-actions-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-neutral-950 border-t border-white/10 rounded-t-2xl shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div>
                <p className="text-sm font-bold text-white">Bulk Actions</p>
                <p className="text-[11px] text-white/45 mt-0.5">{label(selectedIds)} selected</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close bulk actions"
                className="text-white/40 hover:text-white/80 transition-colors text-xl leading-none px-1"
              >
                ✕
              </button>
            </div>

            {/* Action list */}
            <ul className="px-4 py-3 space-y-1 pb-safe-area-inset-bottom">
              <ActionItem
                label="Archive"
                description="Set selected products to inactive"
                icon="📦"
                tone="default"
                loading={isLoading('archive')}
                disabled={pending}
                onClick={handleArchive}
              />
              <ActionItem
                label="Delete"
                description="Permanently delete (SUPER_ADMIN only)"
                icon="🗑"
                tone="danger"
                loading={isLoading('delete')}
                disabled={pending}
                onClick={handleDelete}
              />
              <ActionItem
                label="Duplicate"
                description="Copy as inactive draft products"
                icon="⧉"
                tone="default"
                loading={isLoading('duplicate')}
                disabled={pending}
                onClick={handleDuplicate}
              />
              <ActionItem
                label="Change Category"
                description="Reassign to another category"
                icon="🏷"
                tone="default"
                loading={isLoading('change-category')}
                disabled={pending}
                onClick={handleChangeCategory}
              />
              <ActionItem
                label="Price Update"
                description="Set, increase, or discount price"
                icon="💲"
                tone="default"
                loading={isLoading('price-update')}
                disabled={pending}
                onClick={handlePriceUpdate}
              />
              <ActionItem
                label="Add Tag"
                description="Tag support coming soon — will show error"
                icon="🔖"
                tone="default"
                loading={isLoading('add-tag')}
                disabled={pending}
                onClick={handleAddTag}
              />
              <li className="flex gap-2">
                <ActionItem
                  label="Mark Featured"
                  description=""
                  icon="⭐"
                  tone="default"
                  loading={isLoading('set-featured') && pending}
                  disabled={pending}
                  onClick={() => handleSetFeatured(true)}
                  className="flex-1"
                />
                <ActionItem
                  label="Unmark Featured"
                  description=""
                  icon="☆"
                  tone="default"
                  loading={isLoading('set-featured') && pending}
                  disabled={pending}
                  onClick={() => handleSetFeatured(false)}
                  className="flex-1"
                />
              </li>
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── ActionItem ────────────────────────────────────────────────────────────────

interface ActionItemProps {
  label: string
  description: string
  icon: string
  tone: 'default' | 'danger'
  loading: boolean
  disabled: boolean
  onClick: () => void
  className?: string
}

function ActionItem({
  label: actionLabel,
  description,
  icon,
  tone,
  loading,
  disabled,
  onClick,
  className = '',
}: ActionItemProps) {
  const isDanger = tone === 'danger'
  return (
    <li className={className || undefined}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={actionLabel}
        data-testid={`bulk-action-${actionLabel.toLowerCase().replace(/\s+/g, '-')}`}
        className={[
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isDanger
            ? 'hover:bg-red-500/10 text-red-400'
            : 'hover:bg-white/[0.04] text-white/85',
          loading ? 'opacity-60' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="text-base shrink-0" aria-hidden>
          {loading ? '…' : icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold">{actionLabel}</span>
          {description && (
            <span className="block text-[10px] text-white/35 mt-0.5 truncate">{description}</span>
          )}
        </span>
      </button>
    </li>
  )
}
