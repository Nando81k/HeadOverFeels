'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Navigation } from '@/components/layout/Navigation'
import { useAuth } from '@/lib/auth/context'
import {
  Bell,
  EnvelopeSimple,
  DeviceMobile,
  CircleNotch,
  ArrowLeft,
  Medal,
  Package,
  Tag,
  Gift,
  Fire,
  Check,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from '@/lib/toast'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'
import { NotificationItem, type Notification } from '@/components/notifications/NotificationCenter'

interface NotificationPreferences {
  // In-App
  inAppPointsEarned: boolean
  inAppTierUpdates: boolean
  inAppOrderUpdates: boolean
  inAppPromotions: boolean
  inAppDropAlerts: boolean
  inAppRewardReminders: boolean
  // Email
  emailPointsEarned: boolean
  emailTierUpdates: boolean
  emailOrderUpdates: boolean
  emailPromotions: boolean
  emailDropAlerts: boolean
  emailRewardReminders: boolean
  emailPointsExpiring: boolean
  emailBirthdayBonus: boolean
  // SMS
  smsOrderUpdates: boolean
  smsDropAlerts: boolean
}

const PREFERENCE_GROUPS = [
  {
    id: 'points',
    label: 'Care Points & Loyalty',
    icon: Medal,
    preferences: [
      { key: 'inAppPointsEarned', label: 'Points earned notifications', channel: 'inApp' },
      { key: 'emailPointsEarned', label: 'Points earned emails', channel: 'email' },
      { key: 'inAppTierUpdates', label: 'Tier upgrade notifications', channel: 'inApp' },
      { key: 'emailTierUpdates', label: 'Tier upgrade emails', channel: 'email' },
      { key: 'emailPointsExpiring', label: 'Points expiring reminders', channel: 'email' },
      { key: 'emailBirthdayBonus', label: 'Birthday bonus emails', channel: 'email' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders & Shipping',
    icon: Package,
    preferences: [
      { key: 'inAppOrderUpdates', label: 'Order status notifications', channel: 'inApp' },
      { key: 'emailOrderUpdates', label: 'Order confirmation & shipping emails', channel: 'email' },
      { key: 'smsOrderUpdates', label: 'Order & shipping text alerts', channel: 'sms' },
    ],
  },
  {
    id: 'rewards',
    label: 'Rewards & Redemptions',
    icon: Gift,
    preferences: [
      { key: 'inAppRewardReminders', label: 'Reward available notifications', channel: 'inApp' },
      { key: 'emailRewardReminders', label: 'Reward available emails', channel: 'email' },
    ],
  },
  {
    id: 'promotions',
    label: 'Promotions & Offers',
    icon: Tag,
    preferences: [
      { key: 'inAppPromotions', label: 'Promo notifications', channel: 'inApp' },
      { key: 'emailPromotions', label: 'Promo emails', channel: 'email' },
    ],
  },
  {
    id: 'drops',
    label: 'Drops & Restocks',
    icon: Fire,
    preferences: [
      { key: 'inAppDropAlerts', label: 'Drop notifications', channel: 'inApp' },
      { key: 'emailDropAlerts', label: 'Drop reminder emails', channel: 'email' },
      { key: 'smsDropAlerts', label: 'Drop text alerts', channel: 'sms' },
    ],
  },
]

function ChannelBadge({ channel }: { channel: string }) {
  const config = {
    inApp: { icon: Bell, label: 'In-App' },
    email: { icon: EnvelopeSimple, label: 'Email' },
    sms: { icon: DeviceMobile, label: 'SMS' },
  }[channel]

  if (!config) return null
  const Icon = config.icon

  return (
    <span className="inline-flex items-center gap-1 border border-black/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-black/55">
      <Icon size={10} weight="bold" />
      {config.label}
    </span>
  )
}

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

interface InboxState {
  notifications: Notification[]
  total: number
  unreadCount: number
  hasMore: boolean
  loading: boolean
}

function InboxTab({ accentColor, accentDark }: { accentColor: string; accentDark: string }) {
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [state, setState] = useState<InboxState>({
    notifications: [],
    total: 0,
    unreadCount: 0,
    hasMore: false,
    loading: true,
  })

  const buildQuery = useCallback(
    (offset: number) => {
      const tab = FILTER_TABS.find((t) => t.key === activeFilter)
      const params = new URLSearchParams({ limit: '20', offset: String(offset) })
      if (tab?.key === 'unread') params.set('unreadOnly', 'true')
      if (tab?.types) params.set('types', tab.types.join(','))
      return params.toString()
    },
    [activeFilter]
  )

  const load = useCallback(
    async (append = false) => {
      setState((s) => ({ ...s, loading: true }))
      try {
        const offset = append ? state.notifications.length : 0
        const res = await fetch(`/api/notifications?${buildQuery(offset)}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setState((s) => ({
          notifications: append ? [...s.notifications, ...data.notifications] : data.notifications,
          total: data.total,
          unreadCount: data.unreadCount,
          hasMore: data.hasMore,
          loading: false,
        }))
      } catch (err) {
        console.error('Failed to load inbox:', err)
        setState((s) => ({ ...s, loading: false }))
      }
    },
    [buildQuery, state.notifications.length]
  )

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter])

  const markAsRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  }, [])

  const deleteNotification = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setState((s) => {
      const target = s.notifications.find((n) => n.id === id)
      return {
        ...s,
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: target && !target.isRead ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
      }
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markAllRead' }),
    })
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      unreadCount: 0,
    }))
  }, [])

  const clearRead = useCallback(async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clearRead' }),
    })
    load(false)
  }, [load])

  return (
    <div>
      {/* Filter strip */}
      <div className="flex items-center gap-1 border-b border-black/10 overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 py-2.5 px-3 text-[10px] font-black uppercase tracking-[0.14em] border-b-2 transition-colors ${
                isActive ? 'text-black' : 'text-black/45 border-transparent hover:text-black/70'
              }`}
              style={isActive ? { borderBottomColor: accentColor } : undefined}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-1 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/55">
        <span>
          {state.total} {state.total === 1 ? 'Notification' : 'Notifications'}
          {state.unreadCount > 0 ? ` · ${state.unreadCount} Unread` : ''}
        </span>
        <div className="flex items-center gap-4">
          {state.unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="hover:underline underline-offset-4"
              style={{ color: accentDark }}
            >
              Mark All Read
            </button>
          )}
          {state.notifications.some((n) => n.isRead) && (
            <button onClick={clearRead} className="hover:text-black hover:underline underline-offset-4">
              Clear Read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="border-t border-black/10">
        {state.loading && state.notifications.length === 0 ? (
          <div className="p-12 text-center">
            <CircleNotch size={20} className="animate-spin text-black/40 mx-auto" />
          </div>
        ) : state.notifications.length === 0 ? (
          <div className="p-16 text-center">
            <Bell size={20} className="text-black/20 mx-auto" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-black/55">All Caught Up</p>
            <p className="mt-1 text-xs text-black/40">Nothing here yet — we&apos;ll let you know.</p>
          </div>
        ) : (
          <div>
            {state.notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                accentColor={accentColor}
                onMarkRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))}
            {state.hasMore && (
              <button
                onClick={() => load(true)}
                disabled={state.loading}
                className="w-full px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black hover:bg-black/3 transition-colors disabled:opacity-50"
              >
                {state.loading ? 'Loading…' : 'Load More'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

interface PreferencesTabProps {
  preferences: NotificationPreferences | null
  setPreferences: (p: NotificationPreferences | ((prev: NotificationPreferences | null) => NotificationPreferences | null)) => void
  newsletterSubscribed: boolean
  newsletterSaving: boolean
  onNewsletterToggle: () => void
  hasChanges: boolean
  saving: boolean
  loading: boolean
  onSave: () => void
  onEnableAll: () => void
  onDisableAll: () => void
  onRetry: () => void
  accentColor: string
}

function PreferencesTab({
  preferences,
  setPreferences,
  newsletterSubscribed,
  newsletterSaving,
  onNewsletterToggle,
  hasChanges,
  saving,
  loading,
  onSave,
  onEnableAll,
  onDisableAll,
  onRetry,
  accentColor,
}: PreferencesTabProps) {
  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: !preferences[key] })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <CircleNotch size={24} weight="bold" className="animate-spin text-black/40" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-black/55">Failed to load preferences</p>
        <button onClick={onRetry} className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] underline" style={{ color: accentColor }}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 py-4">
      {/* Quick actions */}
      <div className="flex items-center justify-between border-b border-black/10 pb-3 text-[10px] font-black uppercase tracking-[0.14em] text-black/55">
        <span>Bulk</span>
        <div className="flex gap-4">
          <button onClick={onEnableAll} className="hover:underline underline-offset-4" style={{ color: accentColor }}>
            Enable All
          </button>
          <button onClick={onDisableAll} className="hover:underline underline-offset-4 text-black/55 hover:text-black">
            Disable All
          </button>
        </div>
      </div>

      {/* Newsletter */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">Newsletter</h3>
          <ChannelBadge channel="email" />
        </div>
        <div className="flex items-center justify-between border border-black/10 px-4 py-3">
          <div>
            <p className="text-sm font-black tracking-tight text-black">Drop alerts, restocks, exclusive offers</p>
            <p className="text-xs text-black/55 mt-0.5">{newsletterSubscribed ? 'Subscribed' : 'Not subscribed'}</p>
          </div>
          <button
            onClick={onNewsletterToggle}
            disabled={newsletterSaving}
            className="relative w-11 h-6 transition-colors"
            style={{ backgroundColor: newsletterSubscribed ? accentColor : 'rgba(0,0,0,0.15)' }}
            aria-pressed={newsletterSubscribed}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white shadow-sm transition-transform ${
                newsletterSubscribed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Preference groups */}
      {PREFERENCE_GROUPS.map((group) => {
        const Icon = group.icon
        return (
          <section key={group.id}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={14} weight="bold" className="text-black/55" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-black/65">{group.label}</h3>
            </div>
            <div className="border border-black/10">
              {group.preferences.map((pref, idx) => (
                <div
                  key={pref.key}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx === group.preferences.length - 1 ? '' : 'border-b border-black/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-black">{pref.label}</span>
                    <ChannelBadge channel={pref.channel} />
                  </div>
                  <button
                    onClick={() => handleToggle(pref.key as keyof NotificationPreferences)}
                    className="relative w-11 h-6 transition-colors"
                    style={{
                      backgroundColor: preferences[pref.key as keyof NotificationPreferences]
                        ? accentColor
                        : 'rgba(0,0,0,0.15)',
                    }}
                    aria-pressed={preferences[pref.key as keyof NotificationPreferences]}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white shadow-sm transition-transform ${
                        preferences[pref.key as keyof NotificationPreferences] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {/* Save */}
      <div className="sticky bottom-4 pt-4">
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          style={hasChanges ? { backgroundColor: accentColor } : undefined}
          className={`w-full py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all flex items-center justify-center gap-2 ${
            hasChanges ? 'text-white hover:brightness-90' : 'bg-black/10 text-black/40 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <CircleNotch size={14} weight="bold" className="animate-spin" />
              Saving…
            </>
          ) : hasChanges ? (
            'Save Preferences'
          ) : (
            <>
              <Check size={14} weight="bold" />
              All Changes Saved
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-black/40 text-center pb-4 leading-relaxed">
        SMS notifications require a phone number on file and SMS opt-in.<br />
        Update contact info in your{' '}
        <Link href="/profile" className="underline underline-offset-2" style={{ color: accentColor }}>
          profile settings
        </Link>
        .
      </p>
    </motion.div>
  )
}

function NotificationsHubInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const tierAccent = useTierAccent()

  // Tab driven by ?tab=preferences for deep-linking from the bell footer.
  const initialTab = searchParams.get('tab') === 'preferences' ? 'preferences' : 'inbox'
  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences'>(initialTab)

  useEffect(() => {
    setActiveTab(searchParams.get('tab') === 'preferences' ? 'preferences' : 'inbox')
  }, [searchParams])

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [initialPrefs, setInitialPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false)
  const [newsletterSaving, setNewsletterSaving] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences)
        setInitialPrefs(data.preferences)
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error)
      toast.error('Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/signin')
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      setNewsletterSubscribed(Boolean(user.newsletter))
      fetchPreferences()
    }
  }, [user, fetchPreferences])

  useEffect(() => {
    if (preferences && initialPrefs) {
      const changed = Object.keys(preferences).some(
        (key) =>
          preferences[key as keyof NotificationPreferences] !==
          initialPrefs[key as keyof NotificationPreferences]
      )
      setHasChanges(changed)
    }
  }, [preferences, initialPrefs])

  const handleSave = async () => {
    if (!preferences) return
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      setPreferences(data.preferences)
      setInitialPrefs(data.preferences)
      toast.success('Preferences saved!')
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  const handleEnableAll = () => {
    if (!preferences) return
    const allEnabled = { ...preferences }
    ;(Object.keys(allEnabled) as Array<keyof NotificationPreferences>).forEach((k) => {
      allEnabled[k] = true
    })
    setPreferences(allEnabled)
  }

  const handleDisableAll = () => {
    if (!preferences) return
    const allDisabled = { ...preferences }
    ;(Object.keys(allDisabled) as Array<keyof NotificationPreferences>).forEach((k) => {
      allDisabled[k] = false
    })
    setPreferences(allDisabled)
  }

  const handleNewsletterToggle = async () => {
    if (newsletterSaving) return
    const nextSubscribed = !newsletterSubscribed
    setNewsletterSaving(true)
    try {
      const response = await fetch('/api/profile/newsletter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: nextSubscribed }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to update')
      setNewsletterSubscribed(Boolean(data.subscribed))
      await refreshUser()
      toast.success(nextSubscribed ? 'Subscribed to newsletter' : 'Unsubscribed from newsletter')
    } catch (error) {
      console.error('Failed to update newsletter status:', error)
      toast.error('Failed to update newsletter preference')
    } finally {
      setNewsletterSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={24} weight="bold" className="animate-spin text-black/40" />
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-white pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-black/55 hover:text-black mb-3"
            >
              <ArrowLeft size={12} weight="bold" />
              Back to Profile
            </Link>
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight">NOTIFICATIONS</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-black/10">
            {(['inbox', 'preferences'] as const).map((tab) => {
              const isActive = activeTab === tab
              const label = tab === 'inbox' ? 'Inbox' : 'Preferences'
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab)
                    const params = new URLSearchParams(searchParams.toString())
                    if (tab === 'preferences') params.set('tab', 'preferences')
                    else params.delete('tab')
                    router.replace(`/profile/notifications${params.toString() ? `?${params}` : ''}`, { scroll: false })
                  }}
                  className={`py-3 px-3 text-[11px] font-black uppercase tracking-[0.16em] border-b-2 transition-colors ${
                    isActive ? 'text-black' : 'text-black/45 border-transparent hover:text-black/70'
                  }`}
                  style={isActive ? { borderBottomColor: tierAccent.accent } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {activeTab === 'inbox' ? (
            <InboxTab accentColor={tierAccent.accent} accentDark={tierAccent.accentDark} />
          ) : (
            <PreferencesTab
              preferences={preferences}
              setPreferences={setPreferences as PreferencesTabProps['setPreferences']}
              newsletterSubscribed={newsletterSubscribed}
              newsletterSaving={newsletterSaving}
              onNewsletterToggle={handleNewsletterToggle}
              hasChanges={hasChanges}
              saving={saving}
              loading={loading}
              onSave={handleSave}
              onEnableAll={handleEnableAll}
              onDisableAll={handleDisableAll}
              onRetry={fetchPreferences}
              accentColor={tierAccent.accent}
            />
          )}
        </div>
      </main>
    </>
  )
}

export default function NotificationsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <CircleNotch size={24} weight="bold" className="animate-spin text-black/40" />
        </div>
      }
    >
      <NotificationsHubInner />
    </Suspense>
  )
}
