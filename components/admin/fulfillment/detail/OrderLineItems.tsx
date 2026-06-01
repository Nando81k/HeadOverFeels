// components/admin/fulfillment/detail/OrderLineItems.tsx
import Image from 'next/image'
import type { OrderItemDetail } from '@/lib/admin/fulfillment'

interface OrderLineItemsProps {
  items: OrderItemDetail[]
}

function parseVariant(raw: string | null): { size?: string; color?: string } {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw) as { size?: string; color?: string }
    return obj
  } catch {
    return {}
  }
}

export function OrderLineItems({ items }: OrderLineItemsProps) {
  if (items.length === 0) {
    return <p className="text-sm text-white/40">No line items.</p>
  }
  return (
    <div className="border border-white/8 rounded-md overflow-hidden bg-neutral-900/60">
      <table className="w-full text-sm">
        <thead className="bg-neutral-900/80 border-b border-white/8 text-left text-xs uppercase text-white/50">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Variant</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const variant = parseVariant(it.variantDetails)
            const subtotal = it.quantity * it.price
            return (
              <tr key={it.id} className="border-b border-white/[0.04]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {it.productImage ? (
                      <Image src={it.productImage} alt="" width={32} height={32} className="rounded" />
                    ) : (
                      <div data-testid="line-item-no-image" className="w-8 h-8 bg-white/[0.06] rounded" />
                    )}
                    <div>
                      <div className="text-white">{it.productName}</div>
                      {it.sku && (
                        <div
                          className="text-[11px] text-white/40 font-mono"
                          title={it.sku}
                          data-sku={it.sku}
                          aria-label={`SKU: ${it.sku}`}
                        />
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-white/70 text-xs">
                  {variant.size && <span className="mr-2">Size: {variant.size}</span>}
                  {variant.color && <span>Color: {variant.color}</span>}
                </td>
                <td className="px-3 py-2 text-right text-white/70 tabular-nums">{it.quantity}</td>
                <td className="px-3 py-2 text-right text-white/70 tabular-nums" aria-label={`unit price ${it.price.toFixed(2)}`}>
                  {it.price.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-white tabular-nums">${subtotal.toFixed(2)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
