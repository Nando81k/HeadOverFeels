'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Gift,
  Medal,
  Package,
  Sparkle,
  Tag,
  X,
} from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'

export interface Notification {
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

// Filter tab → notification types it shows. `null` means all.
const FILTER_TABS: Array<{ key: string; label: string; types: string[] | null }> = [
  { key: 'all', label: 'All', types: null },
  { key: 'unread', label: 'Unread', types: null },
  {
    key: 'orders',
    label: 'Orders',
    types: ['ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_REFUNDED'],
  },
  {
    key: 'rewards',
    label: 'Rewards',
    types: [
      'POINTS_EARNED',
      'POINTS_EXPIRING',
      'TIER_UPGRADE',
      'TIER_DOWNGRADE',
      'REWARD_AVAILABLE',
      'REWARD_REMINDER',
      'BIRTHDAY_BONUS',
      'REFERRAL_BONUS',
    ],
  },
  {
    key: 'promos',
    label: 'Promos',
    types: ['PROMO_NEW', 'DROP_REMINDER', 'DROP_LIVE', 'WISHLIST_SALE', 'BACK_IN_STOCK'],
  },
]

// Monochrome icon by type. No background blocks — the icon is just an icon.
function getNotificationIcon(type: string, className = 'text-black/55') {
  const props = { size: 16, weight: 'bold' as const, className }
  switch (type) {
    case 'POINTS_EARNED':
    case 'POINTS_EXPIRING':
    case 'BIRTHDAY_BONUS':
    case 'REFERRAL_BONUS':
      return <Medal {...props} />
    case 'TIER_UPGRADE':
    case 'TIER_DOWNGRADE':
      return <Sparkle {...props} />
    case 'ORDER_CONFIRMED':
    case 'ORDER_SHIPPED':
    case 'ORDER_DELIVERED':
    case 'ORDER_REFUNDED':
      return <Package {...props} />
    case 'REWARD_AVAILABLE':
    case 'REWARD_REMINDER':
      return <Gift {...props} />
    case 'PROMO_NEW':
    case 'WISHLIST_SALE':
      return <Tag {...props} />
    case 'DROP_REMINDER':
    case 'DROP_LIVE':
    case 'BACK_IN_STOCK':
      return <Bell {...props} />
    default:
      return <Bell {...props} />
  }
}

interface NotificationItemProps {
  notification: Notification
  accentColor: string
  onMarkRead?: (id: string) => void
  onDelete?: (id: string) => void
  onNavigate?: () => void
}

/**
 * One row in the inbox / dropdown. Exported so the full-page inbox at
 * /profile/notifications can render the exact same row as the dropdown.
 */
export function NotificationItem({
  notification,
  accentColor,
  onMarkRead,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const isUnread = !notification.isRead

  const inner = (
    <div className="flex gap-3 items-start py-3 pl-3 pr-2">
      <div className="shrink-0 mt-0.5">
        {getNotificationIcon(notification.type, isUnread ? 'text-black' : 'text-black/45')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={`text-sm font-black tracking-tight truncate ${
              isUnread ? 'text-black' : 'text-black/65'
            }`}
          >
            {notification.title}
          </p>
          <span className="text-[10px] uppercase tracking-[0.12em] text-black/40 shrink-0 tabular-nums">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: false })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-black/55 line-clamp-2 leading-snug">
          {notification.message}
        </p>
        {notification.linkLabel ? (
          <span
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em]"
            style={{ color: accentColor }}
          >
            {notification.linkLabel} →
          </span>
        ) : null}
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete(notification.id)
          }}
          aria-label="Dismiss notification"
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center text-black/30 hover:text-black md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        >
          <X size={12} weight="bold" />
        </button>
      ) : null}
    </div>
  )

  const wrapperClass = `group relative border-b border-black/5 transition-colors ${
    isUnread ? 'bg-black/[0.015] hover:bg-black/[0.035]' : 'hover:bg-black/[0.02]'
  }`

  const unreadRule = isUnread ? (
    <span
      aria-hidden="true"
      className="absolute left-0 top-0 bottom-0 w-0.5"
      style={{ backgroundColor: accentColor }}
    />
  ) : null

  if (notification.linkUrl) {
    return (
      <div className={wrapperClass}>
        {unreadRule}
        <Link
          href={notification.linkUrl}
          onClick={() => {
            if (isUnread && onMarkRead) onMarkRead(notification.id)
            onNavigate?.()
          }}
          className="block"
        >
          {inner}
        </Link>
      </div>
    )
  }

  return (
    <div
      className={wrapperClass}
      onClick={() => {
        if (isUnread && onMarkRead) onMarkRead(notification.id)
      }}
      role="button"
      tabIndex={0}
    >
      {unreadRule}
      {inner}
    </div>
  )
}

export function NotificationCenter() {
  const tierAccent = useTierAccent()
  const [isOpen, setIsOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Build the API query for the current filter.
  const buildQuery = useCallback(
    (offset: number) => {
      const tab = FILTER_TABS.find((t) => t.key === activeFilter)
      const params = new URLSearchParams({
        limit: '10',
        offset: String(offset),
      })
      if (tab?.key === 'unread') params.set('unreadOnly', 'true')
      if (tab?.types) params.set('types', tab.types.join(','))
      return params.toString()
    },
    [activeFilter]
  )

  const fetchNotifications = useCallback(
    async (append = false) => {
      try {
        setLoading(true)
        const offset = append ? notifications.length : 0
        const res = await fetch(`/api/notifications?${buildQuery(offset)}`)

        if (!res.ok) {
          if (res.status === 401) {
            setNotifications([])
            setUnreadCount(0)
            return
          }
          throw new Error('Failed to fetch notifications')
        }

        const data: NotificationsResponse = await res.json()

        setNotifications((prev) => (append ? [...prev, ...data.notifications] : data.notifications))
        setUnreadCount(data.unreadCount)
        setHasMore(data.hasMore)
      } catch (error) {
        console.error('Error fetching notifications:', error)
      } finally {
        setLoading(false)
      }
    },
    [notifications.length, buildQuery]
  )

  // Lightweight count-only fetch used by polling + focus refetch.
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?countOnly=true')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount)
      }
    } catch {
      // Silently fail for background polling.
    }
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
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
  }, [])

  const markAllAsRead = useCallback(async () => {
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
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotifications((prev) => {
          const target = prev.find((n) => n.id === id)
          if (target && !target.isRead) {
            setUnreadCount((c) => Math.max(0, c - 1))
          }
          return prev.filter((n) => n.id !== id)
        })
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [])

  // Initial unread fetch on mount.
  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  // Background poll every 60s. Lower frequency than before — the focus-aware
  // refetch below covers the "I came back to the tab" case far better than
  // burning a request every 30s.
  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchUnreadCount, 60000)
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchUnreadCount])

  // Refetch immediately when the tab becomes visible. This is the bigger
  // UX win than a tighter interval — most stale-bell complaints are "I came
  // back from another tab and the count is wrong."
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchUnreadCount])

  // Refetch the full list when the dropdown opens or the filter changes.
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
    // Intentional: only refetch on open or filter change, not on
    // notifications.length flux from optimistic updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeFilter])

  // Click outside (desktop only).
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (window.innerWidth < 768) return
      const target = e.target as Node
      const insideButton = dropdownRef.current?.contains(target)
      const insidePanel = panelRef.current?.contains(target)
      if (!insideButton && !insidePanel) {
        setIsOpen(false)
      }
    }
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  // Anchor coordinates for the desktop popover. Recomputed each open via
  // a state hook so React picks up changes (window resize, scroll) and
  // re-renders the panel at the right spot.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      if (!dropdownRef.current) return
      const r = dropdownRef.current.getBoundingClientRect()
      setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isOpen])

  const panel = (
    <motion.div
      key="panel"
      ref={panelRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={(e) => e.stopPropagation()}
      className="
        flex flex-col bg-white shadow-md
        fixed inset-x-0 bottom-0 max-h-[85vh] z-9999 rounded-t-lg
        md:inset-x-auto md:bottom-auto md:max-h-[600px] md:w-[420px] md:rounded-none md:border md:border-black/15
      "
      style={
        anchor
          ? { top: anchor.top, right: anchor.right }
          : undefined
      }
    >
      {/* Mobile drag handle */}
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div className="w-10 h-1 bg-black/10" />
      </div>

      {/* Header — editorial eyebrow, no chip */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
        <div className="flex items-center gap-2">
          <Bell size={14} weight="bold" className="text-black/55" />
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">
            Inbox{unreadCount > 0 ? ` · ${unreadCount} Unread` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[10px] font-black uppercase tracking-[0.16em] hover:underline underline-offset-4"
              style={{ color: tierAccent.accentDark }}
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-black/5 transition-colors"
            aria-label="Close notifications"
          >
            <X size={14} weight="bold" className="text-black/45" />
          </button>
        </div>
      </div>

      {/* Filter tab strip */}
      <div className="flex items-center gap-1 px-4 border-b border-black/10 overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 py-2.5 px-2 text-[10px] font-black uppercase tracking-[0.14em] border-b-2 transition-colors ${
                isActive ? 'text-black' : 'text-black/45 border-transparent hover:text-black/70'
              }`}
              style={isActive ? { borderBottomColor: tierAccent.accent } : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-block w-6 h-6 border-2 border-black/10 border-t-black animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={20} className="text-black/20 mx-auto" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">
              All Caught Up
            </p>
            <p className="mt-1 text-xs text-black/40">
              We&apos;ll let you know when something happens.
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                accentColor={tierAccent.accent}
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={() => setIsOpen(false)}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => fetchNotifications(true)}
                disabled={loading}
                className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black hover:bg-black/3 transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer — links to inbox + settings */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-black/10">
        <Link
          href="/profile/notifications"
          onClick={() => setIsOpen(false)}
          className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black"
        >
          View All →
        </Link>
        <Link
          href="/profile/notifications?tab=preferences"
          onClick={() => setIsOpen(false)}
          className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black"
        >
          Settings →
        </Link>
      </div>
    </motion.div>
  )

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button — sharp tier-color badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 transition-colors ${
          isOpen ? 'text-black bg-black/5' : 'text-black/55 hover:text-black hover:bg-black/5'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} weight={unreadCount > 0 ? 'fill' : 'bold'} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 text-white text-[10px] font-black h-[18px] min-w-[18px] px-1 flex items-center justify-center"
            style={{ backgroundColor: tierAccent.accent }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Mobile backdrop — un-portaled keys via the fragment children */}
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm z-9998 md:hidden"
                  onClick={() => setIsOpen(false)}
                />
                {panel}
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
