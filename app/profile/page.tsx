'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { User, Package, LogOut, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Order {
  id: string
  orderNumber: string
  status: string
  total: number
  createdAt: string
  items: {
    productName: string
    quantity: number
  }[]
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, signout } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    // Redirect if not authenticated
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  const fetchOrders = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/orders', {
        headers: {
          'x-user-email': user.email || '',
          'x-user-admin': user.isAdmin ? 'true' : 'false',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setOrders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    // Fetch user's orders
    if (user) {
      fetchOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleSignout = async () => {
    await signout()
    router.push('/')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A1A1A]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-32 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Home</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2">
            My Profile
          </h1>
          <p className="text-[#6B6B6B]">
            Manage your account and view your order history
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-[#E5DDD5] p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-[#F5F1EB] rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-[#1A1A1A]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#1A1A1A]">
                    {user.name || 'User'}
                  </h2>
                  <p className="text-sm text-[#6B6B6B]">{user.email}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="pb-3 border-b border-[#E5DDD5]">
                  <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">
                    Member Since
                  </p>
                  <p className="text-sm text-[#1A1A1A] font-medium">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {user.phone && (
                  <div className="pb-3 border-b border-[#E5DDD5]">
                    <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">
                      Phone
                    </p>
                    <p className="text-sm text-[#1A1A1A] font-medium">
                      {user.phone}
                    </p>
                  </div>
                )}

                <div className="pb-3">
                  <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">
                    Newsletter
                  </p>
                  <p className="text-sm text-[#1A1A1A] font-medium">
                    {user.newsletter ? 'Subscribed ✓' : 'Not subscribed'}
                  </p>
                </div>
              </div>

              {/* Admin Panel Button */}
              {user.isAdmin && (
                <Link
                  href="/admin"
                  className="w-full bg-[#1A1A1A] text-white py-3 rounded-lg font-medium hover:bg-[#2B2B2B] transition-colors flex items-center justify-center gap-2 mb-3"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6m0-18l5.196 3v6l-5.196 3-5.196-3V6L12 3z" />
                    <path d="M19.07 4.93A10 10 0 1 0 4.93 19.07 10 10 0 0 0 19.07 4.93z" />
                  </svg>
                  Admin Dashboard
                </Link>
              )}

              <button
                onClick={handleSignout}
                className="w-full bg-[#F5F1EB] text-[#1A1A1A] py-3 rounded-lg font-medium hover:bg-[#E5DDD5] transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Orders */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-[#E5DDD5] p-6">
              <div className="flex items-center gap-3 mb-6">
                <Package className="w-6 h-6 text-[#1A1A1A]" />
                <h2 className="text-2xl font-semibold text-[#1A1A1A]">
                  Order History
                </h2>
              </div>

              {loadingOrders ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#6B6B6B]" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-[#E5DDD5] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-[#1A1A1A] mb-2">
                    No orders yet
                  </h3>
                  <p className="text-[#6B6B6B] mb-6">
                    Start shopping to see your order history here
                  </p>
                  <Link
                    href="/products"
                    className="inline-block bg-[#1A1A1A] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#2B2B2B] transition-colors"
                  >
                    Shop Now
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/order/track/${order.id}`}
                      className="block border border-[#E5DDD5] rounded-lg p-4 hover:bg-[#FAF8F5] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-[#1A1A1A] mb-1">
                            Order #{order.orderNumber}
                          </p>
                          <p className="text-sm text-[#6B6B6B]">
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === 'DELIVERED'
                                ? 'bg-green-100 text-green-700'
                                : order.status === 'PROCESSING'
                                ? 'bg-blue-100 text-blue-700'
                                : order.status === 'SHIPPED'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {order.status}
                          </span>
                          <p className="text-lg font-semibold text-[#1A1A1A] mt-2">
                            ${order.total.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-[#6B6B6B]">
                        {order.items.slice(0, 2).map((item, idx) => (
                          <span key={idx}>
                            {item.productName} x{item.quantity}
                            {idx < Math.min(order.items.length, 2) - 1 && ', '}
                          </span>
                        ))}
                        {order.items.length > 2 && ` +${order.items.length - 2} more`}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
