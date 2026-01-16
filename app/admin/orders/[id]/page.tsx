'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Package, Printer, Plus, Truck, CheckCircle, Clock, MapPin, CaretDown, CaretUp } from '@phosphor-icons/react';
import ShippingLabel from '@/components/admin/ShippingLabel';
import { TrackingMap } from '@/components/orders/TrackingMap';
import type { TrackingResult } from '@/lib/shipping/tracking';

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

  // Tracking data state
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingHistoryExpanded, setTrackingHistoryExpanded] = useState(false);

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

  // Fetch live tracking data
  const fetchTrackingData = useCallback(async () => {
    if (!orderId) return;
    try {
      setTrackingLoading(true);
      const response = await fetch(`/api/orders/${orderId}/tracking/live`);
      if (response.ok) {
        const result = await response.json();
        if (result.hasTracking && result.data) {
          setTrackingData(result.data);
        }
      }
    } catch (err) {
      console.error('Error fetching tracking:', err);
    } finally {
      setTrackingLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.trackingNumber) {
      fetchTrackingData();
    }
  }, [order?.trackingNumber, fetchTrackingData]);

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
      PENDING: 'bg-amber-500/20 text-amber-400',
      CONFIRMED: 'bg-blue-500/20 text-blue-400',
      PROCESSING: 'bg-purple-500/20 text-purple-400',
      SHIPPED: 'bg-indigo-500/20 text-indigo-400',
      DELIVERED: 'bg-emerald-500/20 text-emerald-400',
      CANCELLED: 'bg-red-500/20 text-red-400',
      REFUNDED: 'bg-white/10 text-white/70',
    };
    return colors[status] || 'bg-white/10 text-white/70';
  };

  const getPaymentStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-500/20 text-amber-400',
      PAID: 'bg-emerald-500/20 text-emerald-400',
      FAILED: 'bg-red-500/20 text-red-400',
      REFUNDED: 'bg-white/10 text-white/70',
    };
    return colors[status] || 'bg-white/10 text-white/70';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF3131]"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Order not found'}</p>
          <Link href="/admin/orders" className="text-[#FF3131] hover:text-[#E02828]">
            ← Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <header className="bg-neutral-900 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white">Order {order.orderNumber}</h1>
                <span className={`px-3 py-1 text-sm font-semibold ${getStatusBadgeColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-white/50 mt-1">
                Placed on {formatDate(order.createdAt)}
              </p>
            </div>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={16} weight="bold" />
              Back to Orders
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Package size={18} weight="bold" className="text-white/50" />
                  Order Items
                </h2>
                <span className="text-sm text-white/50">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-lg"
                    >
                      <div className="w-16 h-16 bg-white/5 border border-white/10 rounded shrink-0 flex items-center justify-center overflow-hidden">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package size={20} weight="light" className="text-white/30" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm">{item.product.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                          <span>SKU: {item.productVariant.sku}</span>
                          {item.productVariant.size && (
                            <span className="px-1.5 py-0.5 bg-white/5 rounded">{item.productVariant.size}</span>
                          )}
                          {item.productVariant.color && (
                            <span className="px-1.5 py-0.5 bg-white/5 rounded">{item.productVariant.color}</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-1">
                          {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-white text-sm">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Totals */}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Subtotal</span>
                      <span className="text-white">{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Shipping</span>
                      <span className="text-white">{formatCurrency(order.shipping)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Tax</span>
                      <span className="text-white">{formatCurrency(order.tax)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
                      <span className="text-white">Total</span>
                      <span className="text-[#FF3131]">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Customer Information</h2>
              </div>
              <div className="p-5">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Contact Details
                    </h3>
                    <p className="text-sm text-white">{order.customer.email}</p>
                    {order.customer.phone && (
                      <p className="text-sm text-white/70 mt-1">{order.customer.phone}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Shipping Address
                    </h3>
                    <p className="text-sm text-white">
                      {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                    </p>
                    <p className="text-sm text-white/70">{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && (
                      <p className="text-sm text-white/70">{order.shippingAddress.addressLine2}</p>
                    )}
                    <p className="text-sm text-white/70">
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                    </p>
                    <p className="text-sm text-white/50">{order.shippingAddress.country}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock size={18} weight="bold" className="text-white/50" />
                  Order Timeline
                </h2>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle size={16} weight="fill" className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Order Placed</p>
                      <p className="text-xs text-white/50">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  {order.shippedAt && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Truck size={16} weight="fill" className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Shipped</p>
                        <p className="text-xs text-white/50">{formatDate(order.shippedAt)}</p>
                      </div>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Package size={16} weight="fill" className="text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Delivered</p>
                        <p className="text-xs text-white/50">{formatDate(order.deliveredAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Shipment Tracking Section - Only show if order has tracking */}
            {order.trackingNumber && (
              <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <MapPin size={18} weight="bold" className="text-white/50" />
                      Shipment Tracking
                    </h2>
                    {trackingData && (
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        trackingData.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' :
                        trackingData.status === 'in_transit' ? 'bg-blue-500/20 text-blue-400' :
                        trackingData.status === 'out_for_delivery' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-white/70'
                      }`}>
                        {trackingData.statusDescription}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Tracking Map */}
                <div className="h-[280px] border-b border-white/10">
                  {trackingLoading ? (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF3131]"></div>
                    </div>
                  ) : trackingData ? (
                    <TrackingMap
                      origin={trackingData.originLocation}
                      destination={trackingData.destinationLocation}
                      currentLocation={trackingData.currentLocation}
                      events={trackingData.events}
                      status={trackingData.status}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                      <div className="text-center">
                        <MapPin size={32} weight="light" className="mx-auto text-white/30 mb-2" />
                        <p className="text-white/50 text-sm">No tracking data available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tracking Info */}
                <div className="p-5">
                  {/* Tracking Number & Carrier */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Tracking Number</p>
                      <p className="font-mono text-sm text-white">{order.trackingNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Carrier</p>
                      <p className="text-sm text-white font-medium">{order.carrier || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {trackingData && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-white/50 mb-2">
                        <span>Transit Progress</span>
                        <span>{trackingData.transitProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-500 rounded-full"
                          style={{ 
                            width: `${trackingData.transitProgress}%`,
                            backgroundColor: trackingData.status === 'delivered' ? '#10b981' :
                              trackingData.status === 'out_for_delivery' ? '#f59e0b' : '#3b82f6'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Estimated Delivery & Current Location */}
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {trackingData?.estimatedDelivery && trackingData.status !== 'delivered' && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Estimated Delivery</p>
                        <p className="text-sm text-white font-medium">
                          {new Date(trackingData.estimatedDelivery).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                    {trackingData?.currentLocation && (
                      <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                        <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Current Location</p>
                        <p className="text-sm text-white">
                          {trackingData.currentLocation.city}, {trackingData.currentLocation.state}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tracking History */}
                  {trackingData?.events && trackingData.events.length > 0 && (
                    <div>
                      <button
                        onClick={() => setTrackingHistoryExpanded(!trackingHistoryExpanded)}
                        className="w-full flex items-center justify-between py-2 text-sm text-white/70 hover:text-white transition-colors"
                      >
                        <span className="font-medium">
                          Tracking History ({trackingData.events.length} events)
                        </span>
                        {trackingHistoryExpanded ? (
                          <CaretUp size={16} weight="bold" />
                        ) : (
                          <CaretDown size={16} weight="bold" />
                        )}
                      </button>

                      {trackingHistoryExpanded && (
                        <div className="mt-3 space-y-3 max-h-[250px] overflow-y-auto pr-2">
                          {trackingData.events.map((event, index) => (
                            <div 
                              key={index}
                              className={`relative pl-5 pb-3 ${
                                index < trackingData.events.length - 1 ? 'border-l border-white/10 ml-1' : 'ml-1'
                              }`}
                            >
                              <div className={`absolute -left-[5px] top-1 w-[10px] h-[10px] rounded-full border-2 border-neutral-900 ${
                                index === 0 
                                  ? trackingData.status === 'delivered' ? 'bg-emerald-400' : 'bg-blue-400'
                                  : 'bg-white/30'
                              }`} />
                              <div>
                                <p className="text-sm text-white font-medium">{event.description}</p>
                                <p className="text-xs text-white/50 mt-0.5">
                                  {event.location.city}, {event.location.state}
                                </p>
                                <p className="text-xs text-white/40 mt-0.5">
                                  {new Date(event.timestamp).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Order Management */}
          <div className="space-y-6">
            {/* Order Summary Card */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Order Summary</h2>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Payment Status</span>
                  <span className={`font-medium ${getPaymentStatusBadgeColor(order.paymentStatus)} px-2 py-0.5 rounded`}>
                    {order.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Items</span>
                  <span className="font-medium text-white">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                {order.trackingNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Tracking</span>
                    <span className="font-mono text-xs text-white truncate max-w-[140px]">
                      {order.trackingNumber}
                    </span>
                  </div>
                )}
                {order.shippingMethod && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Shipping</span>
                    <span className="font-medium text-white">{order.shippingMethod}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Update Order Status */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Update Order</h2>
              </div>
              <div className="p-5">
                <form onSubmit={handleUpdateOrder} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Order Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-white/30"
                    >
                      <option value="PENDING" className="bg-neutral-900">Pending</option>
                      <option value="CONFIRMED" className="bg-neutral-900">Confirmed</option>
                      <option value="PROCESSING" className="bg-neutral-900">Processing</option>
                      <option value="SHIPPED" className="bg-neutral-900">Shipped</option>
                      <option value="DELIVERED" className="bg-neutral-900">Delivered</option>
                      <option value="CANCELLED" className="bg-neutral-900">Cancelled</option>
                      <option value="REFUNDED" className="bg-neutral-900">Refunded</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Shipping Method
                    </label>
                    <input
                      type="text"
                      value={shippingMethod}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      placeholder="e.g., USPS Priority Mail"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                      Internal Notes
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={3}
                      placeholder="Add internal notes..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 resize-none"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full bg-[#FF3131] text-white py-2.5 px-4 rounded font-medium hover:bg-[#E02828] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Updating...' : 'Update Order'}
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-base font-semibold text-white">Quick Actions</h2>
              </div>
              <div className="p-5 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded hover:bg-purple-500/30 transition-colors"
                >
                  <Plus size={16} weight="bold" />
                  Add Tracking
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded hover:bg-emerald-500/30 transition-colors"
                >
                  <Printer size={16} weight="bold" />
                  Print Shipping Label
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-white/10 max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Add Tracking Information</h3>
            <form onSubmit={handleAddTracking} className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
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
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                  Carrier *
                </label>
                <select
                  value={trackingFormData.carrier}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, carrier: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
                >
                  <option value="USPS" className="bg-neutral-900">USPS</option>
                  <option value="FedEx" className="bg-neutral-900">FedEx</option>
                  <option value="UPS" className="bg-neutral-900">UPS</option>
                  <option value="DHL" className="bg-neutral-900">DHL</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                  Estimated Delivery (Optional)
                </label>
                <input
                  type="date"
                  value={trackingFormData.estimatedDelivery}
                  onChange={(e) =>
                    setTrackingFormData({ ...trackingFormData, estimatedDelivery: e.target.value })
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30 [color-scheme:dark]"
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
                  className="h-4 w-4 bg-white/5 border-white/30 text-[#FF3131] focus:ring-[#FF3131] rounded"
                />
                <label htmlFor="sendEmail" className="ml-2 text-sm text-white/70">
                  Send tracking email to customer
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(false)}
                  disabled={submittingTracking}
                  className="flex-1 px-4 py-2 border border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTracking}
                  className="flex-1 px-4 py-2 bg-[#FF3131] text-white hover:bg-[#E02828] transition-colors disabled:opacity-50"
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
