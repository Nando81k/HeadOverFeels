'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, CheckCircle, Gift, Medal, Package, Sparkle, Tag, X } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  linkUrl?: string | null
  linkLabel?: string | null
  metadata?: Record<string, unknown> | null
  isRead: boolean
  readAt?: string | null
  createdAt: string
}

interface NotificationsResponse {
  notifications: Notification[]
  total: number
  hasMore: boolean
  unreadCount: number
}

// Map notification types to icons
function getNotificationIcon(type: string) {
  switch (type) {
    case 'POINTS_EARNED':
    case 'POINTS_EXPIRING':
    case 'BIRTHDAY_BONUS':
    case 'REFERRAL_BONUS':
      return <Medal size={18} weight="fill" className="text-amber-500" />
    case 'TIER_UPGRADE':
    case 'TIER_DOWNGRADE':
      return <Sparkle size={18} weight="fill" className="text-purple-500" />
    case 'ORDER_CONFIRMED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'ORDER_REFUNDED':
      return <Package size={18} weight="fill" className="text-blue-500" />
    case 'REWARD_AVAILABLE':
    case 'REWARD_REMINDER':
      return <Gift size={18} weight="fill" className="text-pink-500" />
    case 'PROMO_NEW':
    case 'WISHLIST_SALE':
      return <Tag size={18} weight="fill" className="text-green-500" />
    case 'DROP_REMINDER':
    case 'DROP_LIVE':
    case 'BACK_IN_STOCK':
      return <Bell size={18} weight="fill" className="text-red-500" />
    default:
      return <Bell size={18} weight="fill" className="text-gray-500" />
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async (append = false) => {
    try {
      setLoading(true)
      const offset = append ? notifications.length : 0
      const res = await fetch(`/api/notifications?limit=10&offset=${offset}`)
      
      if (!res.ok) {
        if (res.status === 401) {
          // User not logged in, reset state
          setNotifications([])
          setUnreadCount(0)
          return
        }
        throw new Error('Failed to fetch notifications')
      }
      
      const data: NotificationsResponse = await res.json()
      
      if (append) {
        setNotifications((prev) => [...prev, ...data.notifications])
      } else {
        setNotifications(data.notifications)
      }
      setUnreadCount(data.unreadCount)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [notifications.length])

  // Fetch unread count only (for polling)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?countOnly=true')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      // Silently fail for background polling
    }
  }, [])

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
      })
      
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      })
      
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchUnreadCount, 30000)
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [fetchUnreadCount])

  // Fetch full notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full text-black/70 hover:text-black hover:bg-black/5 transition-all duration-200"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} weight={unreadCount > 0 ? 'fill' : 'bold'} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-black/5 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <CheckCircle size={14} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-black/5 transition-colors"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                  <p className="mt-2 text-sm text-gray-500">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    We&apos;ll let you know when something happens
                  </p>
                </div>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                    >
                      {notification.linkUrl ? (
                        <Link
                          href={notification.linkUrl}
                          onClick={() => handleNotificationClick(notification)}
                          className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <NotificationItem notification={notification} />
                        </Link>
                      ) : (
                        <div
                          onClick={() => !notification.isRead && markAsRead(notification.id)}
                          className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <NotificationItem notification={notification} />
                        </div>
                      )}
                      {!notification.isRead && (
                        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  ))}

                  {/* Load More */}
                  {hasMore && (
                    <button
                      onClick={() => fetchNotifications(true)}
                      disabled={loading}
                      className="w-full px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Loading...' : 'Load more'}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-black/5 bg-gray-50/50">
              <Link
                href="/profile/notifications"
                onClick={() => setIsOpen(false)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Manage notification preferences →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Notification item component
function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-gray-400">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
          {notification.linkLabel && (
            <span className="text-[10px] font-medium text-blue-600">{notification.linkLabel}</span>
          )}
          {notification.isRead && (
            <Check size={12} className="text-green-500" />
          )}
        </div>
      </div>
    </div>
  )
}
