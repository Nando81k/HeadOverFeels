'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Check
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from '@/lib/toast'

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
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
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
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
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
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
    preferences: [
      { key: 'inAppRewardReminders', label: 'Available rewards notifications', channel: 'inApp' },
      { key: 'emailRewardReminders', label: 'Rewards reminder emails', channel: 'email' },
    ],
  },
  {
    id: 'promotions',
    label: 'Promotions & Sales',
    icon: Tag,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    preferences: [
      { key: 'inAppPromotions', label: 'Sale & promo notifications', channel: 'inApp' },
      { key: 'emailPromotions', label: 'Promotional emails', channel: 'email' },
    ],
  },
  {
    id: 'drops',
    label: 'Limited Edition Drops',
    icon: Fire,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    preferences: [
      { key: 'inAppDropAlerts', label: 'Drop notifications', channel: 'inApp' },
      { key: 'emailDropAlerts', label: 'Drop reminder emails', channel: 'email' },
      { key: 'smsDropAlerts', label: 'Drop text alerts', channel: 'sms' },
    ],
  },
]

function ChannelBadge({ channel }: { channel: string }) {
  const config = {
    inApp: { icon: Bell, label: 'In-App', className: 'bg-gray-100 text-gray-600' },
    email: { icon: EnvelopeSimple, label: 'Email', className: 'bg-blue-100 text-blue-600' },
    sms: { icon: DeviceMobile, label: 'SMS', className: 'bg-green-100 text-green-600' },
  }[channel]

  if (!config) return null
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

export default function NotificationPreferencesPage() {
  const router = useRouter()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [initialPrefs, setInitialPrefs] = useState<NotificationPreferences | null>(null)
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
    if (!authLoading && !user) {
      router.push('/signin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      setNewsletterSubscribed(Boolean(user.newsletter))
      fetchPreferences()
    }
  }, [user, fetchPreferences])

  // Track changes
  useEffect(() => {
    if (preferences && initialPrefs) {
      const changed = Object.keys(preferences).some(
        (key) => preferences[key as keyof NotificationPreferences] !== initialPrefs[key as keyof NotificationPreferences]
      )
      setHasChanges(changed)
    }
  }, [preferences, initialPrefs])

  const handleToggle = (key: keyof NotificationPreferences) => {
    if (!preferences) return
    setPreferences({ ...preferences, [key]: !preferences[key] })
  }

  const handleSave = async () => {
    if (!preferences) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })

      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences)
        setInitialPrefs(data.preferences)
        toast.success('Preferences saved!')
        setHasChanges(false)
      } else {
        throw new Error('Failed to save')
      }
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
    Object.keys(allEnabled).forEach((key) => {
      allEnabled[key as keyof NotificationPreferences] = true
    })
    setPreferences(allEnabled)
  }

  const handleDisableAll = () => {
    if (!preferences) return
    const allDisabled = { ...preferences }
    Object.keys(allDisabled).forEach((key) => {
      allDisabled[key as keyof NotificationPreferences] = false
    })
    setPreferences(allDisabled)
  }

  const handleNewsletterToggle = async () => {
    if (newsletterSaving) {
      return
    }

    const nextSubscribed = !newsletterSubscribed
    setNewsletterSaving(true)

    try {
      const response = await fetch('/api/profile/newsletter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed: nextSubscribed }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update newsletter preference')
      }

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
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
      </div>
    )
  }

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-[#FAF8F5] pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft size={16} />
              Back to Profile
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                <Bell size={24} weight="fill" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
                <p className="text-sm text-gray-500">Choose how you want to be notified</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} weight="bold" className="animate-spin text-black" />
            </div>
          ) : preferences ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Quick Actions */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Quick actions:</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleEnableAll}
                    className="text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={handleDisableAll}
                    className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Disable All
                  </button>
                </div>
              </div>

              {/* Newsletter Subscription */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-semibold text-gray-900">Newsletter</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Drop alerts, restocks, and exclusive offers</p>
                  </div>
                  <ChannelBadge channel="email" />
                </div>
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-700">
                    {newsletterSubscribed ? 'Subscribed' : 'Not subscribed'}
                  </span>
                  <button
                    onClick={handleNewsletterToggle}
                    disabled={newsletterSaving}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      newsletterSubscribed ? 'bg-black' : 'bg-gray-200'
                    } ${newsletterSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                        newsletterSubscribed ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Preference Groups */}
              {PREFERENCE_GROUPS.map((group) => {
                const Icon = group.icon
                return (
                  <div key={group.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* Group Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                      <div className={`w-8 h-8 ${group.bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon size={18} weight="fill" className={group.color} />
                      </div>
                      <h3 className="font-semibold text-gray-900">{group.label}</h3>
                    </div>

                    {/* Preferences */}
                    <div className="divide-y divide-gray-50">
                      {group.preferences.map((pref) => (
                        <div
                          key={pref.key}
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-700">{pref.label}</span>
                            <ChannelBadge channel={pref.channel} />
                          </div>
                          <button
                            onClick={() => handleToggle(pref.key as keyof NotificationPreferences)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              preferences[pref.key as keyof NotificationPreferences]
                                ? 'bg-black'
                                : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                                preferences[pref.key as keyof NotificationPreferences]
                                  ? 'translate-x-5'
                                  : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Save Button */}
              <div className="sticky bottom-4 pt-4">
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                    hasChanges
                      ? 'bg-black text-white hover:bg-gray-800'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <>
                      <CircleNotch size={18} weight="bold" className="animate-spin" />
                      Saving...
                    </>
                  ) : hasChanges ? (
                    'Save Preferences'
                  ) : (
                    <>
                      <Check size={18} weight="bold" />
                      All changes saved
                    </>
                  )}
                </button>
              </div>

              {/* Info Note */}
              <p className="text-xs text-gray-400 text-center pb-4">
                SMS notifications require a phone number on file and SMS opt-in.
                <br />
                You can update your contact info in your{' '}
                <Link href="/profile" className="text-blue-500 hover:underline">
                  profile settings
                </Link>
                .
              </p>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Failed to load preferences</p>
              <button
                onClick={fetchPreferences}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
