'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  CircleNotch, 
  FloppyDisk, 
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
  Power,
  Medal
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
      <AdminLayout title="Program Settings" subtitle="Configure your loyalty rewards program">
        <div className="flex items-center justify-center py-20">
          <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
        </div>
      </AdminLayout>
    )
  }

  if (!settings) {
    return (
      <AdminLayout title="Program Settings" subtitle="Configure your loyalty rewards program">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Warning size={48} className="mx-auto text-rose-500 mb-4" />
            <p className="text-white/60">{error || 'Failed to load settings'}</p>
            <Button
              onClick={loadSettings}
              className="mt-4 bg-[#FF3131] hover:bg-[#E02828]"
            >
              Retry
            </Button>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="Program Settings"
      subtitle="Configure your loyalty rewards program"
      headerActions={
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <ArrowsClockwise size={18} weight="bold" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-2 bg-[#FF3131] hover:bg-[#E02828] disabled:opacity-50"
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
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-2">
            <Warning size={18} weight="bold" />
            {error}
          </div>
        )}

        {/* Program Status */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#FF3131]/10 rounded-lg flex items-center justify-center">
                <Power size={20} weight="bold" className="text-[#FF3131]" />
              </div>
              <h2 className="text-lg font-bold text-white">Program Status</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) => handleChange('isEnabled', e.target.checked)}
                  className="w-5 h-5 accent-[#FF3131]"
                />
                <div>
                  <span className="font-medium text-white">Loyalty Program Enabled</span>
                  <p className="text-sm text-white/50">Turn the entire loyalty program on or off</p>
                </div>
              </label>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Program Name</label>
                <input
                  type="text"
                  value={settings.programName}
                  onChange={(e) => handleChange('programName', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none"
                  placeholder="Loyalty Rewards"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Points Earning */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CurrencyDollar size={20} weight="bold" className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Points Earning</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Points Per Dollar</label>
                <input
                  type="number"
                  min="0"
                  value={settings.pointsPerDollar}
                  onChange={(e) => handleChange('pointsPerDollar', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                />
                <p className="text-xs text-white/40 mt-1">Base points earned per $1 spent</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Rounding Mode</label>
                <select
                  value={settings.pointsRoundingMode}
                  onChange={(e) => handleChange('pointsRoundingMode', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                >
                  <option value="round">Round (nearest)</option>
                  <option value="floor">Floor (down)</option>
                  <option value="ceil">Ceiling (up)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Minimum Order ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.minimumOrderForPoints}
                  onChange={(e) => handleChange('minimumOrderForPoints', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                />
                <p className="text-xs text-white/40 mt-1">Min order value to earn points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral Program */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users size={20} weight="bold" className="text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Referral Program</h2>
            </div>
            
            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
              <input
                type="checkbox"
                checked={settings.referralEnabled}
                onChange={(e) => handleChange('referralEnabled', e.target.checked)}
                className="w-5 h-5 accent-[#FF3131]"
              />
              <div>
                <span className="font-medium text-white">Enable Referral Program</span>
                <p className="text-sm text-white/50">Allow customers to refer friends for points</p>
              </div>
            </label>
            
            {settings.referralEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Referrer Points</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.referralPointsReferrer}
                    onChange={(e) => handleChange('referralPointsReferrer', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                  <p className="text-xs text-white/40 mt-1">Points for person who refers</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Referred Points</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.referralPointsReferred}
                    onChange={(e) => handleChange('referralPointsReferred', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                  <p className="text-xs text-white/40 mt-1">Points for new customer</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Points */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Star size={20} weight="bold" className="text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Review Rewards</h2>
            </div>
            
            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
              <input
                type="checkbox"
                checked={settings.reviewPointsEnabled}
                onChange={(e) => handleChange('reviewPointsEnabled', e.target.checked)}
                className="w-5 h-5 accent-[#FF3131]"
              />
              <div>
                <span className="font-medium text-white">Enable Review Points</span>
                <p className="text-sm text-white/50">Reward customers for leaving reviews</p>
              </div>
            </label>
            
            {settings.reviewPointsEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Review Points</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.reviewPointsAmount}
                    onChange={(e) => handleChange('reviewPointsAmount', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                  <p className="text-xs text-white/40 mt-1">Base points for a review</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Photo Bonus Points</label>
                  <input
                    type="number"
                    min="0"
                    value={settings.reviewWithPhotoBonus}
                    onChange={(e) => handleChange('reviewWithPhotoBonus', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                  <p className="text-xs text-white/40 mt-1">Extra points for photo reviews</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Birthday Rewards */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                <Gift size={20} weight="bold" className="text-pink-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Birthday Rewards</h2>
            </div>
            
            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
              <input
                type="checkbox"
                checked={settings.birthdayRewardsEnabled}
                onChange={(e) => handleChange('birthdayRewardsEnabled', e.target.checked)}
                className="w-5 h-5 accent-[#FF3131]"
              />
              <div>
                <span className="font-medium text-white">Enable Birthday Rewards</span>
                <p className="text-sm text-white/50">Automatically reward customers on their birthday</p>
              </div>
            </label>
            
            {settings.birthdayRewardsEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Reward Type</label>
                  <select
                    value={settings.birthdayRewardType}
                    onChange={(e) => handleChange('birthdayRewardType', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  >
                    <option value="points">Bonus Points</option>
                    <option value="discount">Discount %</option>
                    <option value="reward">Free Reward</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    {settings.birthdayRewardType === 'points' ? 'Points Amount' :
                     settings.birthdayRewardType === 'discount' ? 'Discount %' : 'Reward ID'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={settings.birthdayRewardValue}
                    onChange={(e) => handleChange('birthdayRewardValue', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Expires After (days)</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.birthdayRewardExpireDays}
                    onChange={(e) => handleChange('birthdayRewardExpireDays', parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                  />
                  <p className="text-xs text-white/40 mt-1">Days to redeem birthday reward</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points Expiration */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                <Clock size={20} weight="bold" className="text-violet-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Points Expiration</h2>
            </div>
            
            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
              <input
                type="checkbox"
                checked={settings.pointsExpireEnabled}
                onChange={(e) => handleChange('pointsExpireEnabled', e.target.checked)}
                className="w-5 h-5 accent-[#FF3131]"
              />
              <div>
                <span className="font-medium text-white">Enable Points Expiration</span>
                <p className="text-sm text-white/50">Points expire after a set period of inactivity</p>
              </div>
            </label>
            
            {settings.pointsExpireEnabled && (
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-white/70 mb-2">Expire After (months)</label>
                <input
                  type="number"
                  min="1"
                  value={settings.pointsExpireMonths}
                  onChange={(e) => handleChange('pointsExpireMonths', parseInt(e.target.value) || 12)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                />
                <p className="text-xs text-white/40 mt-1">Months of inactivity before points expire</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tier Settings */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <Calendar size={20} weight="bold" className="text-cyan-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Tier Evaluation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Evaluation Period</label>
                <select
                  value={settings.tierEvaluationPeriod}
                  onChange={(e) => handleChange('tierEvaluationPeriod', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                >
                  <option value="annual">Annual (calendar year)</option>
                  <option value="rolling">Rolling (12 months)</option>
                  <option value="lifetime">Lifetime (total)</option>
                </select>
                <p className="text-xs text-white/40 mt-1">How tier qualification is calculated</p>
              </div>
              
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={settings.tierDowngradeEnabled}
                  onChange={(e) => handleChange('tierDowngradeEnabled', e.target.checked)}
                  className="w-5 h-5 accent-[#FF3131]"
                />
                <div>
                  <span className="font-medium text-white">Allow Tier Downgrade</span>
                  <p className="text-sm text-white/50">Customers can lose tier status</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card variant="dark">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                <Eye size={20} weight="bold" className="text-orange-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Display Settings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={settings.showPointsInCart}
                  onChange={(e) => handleChange('showPointsInCart', e.target.checked)}
                  className="w-5 h-5 accent-[#FF3131]"
                />
                <div>
                  <span className="font-medium text-white">Show in Cart</span>
                  <p className="text-sm text-white/50">Points earned preview</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={settings.showPointsInCheckout}
                  onChange={(e) => handleChange('showPointsInCheckout', e.target.checked)}
                  className="w-5 h-5 accent-[#FF3131]"
                />
                <div>
                  <span className="font-medium text-white">Show at Checkout</span>
                  <p className="text-sm text-white/50">Points summary</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={settings.showTierProgress}
                  onChange={(e) => handleChange('showTierProgress', e.target.checked)}
                  className="w-5 h-5 accent-[#FF3131]"
                />
                <div>
                  <span className="font-medium text-white">Show Tier Progress</span>
                  <p className="text-sm text-white/50">Progress bar to next tier</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="flex gap-4">
          <Link href="/admin/loyalty/tiers">
            <Button variant="outline" className="gap-2">
              <Medal size={18} />
              Manage Tiers
            </Button>
          </Link>
          <Link href="/admin/loyalty/rewards">
            <Button variant="outline" className="gap-2">
              <Gift size={18} />
              Manage Rewards
            </Button>
          </Link>
        </div>
      </div>
    </AdminLayout>
  )
}
