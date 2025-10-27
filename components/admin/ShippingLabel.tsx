'use client'

import { forwardRef } from 'react'

interface ShippingLabelProps {
  order: {
    orderNumber: string
    trackingNumber?: string | null
    carrier?: string | null
    createdAt: Date | string
    shippingAddress: {
      firstName: string
      lastName: string
      address1: string
      address2?: string | null
      city: string
      state: string
      zipCode: string
      country: string
    }
    items: Array<{
      quantity: number
      product: {
        name: string
      }
      productVariant?: {
        size?: string | null
        color?: string | null
      } | null
    }>
    shipping: number
    total: number
  }
}

// Business address (from)
const FROM_ADDRESS = {
  name: 'Head Over Feels',
  address1: '123 Fashion District',
  address2: 'Suite 500',
  city: 'Los Angeles',
  state: 'CA',
  zipCode: '90012',
  country: 'USA',
  phone: '(555) 123-4567',
}

const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(
  ({ order }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white p-8 max-w-4xl mx-auto"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">HEAD OVER FEELS</h1>
            <p className="text-sm text-gray-600">Premium Streetwear</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">SHIPPING LABEL</p>
            <p className="text-xs text-gray-600">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Order & Tracking Info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-semibold text-gray-600 mb-1">ORDER NUMBER</p>
            <p className="text-2xl font-bold">{order.orderNumber}</p>
          </div>
          {order.trackingNumber && (
            <div className="border-2 border-gray-300 p-4 rounded">
              <p className="text-xs font-semibold text-gray-600 mb-1">TRACKING NUMBER</p>
              <p className="text-xl font-bold">{order.trackingNumber}</p>
              {order.carrier && (
                <p className="text-sm text-gray-600 mt-1">
                  Carrier: <span className="font-semibold">{order.carrier}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* From Address */}
          <div className="border-2 border-gray-300 p-4 rounded">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">From</p>
            <p className="font-bold text-lg">{FROM_ADDRESS.name}</p>
            <p className="text-sm">{FROM_ADDRESS.address1}</p>
            {FROM_ADDRESS.address2 && <p className="text-sm">{FROM_ADDRESS.address2}</p>}
            <p className="text-sm">
              {FROM_ADDRESS.city}, {FROM_ADDRESS.state} {FROM_ADDRESS.zipCode}
            </p>
            <p className="text-sm">{FROM_ADDRESS.country}</p>
            <p className="text-sm mt-2">{FROM_ADDRESS.phone}</p>
          </div>

          {/* To Address - Highlighted */}
          <div className="border-4 border-black p-4 rounded bg-yellow-50">
            <p className="text-xs font-semibold mb-2 uppercase">Ship To</p>
            <p className="font-bold text-xl">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            <p className="text-base mt-2">{order.shippingAddress.address1}</p>
            {order.shippingAddress.address2 && (
              <p className="text-base">{order.shippingAddress.address2}</p>
            )}
            <p className="text-base font-semibold mt-1">
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.zipCode}
            </p>
            <p className="text-base">{order.shippingAddress.country}</p>
          </div>
        </div>

        {/* Barcode Placeholder */}
        {order.trackingNumber && (
          <div className="mb-6 text-center border-2 border-gray-300 p-6 rounded">
            <div className="mb-2">
              <svg
                className="w-full h-20"
                viewBox="0 0 400 80"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Simple barcode representation */}
                {Array.from({ length: 50 }).map((_, i) => (
                  <rect
                    key={i}
                    x={i * 8}
                    y="10"
                    width={i % 3 === 0 ? 4 : 2}
                    height="60"
                    fill="black"
                  />
                ))}
              </svg>
            </div>
            <p className="text-lg font-mono font-bold tracking-wider">
              {order.trackingNumber}
            </p>
          </div>
        )}

        {/* Package Contents */}
        <div className="border-2 border-gray-300 p-4 rounded mb-6">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase">
            Package Contents
          </p>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-300">
              <tr className="text-left">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-2">
                    {item.product.name}
                    {item.productVariant && (
                      <span className="text-gray-600 text-xs ml-2">
                        {item.productVariant.size && `Size: ${item.productVariant.size}`}
                        {item.productVariant.size && item.productVariant.color && ' | '}
                        {item.productVariant.color && `Color: ${item.productVariant.color}`}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center font-semibold">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 pt-3 border-t border-gray-300 flex justify-between text-sm">
            <span>Total Items:</span>
            <span className="font-semibold">
              {order.items.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </div>
        </div>

        {/* Shipping Information */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="border border-gray-300 p-3 rounded">
            <p className="text-xs font-semibold text-gray-600 mb-1">SHIPPING METHOD</p>
            <p className="font-semibold">Standard Ground</p>
          </div>
          <div className="border border-gray-300 p-3 rounded">
            <p className="text-xs font-semibold text-gray-600 mb-1">SHIPPING COST</p>
            <p className="font-semibold">${order.shipping.toFixed(2)}</p>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-gray-100 border-l-4 border-yellow-500 p-4 rounded text-sm">
          <p className="font-semibold mb-2">⚠️ Important Handling Instructions:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Handle with care - contains premium apparel</li>
            <li>Keep dry and away from direct sunlight</li>
            <li>Signature may be required upon delivery</li>
            <li>Do not leave unattended</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t-2 border-gray-300 text-center text-xs text-gray-600">
          <p>
            For questions about this shipment, please contact us at{' '}
            <span className="font-semibold">support@headoverfeels.com</span>
          </p>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} Head Over Feels. All rights reserved.
          </p>
        </div>

        {/* Print Instructions (hidden when printing) */}
        <div className="print:hidden mt-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm">
          <p className="font-semibold text-blue-900 mb-2">📋 Printing Instructions:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>Use Letter size (8.5&quot; × 11&quot;) paper</li>
            <li>Print in color for best results</li>
            <li>Ensure all text is legible before affixing to package</li>
            <li>Attach securely to package in weather-resistant sleeve</li>
          </ul>
        </div>
      </div>
    )
  }
)

ShippingLabel.displayName = 'ShippingLabel'

export default ShippingLabel
