'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Gear, 
  CircleNotch, 
  FloppyDisk, 
  ArrowLeft,
  CurrencyDollar,
  Users,
  Star,
  Gift,
  Calendar,
  Clock,
  Eye,
  ArrowsClockwise,
  Check,
  Warning,
  Power
} from '@phosphor-icons/react'

interface LoyaltySettings {
  id: string
  isEnabled: boolean
  programName: string
  pointsPerDollar: number
  pointsRoundingMode: string
  minimumOrderForPoints: number
  referralPointsReferrer: number
  referralPointsReferred: number
  referralEnabled: boolean
  reviewPointsEnabled: boolean
  reviewPointsAmount: number
  reviewWithPhotoBonus: number
  birthdayRewardsEnabled: boolean
  birthdayRewardType: string
  birthdayRewardValue: number
  birthdayRewardExpireDays: number
  pointsExpireEnabled: boolean
  pointsExpireMonths: number
  tierEvaluationPeriod: string
  tierDowngradeEnabled: boolean
  showPointsInCart: boolean
  showPointsInCheckout: boolean
  showTierProgress: boolean
}

export default function LoyaltySettingsPage() {
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalSettings, setOriginalSettings] = useState<LoyaltySettings | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (settings && originalSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings)
      setHasChanges(changed)
    }
  }, [settings, originalSettings])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/loyalty/settings')
      if (!response.ok) throw new Error('Failed to load settings')
      const data = await response.json()
      setSettings(data)
      setOriginalSettings(data)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setError('Failed to load loyalty settings')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = <K extends keyof LoyaltySettings>(
    field: K,
    value: LoyaltySettings[K]
  ) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : null)
    setSaved(false)
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/loyalty/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      const updatedSettings = await response.json()
      setSettings(updatedSettings)
      setOriginalSettings(updatedSettings)
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings)
      setHasChanges(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <CircleNotch size={32} weight="bold" className="animate-spin text-black/30" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Warning size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-black/60">{error || 'Failed to load settings'}</p>
          <button
            onClick={loadSettings}
            className="mt-4 px-4 py-2 bg-black text-white font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-black/10 sticky top-0 bg-white z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/admin/loyalty"
            className="inline-flex items-center gap-2 text-black/60 hover:text-black transition-colors mb-4"
          >
            <ArrowLeft size={20} weight="bold" />
            <span className="font-medium">Back to Loyalty</span>
          </Link>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-black flex items-center justify-center">
                <Gear size={24} weight="fill" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-black">Program Settings</h1>
                <p className="text-black/60">Configure your loyalty rewards program</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
                >
                  <ArrowsClockwise size={18} weight="bold" />
                  Reset
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium hover:bg-black/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <CircleNotch size={18} weight="bold" className="animate-spin" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <Check size={18} weight="bold" />
                    Saved!
                  </>
                ) : (
                  <>
                    <FloppyDisk size={18} weight="bold" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 flex items-center gap-2">
            <Warning size={18} weight="bold" />
            {error}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Program Status */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Power size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Program Status</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-4 border border-black/10 cursor-pointer hover:bg-black/5">
              <input
                type="checkbox"
                checked={settings.isEnabled}
                onChange={(e) => handleChange('isEnabled', e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium text-black">Loyalty Program Enabled</span>
                <p className="text-sm text-black/50">Turn the entire loyalty program on or off</p>
              </div>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Program Name</label>
              <input
                type="text"
                value={settings.programName}
                onChange={(e) => handleChange('programName', e.target.value)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                placeholder="Loyalty Rewards"
              />
            </div>
          </div>
        </section>

        {/* Points Earning */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CurrencyDollar size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Points Earning</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">Points Per Dollar</label>
              <input
                type="number"
                min="0"
                value={settings.pointsPerDollar}
                onChange={(e) => handleChange('pointsPerDollar', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
              />
              <p className="text-xs text-black/50 mt-1">Base points earned per $1 spent</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Rounding Mode</label>
              <select
                value={settings.pointsRoundingMode}
                onChange={(e) => handleChange('pointsRoundingMode', e.target.value)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
              >
                <option value="round">Round (nearest)</option>
                <option value="floor">Floor (down)</option>
                <option value="ceil">Ceiling (up)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-black mb-2">Minimum Order ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.minimumOrderForPoints}
                onChange={(e) => handleChange('minimumOrderForPoints', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
              />
              <p className="text-xs text-black/50 mt-1">Min order value to earn points</p>
            </div>
          </div>
        </section>

        {/* Referral Program */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Referral Program</h2>
          </div>
          
          <label className="flex items-center gap-3 mb-4 p-3 border border-black/10 cursor-pointer hover:bg-black/5">
            <input
              type="checkbox"
              checked={settings.referralEnabled}
              onChange={(e) => handleChange('referralEnabled', e.target.checked)}
              className="w-5 h-5"
            />
            <div>
              <span className="font-medium text-black">Enable Referral Program</span>
              <p className="text-sm text-black/50">Allow customers to refer friends for points</p>
            </div>
          </label>
          
          {settings.referralEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Referrer Points</label>
                <input
                  type="number"
                  min="0"
                  value={settings.referralPointsReferrer}
                  onChange={(e) => handleChange('referralPointsReferrer', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
                <p className="text-xs text-black/50 mt-1">Points for person who refers</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Referred Points</label>
                <input
                  type="number"
                  min="0"
                  value={settings.referralPointsReferred}
                  onChange={(e) => handleChange('referralPointsReferred', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
                <p className="text-xs text-black/50 mt-1">Points for new customer</p>
              </div>
            </div>
          )}
        </section>

        {/* Review Points */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Star size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Review Rewards</h2>
          </div>
          
          <label className="flex items-center gap-3 mb-4 p-3 border border-black/10 cursor-pointer hover:bg-black/5">
            <input
              type="checkbox"
              checked={settings.reviewPointsEnabled}
              onChange={(e) => handleChange('reviewPointsEnabled', e.target.checked)}
              className="w-5 h-5"
            />
            <div>
              <span className="font-medium text-black">Enable Review Points</span>
              <p className="text-sm text-black/50">Reward customers for leaving reviews</p>
            </div>
          </label>
          
          {settings.reviewPointsEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Review Points</label>
                <input
                  type="number"
                  min="0"
                  value={settings.reviewPointsAmount}
                  onChange={(e) => handleChange('reviewPointsAmount', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
                <p className="text-xs text-black/50 mt-1">Base points for a review</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Photo Bonus Points</label>
                <input
                  type="number"
                  min="0"
                  value={settings.reviewWithPhotoBonus}
                  onChange={(e) => handleChange('reviewWithPhotoBonus', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
                <p className="text-xs text-black/50 mt-1">Extra points for photo reviews</p>
              </div>
            </div>
          )}
        </section>

        {/* Birthday Rewards */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Birthday Rewards</h2>
          </div>
          
          <label className="flex items-center gap-3 mb-4 p-3 border border-black/10 cursor-pointer hover:bg-black/5">
            <input
              type="checkbox"
              checked={settings.birthdayRewardsEnabled}
              onChange={(e) => handleChange('birthdayRewardsEnabled', e.target.checked)}
              className="w-5 h-5"
            />
            <div>
              <span className="font-medium text-black">Enable Birthday Rewards</span>
              <p className="text-sm text-black/50">Automatically reward customers on their birthday</p>
            </div>
          </label>
          
          {settings.birthdayRewardsEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">Reward Type</label>
                <select
                  value={settings.birthdayRewardType}
                  onChange={(e) => handleChange('birthdayRewardType', e.target.value)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                >
                  <option value="points">Bonus Points</option>
                  <option value="discount">Discount %</option>
                  <option value="reward">Free Reward</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  {settings.birthdayRewardType === 'points' ? 'Points Amount' :
                   settings.birthdayRewardType === 'discount' ? 'Discount %' : 'Reward ID'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.birthdayRewardValue}
                  onChange={(e) => handleChange('birthdayRewardValue', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-2">Expires After (days)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.birthdayRewardExpireDays}
                  onChange={(e) => handleChange('birthdayRewardExpireDays', parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                />
                <p className="text-xs text-black/50 mt-1">Days to redeem birthday reward</p>
              </div>
            </div>
          )}
        </section>

        {/* Points Expiration */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Points Expiration</h2>
          </div>
          
          <label className="flex items-center gap-3 mb-4 p-3 border border-black/10 cursor-pointer hover:bg-black/5">
            <input
              type="checkbox"
              checked={settings.pointsExpireEnabled}
              onChange={(e) => handleChange('pointsExpireEnabled', e.target.checked)}
              className="w-5 h-5"
            />
            <div>
              <span className="font-medium text-black">Enable Points Expiration</span>
              <p className="text-sm text-black/50">Points expire after a set period of inactivity</p>
            </div>
          </label>
          
          {settings.pointsExpireEnabled && (
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-black mb-2">Expire After (months)</label>
              <input
                type="number"
                min="1"
                value={settings.pointsExpireMonths}
                onChange={(e) => handleChange('pointsExpireMonths', parseInt(e.target.value) || 12)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
              />
              <p className="text-xs text-black/50 mt-1">Months of inactivity before points expire</p>
            </div>
          )}
        </section>

        {/* Tier Settings */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Tier Evaluation</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">Evaluation Period</label>
              <select
                value={settings.tierEvaluationPeriod}
                onChange={(e) => handleChange('tierEvaluationPeriod', e.target.value)}
                className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
              >
                <option value="annual">Annual (calendar year)</option>
                <option value="rolling">Rolling (12 months)</option>
                <option value="lifetime">Lifetime (total)</option>
              </select>
              <p className="text-xs text-black/50 mt-1">How tier qualification is calculated</p>
            </div>
            
            <label className="flex items-center gap-3 p-4 border border-black/10 cursor-pointer hover:bg-black/5">
              <input
                type="checkbox"
                checked={settings.tierDowngradeEnabled}
                onChange={(e) => handleChange('tierDowngradeEnabled', e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium text-black">Allow Tier Downgrade</span>
                <p className="text-sm text-black/50">Customers can lose tier status</p>
              </div>
            </label>
          </div>
        </section>

        {/* Display Settings */}
        <section className="border border-black/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Eye size={20} weight="bold" className="text-black" />
            <h2 className="text-lg font-bold text-black">Display Settings</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-3 p-4 border border-black/10 cursor-pointer hover:bg-black/5">
              <input
                type="checkbox"
                checked={settings.showPointsInCart}
                onChange={(e) => handleChange('showPointsInCart', e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium text-black">Show in Cart</span>
                <p className="text-sm text-black/50">Points earned preview</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-4 border border-black/10 cursor-pointer hover:bg-black/5">
              <input
                type="checkbox"
                checked={settings.showPointsInCheckout}
                onChange={(e) => handleChange('showPointsInCheckout', e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium text-black">Show at Checkout</span>
                <p className="text-sm text-black/50">Points summary</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-4 border border-black/10 cursor-pointer hover:bg-black/5">
              <input
                type="checkbox"
                checked={settings.showTierProgress}
                onChange={(e) => handleChange('showTierProgress', e.target.checked)}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium text-black">Show Tier Progress</span>
                <p className="text-sm text-black/50">Progress bar to next tier</p>
              </div>
            </label>
          </div>
        </section>

        {/* Quick Links */}
        <div className="flex gap-4">
          <Link 
            href="/admin/loyalty/tiers"
            className="flex items-center gap-2 px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
          >
            Manage Tiers
          </Link>
          <Link 
            href="/admin/loyalty/rewards"
            className="flex items-center gap-2 px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
          >
            Manage Rewards
          </Link>
          <Link 
            href="/admin/loyalty"
            className="flex items-center gap-2 px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
