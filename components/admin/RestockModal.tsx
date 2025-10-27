'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Package, AlertCircle } from 'lucide-react'

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

export function RestockModal({
  isOpen,
  onClose,
  productId,
  productName,
  variants,
  onSuccess,
}: RestockModalProps) {
  const [inventoryUpdates, setInventoryUpdates] = useState<Record<string, number>>(
    variants.reduce((acc, v) => ({ ...acc, [v.id]: v.inventory }), {})
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInventoryChange = (variantId: string, value: number) => {
    setInventoryUpdates((prev) => ({
      ...prev,
      [variantId]: Math.max(0, value),
    }))
  }

  const hasChanges = variants.some(
    (v) => inventoryUpdates[v.id] !== v.inventory
  )

  const getTotalChange = () => {
    return variants.reduce((sum, v) => {
      const change = inventoryUpdates[v.id] - v.inventory
      return sum + change
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const updates = variants.map((v) => ({
        id: v.id,
        inventory: inventoryUpdates[v.id],
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setInventoryUpdates(
      variants.reduce((acc, v) => ({ ...acc, [v.id]: v.inventory }), {})
    )
    setNotes('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Restock Inventory
                </h2>
                <p className="text-sm text-gray-500">{productName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Variants Table */}
              <div className="space-y-3 mb-6">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider px-4">
                  <div className="col-span-3">Variant</div>
                  <div className="col-span-2">SKU</div>
                  <div className="col-span-2 text-center">Current</div>
                  <div className="col-span-2 text-center">New</div>
                  <div className="col-span-3 text-right">Change</div>
                </div>

                {variants.map((variant) => {
                  const currentInventory = variant.inventory
                  const newInventory = inventoryUpdates[variant.id]
                  const change = newInventory - currentInventory
                  const isLowStock = newInventory <= 5 && newInventory > 0
                  const isOutOfStock = newInventory === 0

                  return (
                    <div
                      key={variant.id}
                      className="grid grid-cols-12 gap-4 items-center p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      {/* Variant Info */}
                      <div className="col-span-3">
                        <div className="font-medium text-gray-900">
                          {[variant.size, variant.color]
                            .filter(Boolean)
                            .join(' / ') || 'Default'}
                        </div>
                      </div>

                      {/* SKU */}
                      <div className="col-span-2">
                        <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                          {variant.sku}
                        </code>
                      </div>

                      {/* Current Inventory */}
                      <div className="col-span-2 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-16 h-8 rounded font-semibold text-sm ${
                            currentInventory === 0
                              ? 'bg-red-100 text-red-700'
                              : currentInventory <= 5
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {currentInventory}
                        </span>
                      </div>

                      {/* New Inventory Input */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          value={newInventory}
                          onChange={(e) =>
                            handleInventoryChange(
                              variant.id,
                              parseInt(e.target.value) || 0
                            )
                          }
                          className={`w-full px-3 py-2 border rounded-lg text-center font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                            isOutOfStock
                              ? 'border-red-300 bg-red-50'
                              : isLowStock
                              ? 'border-orange-300 bg-orange-50'
                              : 'border-gray-300'
                          }`}
                        />
                      </div>

                      {/* Change */}
                      <div className="col-span-3 text-right">
                        {change !== 0 && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${
                              change > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {change > 0 ? '+' : ''}
                            {change}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              {hasChanges && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-900">
                      Total Change:
                    </span>
                    <span
                      className={`text-lg font-bold ${
                        getTotalChange() > 0
                          ? 'text-green-700'
                          : getTotalChange() < 0
                          ? 'text-red-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {getTotalChange() > 0 ? '+' : ''}
                      {getTotalChange()} units
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restock Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., New shipment arrived, seasonal restock, returned items..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || loading}
              >
                Reset
              </Button>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!hasChanges || loading}
                  className="min-w-32"
                >
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
