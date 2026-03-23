'use client'

import { useEffect, useMemo, useState } from 'react'
import { Package, Warning, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface Variant {
  id: string
  sku: string
  size?: string
  color?: string
  inventory: number
}

interface RestockModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  productName: string
  variants: Variant[]
  onSuccess: () => void
}

function formatVariantLabel(variant: Variant): string {
  return [variant.size, variant.color].filter(Boolean).join(' / ') || 'Default'
}

export function RestockModal({
  isOpen,
  onClose,
  productId,
  productName,
  variants,
  onSuccess,
}: RestockModalProps) {
  const [inventoryUpdates, setInventoryUpdates] = useState<Record<string, number>>(
    variants.reduce((accumulator, variant) => ({ ...accumulator, [variant.id]: variant.inventory }), {})
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, loading, onClose])

  useEffect(() => {
    setInventoryUpdates(variants.reduce((accumulator, variant) => ({ ...accumulator, [variant.id]: variant.inventory }), {}))
    setNotes('')
    setError('')
  }, [variants, isOpen])

  const hasChanges = useMemo(
    () => variants.some((variant) => inventoryUpdates[variant.id] !== variant.inventory),
    [variants, inventoryUpdates]
  )

  const totalChange = useMemo(
    () =>
      variants.reduce((sum, variant) => {
        const nextValue = inventoryUpdates[variant.id]
        return sum + (nextValue - variant.inventory)
      }, 0),
    [variants, inventoryUpdates]
  )

  const handleInventoryChange = (variantId: string, nextValue: number) => {
    setInventoryUpdates((previous) => ({
      ...previous,
      [variantId]: Math.max(0, nextValue),
    }))
  }

  const applyQuickIncrement = (variantId: string, increment: number) => {
    setInventoryUpdates((previous) => ({
      ...previous,
      [variantId]: Math.max(0, (previous[variantId] || 0) + increment),
    }))
  }

  const handleReset = () => {
    setInventoryUpdates(variants.reduce((accumulator, variant) => ({ ...accumulator, [variant.id]: variant.inventory }), {}))
    setNotes('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const updates = variants.map((variant) => ({
        id: variant.id,
        inventory: inventoryUpdates[variant.id],
      }))

      const response = await fetch(`/api/products/${productId}/restock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: updates, notes }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update inventory')
      }

      onSuccess()
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update inventory')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Restock inventory">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF3131]/20 flex items-center justify-center">
                <Package size={18} className="text-[#FF3131]" weight="bold" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">Restock Inventory</h2>
                <p className="text-xs text-white/45">{productName}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              disabled={loading}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(92vh-64px)]">
            <div className="p-4 space-y-3 overflow-y-auto">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <Warning size={18} className="text-red-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-12 px-3 text-[10px] uppercase tracking-[0.14em] text-white/40">
                <div className="col-span-3">Variant</div>
                <div className="col-span-3">SKU</div>
                <div className="col-span-2 text-center">Current</div>
                <div className="col-span-2 text-center">New</div>
                <div className="col-span-2 text-center">Quick</div>
              </div>

              <div className="space-y-2">
                {[...variants]
                  .sort((a, b) => inventoryUpdates[a.id] - inventoryUpdates[b.id])
                  .map((variant) => {
                    const currentInventory = variant.inventory
                    const nextInventory = inventoryUpdates[variant.id]
                    const change = nextInventory - currentInventory
                    const isOutOfStock = nextInventory === 0
                    const isLowStock = nextInventory > 0 && nextInventory <= 5

                    return (
                      <div key={variant.id} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="col-span-3 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{formatVariantLabel(variant)}</div>
                          {change !== 0 && (
                            <div className={`text-[11px] ${change > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                              {change > 0 ? '+' : ''}
                              {change} units
                            </div>
                          )}
                        </div>

                        <div className="col-span-3 min-w-0">
                          <code className="inline-flex max-w-full truncate rounded bg-black/30 border border-white/10 px-2 py-1 text-[11px] text-white/70">
                            {variant.sku}
                          </code>
                        </div>

                        <div className="col-span-2 text-center">
                          <span
                            className={`inline-flex min-w-[50px] justify-center rounded px-2 py-1 text-sm font-semibold ${
                              currentInventory === 0
                                ? 'bg-red-500/15 text-red-300'
                                : currentInventory <= 5
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {currentInventory}
                          </span>
                        </div>

                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            value={nextInventory}
                            onChange={(event) => handleInventoryChange(variant.id, parseInt(event.target.value, 10) || 0)}
                            className={`w-full h-9 rounded-md border px-2 text-center text-sm font-semibold bg-neutral-900 text-white focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45 ${
                              isOutOfStock
                                ? 'border-red-500/40'
                                : isLowStock
                                ? 'border-amber-500/40'
                                : 'border-white/15'
                            }`}
                          />
                        </div>

                        <div className="col-span-2 flex items-center justify-center gap-1">
                          {[5, 10, 25].map((increment) => (
                            <button
                              key={increment}
                              type="button"
                              onClick={() => applyQuickIncrement(variant.id, increment)}
                              className="h-7 min-w-8 rounded border border-white/15 bg-white/[0.02] px-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                            >
                              +{increment}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>

              <div className="pt-2">
                <label className="block text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5">Restock Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Shipment source, damaged items, reason for adjustment..."
                  className="w-full rounded-md border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#FF3131]/45"
                />
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 px-4 py-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-white/45 mr-2">Net change</span>
                <span className={`font-semibold ${totalChange > 0 ? 'text-emerald-300' : totalChange < 0 ? 'text-red-300' : 'text-white/70'}`}>
                  {totalChange > 0 ? '+' : ''}
                  {totalChange} units
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges || loading}
                  className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!hasChanges || loading} className="min-w-32 bg-[#FF3131] hover:bg-[#E02828]">
                  {loading ? 'Updating...' : 'Update Inventory'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
