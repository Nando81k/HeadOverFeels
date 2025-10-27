/**
 * Customer Detail Page
 * 
 * Comprehensive view of a single customer with:
 * - Profile information
 * - Customer stats and lifetime value
 * - Segmentation badges
 * - Complete order history
 * - Internal notes management
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { calculateCustomerSegment, getCustomerSegments } from '@/lib/customer-segments';
import { SegmentBadge } from '@/components/admin/SegmentBadge';
import { CustomerStatsCard } from '@/components/admin/CustomerStatsCard';
import { CustomerNotes } from '@/components/admin/CustomerNotes';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// Helper to get status badge color
function getStatusColor(status: string) {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'CONFIRMED':
      return 'bg-blue-100 text-blue-800';
    case 'PROCESSING':
      return 'bg-purple-100 text-purple-800';
    case 'SHIPPED':
      return 'bg-indigo-100 text-indigo-800';
    case 'DELIVERED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    case 'REFUNDED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch customer with orders and notes
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              quantity: true,
              productName: true
            }
          }
        }
      },
      notes: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  // Calculate customer segments
  const segments = getCustomerSegments(customer);
  const primarySegment = calculateCustomerSegment(customer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/customers"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to Customers
          </Link>
          <h1 className="text-3xl font-bold">{customer.name || 'Customer Details'}</h1>
          <p className="text-gray-600 mt-1">{customer.email}</p>
        </div>
        <div className="flex gap-2">
          {segments.map((segment) => (
            <SegmentBadge key={segment} segment={segment} />
          ))}
        </div>
      </div>

      {/* Customer Stats */}
      <CustomerStatsCard
        totalOrders={customer.totalOrders}
        totalSpent={customer.totalSpent}
        avgOrderValue={customer.avgOrderValue}
        lastOrderDate={customer.lastOrderDate}
        memberSince={customer.createdAt}
      />

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <p className="text-gray-900">{customer.name || 'Not provided'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900">{customer.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <p className="text-gray-900">{customer.phone || 'Not provided'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <p className="text-gray-900">
              {customer.birthday
                ? new Date(customer.birthday).toLocaleDateString()
                : 'Not provided'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Newsletter</label>
            <p className="text-gray-900">
              {customer.newsletter ? (
                <span className="text-green-600">✓ Subscribed</span>
              ) : (
                <span className="text-gray-400">Not subscribed</span>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SMS Opt-in</label>
            <p className="text-gray-900">
              {customer.smsOptIn ? (
                <span className="text-green-600">✓ Opted in</span>
              ) : (
                <span className="text-gray-400">Not opted in</span>
              )}
            </p>
          </div>
          {customer.isAdmin && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                Admin User
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Order History</h2>
          <p className="text-sm text-gray-600 mt-1">
            {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'} • $
            {customer.totalSpent.toFixed(2)} total
          </p>
        </div>

        {customer.orders.length === 0 ? (
          <div className="p-8 text-center text-gray-600">
            No orders yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {customer.orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                      {order.items.length > 0 && order.items[0] && (
                        <span> • {order.items[0].productName}</span>
                      )}
                      {order.items.length > 1 && <span> and {order.items.length - 1} more</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${order.total.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Customer Notes */}
      <div className="bg-white rounded-lg shadow p-6">
        <CustomerNotes
          customerId={customer.id}
          initialNotes={customer.notes.map((note) => ({
            ...note,
            createdAt: new Date(note.createdAt),
            updatedAt: new Date(note.updatedAt)
          }))}
        />
      </div>
    </div>
  );
}
