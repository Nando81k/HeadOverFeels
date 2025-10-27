'use client'

import Link from 'next/link';
import { AlertTriangle, Package } from 'lucide-react';
import { useState } from 'react';
import { RestockModal } from './RestockModal';

interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  variants: Array<{
    id: string;
    size: string | null;
    color: string | null;
    inventory: number;
  }>;
}

interface LowStockAlertsProps {
  products: LowStockProduct[];
  threshold?: number;
}

export default function LowStockAlerts({ products, threshold = 5 }: LowStockAlertsProps) {
  const [selectedProduct, setSelectedProduct] = useState<LowStockProduct | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRestock = (product: LowStockProduct, e: React.MouseEvent) => {
    e.preventDefault() // Prevent Link navigation
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProduct(null)
  }

  const handleRestockSuccess = () => {
    // Reload the page to show updated inventory
    window.location.reload()
  }

  if (products.length === 0) {
    return null;
  }

  const totalLowStockVariants = products.reduce(
    (sum, product) => sum + product.variants.filter(v => v.inventory < threshold).length,
    0
  );

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Low Stock Alert</h3>
              <p className="text-sm text-gray-600 mt-1">
                {totalLowStockVariants} variant{totalLowStockVariants !== 1 ? 's' : ''} running low (below {threshold} units)
              </p>
            </div>
            <Link
              href="/admin/products"
              className="text-sm text-amber-700 hover:text-amber-800 font-medium"
            >
              View All Products →
            </Link>
          </div>

          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div
                key={product.id}
                className="block p-4 bg-white rounded-lg border border-amber-200 hover:border-amber-300 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link href={`/admin/products/${product.id}`} className="flex-1">
                    <div>
                      <h4 className="font-medium text-gray-900 hover:text-amber-700 transition-colors">
                        {product.name}
                      </h4>
                      <div className="flex gap-2 mt-2">
                        {product.variants
                          .filter(v => v.inventory < threshold)
                          .map((variant) => (
                            <span
                              key={variant.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800"
                            >
                              {variant.size && <span>{variant.size}</span>}
                              {variant.size && variant.color && <span>•</span>}
                              {variant.color && <span>{variant.color}</span>}
                              <span className="font-bold">({variant.inventory})</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-2xl font-bold text-amber-600">
                        {product.variants.reduce((sum, v) => sum + v.inventory, 0)}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Total Stock</p>
                    </div>
                    <button
                      onClick={(e) => handleRestock(product, e)}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                      title="Restock Product"
                    >
                      <Package className="w-4 h-4" />
                      Restock
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {products.length > 5 && (
            <p className="text-sm text-gray-600 mt-4 text-center">
              And {products.length - 5} more product{products.length - 5 !== 1 ? 's' : ''} with low stock
            </p>
          )}
        </div>
      </div>

      {/* Restock Modal */}
      {selectedProduct && (
        <RestockModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleRestockSuccess}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          variants={selectedProduct.variants.map(v => ({
            id: v.id,
            sku: `${v.size || ''}-${v.color || ''}`.replace(/^-|-$/g, '') || 'default',
            size: v.size || undefined,
            color: v.color || undefined,
            inventory: v.inventory,
          }))}
        />
      )}
    </div>
  );
}
