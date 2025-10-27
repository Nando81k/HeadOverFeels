'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ShippingLabel from '@/components/admin/ShippingLabel';

interface ProductVariant {
  id: string;
  sku: string;
  size?: string;
  color?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  images: string[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  productVariant: ProductVariant;
  product: Product;
}

interface Address {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface Customer {
  email: string;
  phone?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: string;
  shippingMethod?: string;
  notes?: string;
  internalNotes?: string;
  items: OrderItem[];
  customer: Customer;
  shippingAddress: Address;
  billingAddress: Address;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [status, setStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingMethod, setShippingMethod] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Tracking modal state
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingFormData, setTrackingFormData] = useState({
    trackingNumber: '',
    carrier: 'USPS',
    estimatedDelivery: '',
    sendEmail: true,
  });
  const [submittingTracking, setSubmittingTracking] = useState(false);

  // Shipping label print
  const labelRef = useRef<HTMLDivElement>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/orders/${orderId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Order not found');
        } else {
          setError(`Failed to fetch order (Status: ${response.status})`);
        }
        return;
      }
      
      const data = await response.json();

      if (data.data) {
        setOrder(data.data);
      } else {
        setError('Order not found');
      }
    } catch (err) {
      setError('Failed to fetch order');
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setTrackingNumber(order.trackingNumber || '');
      setShippingMethod(order.shippingMethod || '');
      setInternalNotes(order.internalNotes || '');
    }
  }, [order]);

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          trackingNumber: trackingNumber || undefined,
          shippingMethod: shippingMethod || undefined,
          internalNotes: internalNotes || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || `Failed to update order (Status: ${response.status})`);
        return;
      }

      const data = await response.json();

      if (data.data) {
        setOrder(data.data);
        alert('Order updated successfully!');
      } else {
        setError(data.error || 'Failed to update order');
      }
    } catch (err) {
      setError('Failed to update order');
      console.error('Error updating order:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmittingTracking(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}/tracking`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingFormData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(errorText || `Failed to add tracking (Status: ${response.status})`);
        return;
      }

      const data = await response.json();

      if (data.data) {
        setOrder(data.data);
        setShowTrackingModal(false);
        setTrackingFormData({
          trackingNumber: '',
          carrier: 'USPS',
          estimatedDelivery: '',
          sendEmail: true,
        });
        alert('Tracking information added successfully!');
        fetchOrder(); // Refresh order data
      } else {
        setError(data.error || 'Failed to add tracking information');
      }
    } catch (err) {
      setError('Failed to add tracking information');
      console.error('Error adding tracking:', err);
    } finally {
      setSubmittingTracking(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PROCESSING: 'bg-purple-100 text-purple-800',
      SHIPPED: 'bg-indigo-100 text-indigo-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      REFUNDED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
          <Link href="/admin/orders" className="text-blue-600 hover:text-blue-800">
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
                <span
                  className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Placed on {formatDate(order.createdAt)}
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Orders
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Order Items</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 pb-4 border-b border-gray-200 last:border-0"
                    >
                      <div className="w-20 h-20 bg-gray-100 rounded shrink-0 flex items-center justify-center text-gray-400 text-xs">
                        Product
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {item.product.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          SKU: {item.productVariant.sku}
                        </p>
                        {item.productVariant.size && (
                          <p className="text-sm text-gray-600">
                            Size: {item.productVariant.size}
                          </p>
                        )}
                        {item.productVariant.color && (
                          <p className="text-sm text-gray-600">
                            Color: {item.productVariant.color}
                          </p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">
                          Quantity: {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-gray-900">
                        {formatCurrency(order.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span className="text-gray-900">
                        {formatCurrency(order.shipping)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax</span>
                      <span className="text-gray-900">
                        {formatCurrency(order.tax)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Customer Information</h2>
              </div>
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Contact Details
                    </h3>
                    <p className="text-sm text-gray-600">{order.customer.email}</p>
                    {order.customer.phone && (
                      <p className="text-sm text-gray-600">{order.customer.phone}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">
                      Shipping Address
                    </h3>
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress.firstName}{' '}
                      {order.shippingAddress.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress.addressLine1}
                    </p>
                    {order.shippingAddress.addressLine2 && (
                      <p className="text-sm text-gray-600">
                        {order.shippingAddress.addressLine2}
                      </p>
                    )}
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                      {order.shippingAddress.zipCode}
                    </p>
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress.country}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Order Timeline</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Order Placed
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                  </div>
                  {order.shippedAt && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Shipped</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(order.shippedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full mt-1.5"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Delivered
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDate(order.deliveredAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Management */}
          <div className="space-y-6">
            {/* Update Order Status */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Update Order</h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleUpdateOrder} className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </div>

                  {/* Tracking Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Shipping Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Method
                    </label>
                    <input
                      type="text"
                      value={shippingMethod}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      placeholder="e.g., USPS Priority Mail"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Internal Notes
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={4}
                      placeholder="Add internal notes (not visible to customer)"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Updating...' : 'Update Order'}
                  </button>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowTrackingModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Tracking
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Print Label
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">Order Summary</h2>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payment Status</span>
                  <span className="font-medium text-gray-900">
                    {order.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Items</span>
                  <span className="font-medium text-gray-900">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                {order.trackingNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tracking</span>
                    <span className="font-medium text-gray-900">
                      {order.trackingNumber}
                    </span>
                  </div>
                )}
                {order.shippingMethod && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping Method</span>
                    <span className="font-medium text-gray-900">
                      {order.shippingMethod}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Add Tracking Information</h3>
            <form onSubmit={handleAddTracking} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number *
                </label>
                <input
                  type="text"
                  value={trackingFormData.trackingNumber}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, trackingNumber: e.target.value })
                  }
                  required
                  placeholder="1Z999AA10123456784"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <select
                  value={trackingFormData.carrier}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, carrier: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="USPS">USPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                  <option value="DHL">DHL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Delivery (Optional)
                </label>
                <input
                  type="date"
                  value={trackingFormData.estimatedDelivery}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, estimatedDelivery: e.target.value })
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={trackingFormData.sendEmail}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, sendEmail: e.target.checked })
                  }
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="sendEmail" className="ml-2 text-sm text-gray-700">
                  Send tracking email to customer
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(false)}
                  disabled={submittingTracking}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTracking}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {submittingTracking ? 'Adding...' : 'Add Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Shipping Label for Printing */}
      <div className="hidden print:block">
        <ShippingLabel 
          ref={labelRef}
          order={{
            ...order,
            shippingAddress: {
              ...order.shippingAddress,
              address1: order.shippingAddress.addressLine1,
              address2: order.shippingAddress.addressLine2,
            },
            items: order.items.map(item => ({
              ...item,
              product: {
                ...item.product,
              },
            })),
          }} 
        />
      </div>
    </div>
  );
}
