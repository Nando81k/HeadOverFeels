'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { 
  Medal, 
  Users, 
  CircleNotch, 
  FloppyDisk, 
  Plus, 
  Trash, 
  CaretDown,
  CaretUp,
  Truck,
  Lightning,
  Gift,
  Star,
  X,
  Warning
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Tier {
  id: string
  name: string
  slug: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualPoints: number
  minAnnualSpend: number
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  isInviteOnly: boolean
  perks: string | null
  sortOrder: number
  isActive: boolean
  _count: {
    customers: number
  }
}

interface ParsedPerks {
  careBox: boolean
  birthdayGift: boolean
  exclusiveEvents: boolean
  personalStylist: boolean
  customItems: boolean
  prioritySupport: boolean
}

const DEFAULT_PERKS: ParsedPerks = {
  careBox: false,
  birthdayGift: false,
  exclusiveEvents: false,
  personalStylist: false,
  customItems: false,
  prioritySupport: false,
}

const PERK_LABELS: Record<keyof ParsedPerks, { label: string; description: string }> = {
  careBox: { label: 'Care Box', description: 'Annual surprise gift box' },
  birthdayGift: { label: 'Birthday Gift', description: 'Special birthday reward' },
  exclusiveEvents: { label: 'Exclusive Events', description: 'VIP event access' },
  personalStylist: { label: 'Personal Stylist', description: 'One-on-one styling sessions' },
  customItems: { label: 'Custom Items', description: 'Personalized/engraved products' },
  prioritySupport: { label: 'Priority Support', description: 'Dedicated customer service' },
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const getColorInputValue = (value: string, fallback: string) => (
  HEX_COLOR_PATTERN.test(value) ? value : fallback
)

export default function AdminTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editedTiers, setEditedTiers] = useState<Record<string, Partial<Tier>>>({})
  const [expandedTier, setExpandedTier] = useState<string | null>(null)
  const [showNewTierForm, setShowNewTierForm] = useState(false)
  const [newTier, setNewTier] = useState({
    name: '',
    slug: '',
    description: '',
    primaryColor: '#64748B',
    secondaryColor: '#475569',
    minAnnualPoints: 0,
    pointMultiplier: 1.0,
    freeShipping: false,
    earlyDropAccess: false,
    isInviteOnly: false,
    perks: DEFAULT_PERKS,
  })
  const [creatingTier, setCreatingTier] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [tierToDelete, setTierToDelete] = useState<Tier | null>(null)

  useEffect(() => {
    loadTiers()
  }, [])

  const loadTiers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/loyalty/tiers')
      const data = await response.json()
      
      if (Array.isArray(data)) {
        setTiers(data)
      }
    } catch (error) {
      console.error('Failed to load tiers:', error)
    } finally {
      setLoading(false)
    }
  }

  const parsePerks = (perksString: string | null): ParsedPerks => {
    if (!perksString) return { ...DEFAULT_PERKS }
    try {
      const parsed = JSON.parse(perksString)
      return { ...DEFAULT_PERKS, ...parsed }
    } catch {
      return { ...DEFAULT_PERKS }
    }
  }

  const handleChange = (tierId: string, field: keyof Tier, value: string | number | boolean) => {
    setEditedTiers(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [field]: value
      }
    }))
  }

  const handlePerkChange = (tierId: string, perkKey: keyof ParsedPerks, value: boolean) => {
    const tier = tiers.find(t => t.id === tierId)
    if (!tier) return
    
    const currentPerks = parsePerks(editedTiers[tierId]?.perks as string | undefined ?? tier.perks)
    const newPerks = { ...currentPerks, [perkKey]: value }
    
    setEditedTiers(prev => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        perks: JSON.stringify(newPerks)
      }
    }))
  }

  const handleSave = async (tier: Tier) => {
    const changes = editedTiers[tier.id]
    if (!changes) return

    setSaving(tier.id)
    try {
      const response = await fetch(`/api/admin/loyalty/tiers/${tier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tier, ...changes }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error('Failed to update tier', data.error)
        return
      }

      toast.success('Tier updated')

      setEditedTiers(prev => {
        const next = { ...prev }
        delete next[tier.id]
        return next
      })

      loadTiers()
    } catch (error) {
      console.error('Failed to update tier:', error)
      toast.error('Failed to update tier')
    } finally {
      setSaving(null)
    }
  }

  const performDeleteTier = async () => {
    const tier = tierToDelete
    if (!tier) return

    if (tier._count.customers > 0) {
      toast.error(`Cannot delete tier with ${tier._count.customers} customers. Reassign customers first.`)
      setConfirmDeleteOpen(false)
      setTierToDelete(null)
      return
    }

    setDeleting(tier.id)
    try {
      const response = await fetch(`/api/admin/loyalty/tiers/${tier.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete tier')
        return
      }

      toast.success('Tier deleted')
      loadTiers()
    } catch (error) {
      console.error('Failed to delete tier:', error)
      toast.error('Failed to delete tier')
    } finally {
      setDeleting(null)
      setConfirmDeleteOpen(false)
      setTierToDelete(null)
    }
  }

  const handleDelete = (tier: Tier) => {
    setTierToDelete(tier)
    setConfirmDeleteOpen(true)
  }

  const handleCreateTier = async () => {
    if (!newTier.name || !newTier.slug) {
      toast.error('Name and slug are required')
      return
    }

    setCreatingTier(true)
    try {
      const response = await fetch('/api/admin/loyalty/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTier,
          perks: JSON.stringify(newTier.perks),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Failed to create tier')
        return
      }

      toast.success('Tier created')

      setNewTier({
        name: '',
        slug: '',
        description: '',
        primaryColor: '#64748B',
        secondaryColor: '#475569',
        minAnnualPoints: 0,
        pointMultiplier: 1.0,
        freeShipping: false,
        earlyDropAccess: false,
        isInviteOnly: false,
        perks: DEFAULT_PERKS,
      })
      setShowNewTierForm(false)
      loadTiers()
    } catch (error) {
      console.error('Failed to create tier:', error)
      toast.error('Failed to create tier')
    } finally {
      setCreatingTier(false)
    }
  }

  const getTierValue = <K extends keyof Tier>(tier: Tier, field: K): Tier[K] => {
    if (editedTiers[tier.id]?.[field] !== undefined) {
      return editedTiers[tier.id][field] as Tier[K]
    }
    return tier[field]
  }

  const getTierPerks = (tier: Tier): ParsedPerks => {
    const perksString = editedTiers[tier.id]?.perks as string | undefined ?? tier.perks
    return parsePerks(perksString)
  }

  const hasChanges = (tierId: string) => {
    return editedTiers[tierId] !== undefined && Object.keys(editedTiers[tierId]).length > 0
  }

  const totalMembers = tiers.reduce((sum, t) => sum + t._count.customers, 0)

  return (
    <AdminLayout
      title="Loyalty Tiers"
      subtitle="Configure tier requirements and benefits"
      headerActions={
        <Button onClick={() => setShowNewTierForm(true)} className="gap-2 bg-[#FF3131] hover:bg-[#E02828]">
          <Plus size={16} weight="bold" />
          Add Tier
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Total Tiers</p>
              <p className="text-2xl font-bold text-white">{tiers.length}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Total Members</p>
              <p className="text-2xl font-bold text-[#FF3131]">{totalMembers.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Active Tiers</p>
              <p className="text-2xl font-bold text-emerald-400">{tiers.filter(t => t.isActive).length}</p>
            </CardContent>
          </Card>
          <Card variant="dark">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Avg Multiplier</p>
              <p className="text-2xl font-bold text-amber-400">
                {tiers.length > 0 ? (tiers.reduce((sum, t) => sum + t.pointMultiplier, 0) / tiers.length).toFixed(2) : '0'}x
              </p>
            </CardContent>
          </Card>
        </div>

        {/* New Tier Form Modal */}
        {showNewTierForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-neutral-900 border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="border-b border-white/10 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Create New Tier</h2>
                <button
                  onClick={() => setShowNewTierForm(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X size={20} weight="bold" className="text-white/60" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Tier Name *</label>
                    <input
                      type="text"
                      value={newTier.name}
                      onChange={(e) => {
                        const name = e.target.value
                        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                        setNewTier(prev => ({ ...prev, name, slug }))
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none"
                      placeholder="e.g., Diamond"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Slug *</label>
                    <input
                      type="text"
                      value={newTier.slug}
                      onChange={(e) => setNewTier(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none"
                      placeholder="e.g., diamond"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                  <textarea
                    value={newTier.description}
                    onChange={(e) => setNewTier(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none"
                    placeholder="Brief description of this tier"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Gradient Start</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={getColorInputValue(newTier.primaryColor, '#64748B')}
                        onChange={(e) => setNewTier(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="h-10 w-12 border border-white/15 bg-transparent p-1"
                      />
                      <input
                        type="text"
                        value={newTier.primaryColor}
                        onChange={(e) => setNewTier(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none uppercase"
                        placeholder="#64748B"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Gradient End</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={getColorInputValue(newTier.secondaryColor, '#475569')}
                        onChange={(e) => setNewTier(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="h-10 w-12 border border-white/15 bg-transparent p-1"
                      />
                      <input
                        type="text"
                        value={newTier.secondaryColor}
                        onChange={(e) => setNewTier(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none uppercase"
                        placeholder="#475569"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Min Annual Points</label>
                    <input
                      type="number"
                      min="0"
                      value={newTier.minAnnualPoints}
                      onChange={(e) => setNewTier(prev => ({ ...prev, minAnnualPoints: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Points Multiplier</label>
                    <input
                      type="number"
                      min="1"
                      step="0.25"
                      value={newTier.pointMultiplier}
                      onChange={(e) => setNewTier(prev => ({ ...prev, pointMultiplier: parseFloat(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h3 className="font-medium text-white mb-3">Core Benefits</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={newTier.freeShipping}
                        onChange={(e) => setNewTier(prev => ({ ...prev, freeShipping: e.target.checked }))}
                        className="w-4 h-4 accent-[#FF3131]"
                      />
                      <Truck size={18} className="text-white/60" />
                      <span className="text-sm text-white">Free Shipping</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={newTier.earlyDropAccess}
                        onChange={(e) => setNewTier(prev => ({ ...prev, earlyDropAccess: e.target.checked }))}
                        className="w-4 h-4 accent-[#FF3131]"
                      />
                      <Lightning size={18} className="text-white/60" />
                      <span className="text-sm text-white">Early Drop Access</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                      <input
                        type="checkbox"
                        checked={newTier.isInviteOnly}
                        onChange={(e) => setNewTier(prev => ({ ...prev, isInviteOnly: e.target.checked }))}
                        className="w-4 h-4 accent-[#FF3131]"
                      />
                      <Star size={18} className="text-white/60" />
                      <span className="text-sm text-white">Invite Only</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h3 className="font-medium text-white mb-3">Additional Perks</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PERK_LABELS) as Array<keyof ParsedPerks>).map((perkKey) => (
                      <label key={perkKey} className="flex items-center gap-2 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                        <input
                          type="checkbox"
                          checked={newTier.perks[perkKey]}
                          onChange={(e) => setNewTier(prev => ({
                            ...prev,
                            perks: { ...prev.perks, [perkKey]: e.target.checked }
                          }))}
                          className="w-4 h-4 accent-[#FF3131]"
                        />
                        <div>
                          <span className="text-sm font-medium text-white">{PERK_LABELS[perkKey].label}</span>
                          <p className="text-xs text-white/50">{PERK_LABELS[perkKey].description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 p-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowNewTierForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTier}
                  disabled={creatingTier}
                  className="gap-2 bg-[#FF3131] hover:bg-[#E02828]"
                >
                  {creatingTier ? (
                    <>
                      <CircleNotch size={18} weight="bold" className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={18} weight="bold" />
                      Create Tier
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tiers List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
          </div>
        ) : tiers.length === 0 ? (
          <Card variant="dark">
            <CardContent className="text-center py-12">
              <Medal size={48} className="mx-auto text-white/20 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No tiers yet</h3>
              <p className="text-white/50 mb-4">Create your first loyalty tier to get started</p>
              <Button onClick={() => setShowNewTierForm(true)} className="gap-2 bg-[#FF3131] hover:bg-[#E02828]">
                <Plus size={18} weight="bold" />
                Add Your First Tier
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => {
              const isExpanded = expandedTier === tier.id
              const isEdited = hasChanges(tier.id)
              const isSaving = saving === tier.id
              const isDeleting = deleting === tier.id
              const perks = getTierPerks(tier)

              return (
                <Card variant="dark" key={tier.id}>
                  {/* Tier Header */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${getTierValue(tier, 'primaryColor')} 0%, ${getTierValue(tier, 'secondaryColor')} 100%)`,
                        }}
                      >
                        <Medal size={20} weight="bold" className="text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-white">{tier.name}</h3>
                          {!tier.isActive && (
                            <span className="px-2 py-0.5 bg-white/10 text-white/50 text-xs font-medium rounded">Inactive</span>
                          )}
                          {tier.isInviteOnly && (
                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-xs font-medium rounded">Invite Only</span>
                          )}
                          {isEdited && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded">Unsaved</span>
                          )}
                        </div>
                        <p className="text-sm text-white/50">
                          {tier._count.customers} members • {tier.pointMultiplier}x points • {tier.minAnnualPoints.toLocaleString()} min points
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <CaretUp size={20} className="text-white/40" />
                      ) : (
                        <CaretDown size={20} className="text-white/40" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <CardContent className="border-t border-white/10 space-y-6 pt-6">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Tier Name</label>
                          <input
                            type="text"
                            value={getTierValue(tier, 'name')}
                            onChange={(e) => handleChange(tier.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Min Annual Points</label>
                          <input
                            type="number"
                            min="0"
                            value={getTierValue(tier, 'minAnnualPoints')}
                            onChange={(e) => handleChange(tier.id, 'minAnnualPoints', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                          />
                          <p className="text-xs text-white/40 mt-1">Points earned per year to qualify</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Points Multiplier</label>
                          <input
                            type="number"
                            min="1"
                            step="0.25"
                            value={getTierValue(tier, 'pointMultiplier')}
                            onChange={(e) => handleChange(tier.id, 'pointMultiplier', parseFloat(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none"
                          />
                          <p className="text-xs text-white/40 mt-1">e.g., 1.5 = 50% bonus points</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Current Members</label>
                          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
                            <Users size={16} className="text-white/60" />
                            <span className="font-medium text-white">{tier._count.customers.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Gradient Start</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={getColorInputValue(getTierValue(tier, 'primaryColor'), '#64748B')}
                              onChange={(e) => handleChange(tier.id, 'primaryColor', e.target.value)}
                              className="h-10 w-12 border border-white/15 bg-transparent p-1"
                            />
                            <input
                              type="text"
                              value={getTierValue(tier, 'primaryColor')}
                              onChange={(e) => handleChange(tier.id, 'primaryColor', e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none uppercase"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/70 mb-2">Gradient End</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={getColorInputValue(getTierValue(tier, 'secondaryColor'), '#475569')}
                              onChange={(e) => handleChange(tier.id, 'secondaryColor', e.target.value)}
                              className="h-10 w-12 border border-white/15 bg-transparent p-1"
                            />
                            <input
                              type="text"
                              value={getTierValue(tier, 'secondaryColor')}
                              onChange={(e) => handleChange(tier.id, 'secondaryColor', e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-[#FF3131]/50 focus:outline-none uppercase"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                        <textarea
                          value={getTierValue(tier, 'description') || ''}
                          onChange={(e) => handleChange(tier.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#FF3131]/50 focus:outline-none"
                          placeholder="Brief description of this tier"
                        />
                      </div>

                      {/* Core Benefits */}
                      <div className="border-t border-white/10 pt-4">
                        <h4 className="font-medium text-white mb-3">Core Benefits</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'freeShipping')}
                              onChange={(e) => handleChange(tier.id, 'freeShipping', e.target.checked)}
                              className="w-4 h-4 accent-[#FF3131]"
                            />
                            <Truck size={20} className="text-white/60" />
                            <div>
                              <span className="text-sm font-medium text-white">Free Shipping</span>
                              <p className="text-xs text-white/40">On all orders</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'earlyDropAccess')}
                              onChange={(e) => handleChange(tier.id, 'earlyDropAccess', e.target.checked)}
                              className="w-4 h-4 accent-[#FF3131]"
                            />
                            <Lightning size={20} className="text-white/60" />
                            <div>
                              <span className="text-sm font-medium text-white">Early Access</span>
                              <p className="text-xs text-white/40">Limited drops</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'isInviteOnly')}
                              onChange={(e) => handleChange(tier.id, 'isInviteOnly', e.target.checked)}
                              className="w-4 h-4 accent-[#FF3131]"
                            />
                            <Star size={20} className="text-white/60" />
                            <div>
                              <span className="text-sm font-medium text-white">Invite Only</span>
                              <p className="text-xs text-white/40">Exclusive tier</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Additional Perks */}
                      <div className="border-t border-white/10 pt-4">
                        <h4 className="font-medium text-white mb-3">Additional Perks</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(Object.keys(PERK_LABELS) as Array<keyof ParsedPerks>).map((perkKey) => (
                            <label 
                              key={perkKey} 
                              className="flex items-center gap-2 cursor-pointer p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
                            >
                              <input
                                type="checkbox"
                                checked={perks[perkKey]}
                                onChange={(e) => handlePerkChange(tier.id, perkKey, e.target.checked)}
                                className="w-4 h-4 accent-[#FF3131]"
                              />
                              <div>
                                <span className="text-sm font-medium text-white">{PERK_LABELS[perkKey].label}</span>
                                <p className="text-xs text-white/40">{PERK_LABELS[perkKey].description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-white/10 pt-4 flex items-center justify-between">
                        <button
                          onClick={() => handleDelete(tier)}
                          disabled={isDeleting || tier._count.customers > 0}
                          className="flex items-center gap-2 px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? (
                            <CircleNotch size={18} weight="bold" className="animate-spin" />
                          ) : (
                            <Trash size={18} weight="bold" />
                          )}
                          Delete Tier
                        </button>
                        
                        {tier._count.customers > 0 && (
                          <p className="text-xs text-white/40 flex items-center gap-1">
                            <Warning size={14} />
                            Can&apos;t delete tier with members
                          </p>
                        )}

                        {isEdited && (
                          <Button
                            onClick={() => handleSave(tier)}
                            disabled={isSaving}
                            className="gap-2 bg-[#FF3131] hover:bg-[#E02828]"
                          >
                            {isSaving ? (
                              <>
                                <CircleNotch size={18} weight="bold" className="animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <FloppyDisk size={18} weight="bold" />
                                Save Changes
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Quick Links */}
        <div className="flex gap-4">
          <Link href="/admin/loyalty/rewards">
            <Button variant="outline" className="gap-2">
              <Gift size={18} />
              Manage Rewards
            </Button>
          </Link>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={tierToDelete ? `Delete tier "${tierToDelete.name}"?` : 'Delete tier?'}
        description={tierToDelete ? `This will permanently delete the "${tierToDelete.name}" tier.` : undefined}
        confirmLabel="Delete Tier"
        loading={!!deleting}
        onConfirm={performDeleteTier}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </AdminLayout>
  )
}
