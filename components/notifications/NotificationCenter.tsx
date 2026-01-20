'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

// Map notification types to icons and colors
function getNotificationIcon(type: string) {
  switch (type) {
    case 'POINTS_EARNED':
    case 'POINTS_EXPIRING':
    case 'BIRTHDAY_BONUS':
    case 'REFERRAL_BONUS':
      return <Medal size={20} weight="fill" className="text-amber-500" />
    case 'TIER_UPGRADE':
    case 'TIER_DOWNGRADE':
      return <Sparkle size={20} weight="fill" className="text-purple-500" />
    case 'ORDER_CONFIRMED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'ORDER_REFUNDED':
      return <Package size={20} weight="fill" className="text-blue-500" />
    case 'REWARD_AVAILABLE':
    case 'REWARD_REMINDER':
      return <Gift size={20} weight="fill" className="text-pink-500" />
    case 'PROMO_NEW':
    case 'WISHLIST_SALE':
      return <Tag size={20} weight="fill" className="text-green-500" />
    case 'DROP_REMINDER':
    case 'DROP_LIVE':
    case 'BACK_IN_STOCK':
      return <Bell size={20} weight="fill" className="text-red-500" />
    default:
      return <Bell size={20} weight="fill" className="text-gray-500" />
  }
}

function getNotificationBgColor(type: string) {
  switch (type) {
    case 'POINTS_EARNED':
    case 'POINTS_EXPIRING':
    case 'BIRTHDAY_BONUS':
    case 'REFERRAL_BONUS':
      return 'bg-amber-50'
    case 'TIER_UPGRADE':
    case 'TIER_DOWNGRADE':
      return 'bg-purple-50'
    case 'ORDER_CONFIRMED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'ORDER_REFUNDED':
      return 'bg-blue-50'
    case 'REWARD_AVAILABLE':
    case 'REWARD_REMINDER':
      return 'bg-pink-50'
    case 'PROMO_NEW':
    case 'WISHLIST_SALE':
      return 'bg-green-50'
    case 'DROP_REMINDER':
    case 'DROP_LIVE':
    case 'BACK_IN_STOCK':
      return 'bg-red-50'
    default:
      return 'bg-gray-50'
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const desktopPanelRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Track if mounted for portal
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      
      // Only handle for desktop
      if (window.innerWidth < 768) return
      
      // Check if click is inside any of our refs
      const isInsideButton = dropdownRef.current?.contains(target)
      const isInsideDesktopPanel = desktopPanelRef.current?.contains(target)
      
      if (!isInsideButton && !isInsideDesktopPanel) {
        setIsOpen(false)
      }
    }
    
    // Small delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 50)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button - Modern minimal style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 transition-all duration-200 ${
          isOpen 
            ? 'text-black bg-black/5' 
            : 'text-black/50 hover:text-black hover:bg-black/5'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} weight={unreadCount > 0 ? 'fill' : 'bold'} />
        {unreadCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 bg-black text-white text-[9px] font-black h-4 min-w-4 px-1 flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown - Full screen on mobile, positioned on desktop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile - Rendered via Portal */}
            {mounted && createPortal(
              <AnimatePresence>
                {isOpen && (
                  <>
                    {/* Mobile backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[9998] md:hidden"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(false)
                      }}
                    />
                    
                    {/* Mobile Bottom Sheet */}
                    <motion.div
                      ref={mobilePanelRef}
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      onClick={(e) => e.stopPropagation()}
                      className="
                        fixed inset-x-0 bottom-0
                        w-full
                        bg-white
                        shadow-2xl
                        z-[9999]
                        max-h-[85vh]
                        flex flex-col
                        rounded-t-2xl
                        md:hidden
                      "
                    >
                      {/* Drag handle - Mobile only */}
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 bg-black/10 rounded-full" />
                      </div>
                      
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black flex items-center justify-center rounded-lg">
                            <Bell size={20} weight="fill" className="text-white" />
                          </div>
                  <div>
                    <h3 className="text-base font-bold text-black">Notifications</h3>
                    {unreadCount > 0 && (
                      <p className="text-xs text-black/50">{unreadCount} unread</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-bold text-black/60 hover:text-black px-3 py-1.5 hover:bg-black/5 transition-colors rounded-lg flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} weight="bold" />
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-black/5 transition-colors rounded-lg"
                  >
                    <X size={18} className="text-black/40" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {loading && notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                    <p className="mt-3 text-sm font-medium text-black/40">Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-black/5 rounded-2xl flex items-center justify-center mb-4">
                      <Bell size={28} className="text-black/20" />
                    </div>
                    <p className="text-sm font-bold text-black/60">All caught up!</p>
                    <p className="text-xs text-black/40 mt-1">
                      We&apos;ll notify you when something happens
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/5">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`relative ${
                          !notification.isRead ? 'bg-black/[0.02]' : ''
                        }`}
                      >
                        {notification.linkUrl ? (
                          <Link
                            href={notification.linkUrl}
                            onClick={() => handleNotificationClick(notification)}
                            className="block p-4 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors"
                          >
                            <NotificationItem notification={notification} />
                          </Link>
                        ) : (
                          <div
                            onClick={() => !notification.isRead && markAsRead(notification.id)}
                            className="p-4 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors cursor-pointer"
                          >
                            <NotificationItem notification={notification} />
                          </div>
                        )}
                        {!notification.isRead && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-black rounded-full" />
                        )}
                      </motion.div>
                    ))}

                    {/* Load More */}
                    {hasMore && (
                      <button
                        onClick={() => fetchNotifications(true)}
                        disabled={loading}
                        className="w-full px-4 py-4 text-sm font-bold text-black/60 hover:text-black hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Load more notifications'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-black/5 bg-black/[0.02] safe-area-inset-bottom">
                <Link
                  href="/profile/notifications"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-bold text-black/60 hover:text-black transition-colors"
                >
                  Notification Settings
                  <span className="text-black/30">→</span>
                </Link>
              </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body
            )}
            
            {/* Desktop Dropdown */}
            <motion.div
              ref={desktopPanelRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="
                hidden md:flex
                absolute right-0 top-full mt-2
                w-[420px]
                bg-white
                border border-black/10
                shadow-xl
                z-[100]
                max-h-[600px]
                flex-col
                rounded-xl
                overflow-hidden
              "
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black flex items-center justify-center rounded-lg">
                    <Bell size={20} weight="fill" className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-black">Notifications</h3>
                    {unreadCount > 0 && (
                      <p className="text-xs text-black/50">{unreadCount} unread</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs font-bold text-black/60 hover:text-black px-3 py-1.5 hover:bg-black/5 transition-colors rounded-lg flex items-center gap-1.5"
                    >
                      <CheckCircle size={14} weight="bold" />
                      <span>Mark all read</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-black/5 transition-colors rounded-lg"
                  >
                    <X size={18} className="text-black/40" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {loading && notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                    <p className="mt-3 text-sm font-medium text-black/40">Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto bg-black/5 rounded-2xl flex items-center justify-center mb-4">
                      <Bell size={28} className="text-black/20" />
                    </div>
                    <p className="text-sm font-bold text-black/60">All caught up!</p>
                    <p className="text-xs text-black/40 mt-1">
                      We&apos;ll notify you when something happens
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-black/5">
                    {notifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={`relative ${
                          !notification.isRead ? 'bg-black/[0.02]' : ''
                        }`}
                      >
                        {notification.linkUrl ? (
                          <Link
                            href={notification.linkUrl}
                            onClick={() => handleNotificationClick(notification)}
                            className="block p-4 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors"
                          >
                            <NotificationItem notification={notification} />
                          </Link>
                        ) : (
                          <div
                            onClick={() => !notification.isRead && markAsRead(notification.id)}
                            className="p-4 hover:bg-black/[0.03] active:bg-black/[0.05] transition-colors cursor-pointer"
                          >
                            <NotificationItem notification={notification} />
                          </div>
                        )}
                        {!notification.isRead && (
                          <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-black rounded-full" />
                        )}
                      </motion.div>
                    ))}

                    {/* Load More */}
                    {hasMore && (
                      <button
                        onClick={() => fetchNotifications(true)}
                        disabled={loading}
                        className="w-full px-4 py-4 text-sm font-bold text-black/60 hover:text-black hover:bg-black/[0.03] transition-colors disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Load more notifications'
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-black/5 bg-black/[0.02]">
                <Link
                  href="/profile/notifications"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2 text-xs font-bold text-black/60 hover:text-black transition-colors"
                >
                  Notification Settings
                  <span className="text-black/30">→</span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Notification item component
function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3 pl-2">
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${getNotificationBgColor(notification.type)}`}>
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-black truncate">{notification.title}</p>
        <p className="text-xs text-black/50 mt-0.5 line-clamp-2 leading-relaxed">{notification.message}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-medium text-black/30 uppercase tracking-wide">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
          {notification.linkLabel && (
            <span className="text-[10px] font-bold text-black uppercase tracking-wide">
              {notification.linkLabel} →
            </span>
          )}
          {notification.isRead && (
            <Check size={12} className="text-black/20" />
          )}
        </div>
      </div>
    </div>
  )
}
