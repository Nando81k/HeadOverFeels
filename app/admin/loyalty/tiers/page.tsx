'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Medal, 
  Users, 
  CircleNotch, 
  FloppyDisk, 
  Plus, 
  Trash, 
  ArrowLeft,
  CaretDown,
  CaretUp,
  Truck,
  Lightning,
  Gift,
  Star,
  X,
  Warning
} from '@phosphor-icons/react'

interface Tier {
  id: string
  name: string
  slug: string
  description: string | null
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
    minAnnualPoints: 0,
    pointMultiplier: 1.0,
    freeShipping: false,
    earlyDropAccess: false,
    isInviteOnly: false,
    perks: DEFAULT_PERKS,
  })
  const [creatingTier, setCreatingTier] = useState(false)

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
        alert(data.error || 'Failed to update tier')
        return
      }

      setEditedTiers(prev => {
        const next = { ...prev }
        delete next[tier.id]
        return next
      })

      loadTiers()
    } catch (error) {
      console.error('Failed to update tier:', error)
      alert('Failed to update tier')
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (tier: Tier) => {
    if (tier._count.customers > 0) {
      alert(`Cannot delete tier with ${tier._count.customers} customers. Reassign customers first.`)
      return
    }
    
    if (!confirm(`Are you sure you want to delete "${tier.name}" tier?`)) return

    setDeleting(tier.id)
    try {
      const response = await fetch(`/api/admin/loyalty/tiers/${tier.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete tier')
        return
      }

      loadTiers()
    } catch (error) {
      console.error('Failed to delete tier:', error)
      alert('Failed to delete tier')
    } finally {
      setDeleting(null)
    }
  }

  const handleCreateTier = async () => {
    if (!newTier.name || !newTier.slug) {
      alert('Name and slug are required')
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
        alert(data.error || 'Failed to create tier')
        return
      }

      setNewTier({
        name: '',
        slug: '',
        description: '',
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
      alert('Failed to create tier')
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-black/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
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
                <Medal size={24} weight="fill" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-black">Loyalty Tiers</h1>
                <p className="text-black/60">Configure tier requirements and benefits</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowNewTierForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium hover:bg-black/90 transition-colors"
            >
              <Plus size={20} weight="bold" />
              Add Tier
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-black/10 p-4">
            <p className="text-sm text-black/60 mb-1">Total Tiers</p>
            <p className="text-2xl font-bold text-black">{tiers.length}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <p className="text-sm text-black/60 mb-1">Total Members</p>
            <p className="text-2xl font-bold text-black">{totalMembers.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <p className="text-sm text-black/60 mb-1">Active Tiers</p>
            <p className="text-2xl font-bold text-black">{tiers.filter(t => t.isActive).length}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <p className="text-sm text-black/60 mb-1">Avg Multiplier</p>
            <p className="text-2xl font-bold text-black">
              {tiers.length > 0 ? (tiers.reduce((sum, t) => sum + t.pointMultiplier, 0) / tiers.length).toFixed(2) : '0'}x
            </p>
          </div>
        </div>

        {/* New Tier Form Modal */}
        {showNewTierForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="border-b border-black/10 p-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-black">Create New Tier</h2>
                <button
                  onClick={() => setShowNewTierForm(false)}
                  className="p-2 hover:bg-black/5 transition-colors"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Tier Name *</label>
                    <input
                      type="text"
                      value={newTier.name}
                      onChange={(e) => {
                        const name = e.target.value
                        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                        setNewTier(prev => ({ ...prev, name, slug }))
                      }}
                      className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                      placeholder="e.g., Diamond"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Slug *</label>
                    <input
                      type="text"
                      value={newTier.slug}
                      onChange={(e) => setNewTier(prev => ({ ...prev, slug: e.target.value }))}
                      className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                      placeholder="e.g., diamond"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">Description</label>
                  <textarea
                    value={newTier.description}
                    onChange={(e) => setNewTier(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                    placeholder="Brief description of this tier"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Min Annual Points</label>
                    <input
                      type="number"
                      min="0"
                      value={newTier.minAnnualPoints}
                      onChange={(e) => setNewTier(prev => ({ ...prev, minAnnualPoints: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">Points Multiplier</label>
                    <input
                      type="number"
                      min="1"
                      step="0.25"
                      value={newTier.pointMultiplier}
                      onChange={(e) => setNewTier(prev => ({ ...prev, pointMultiplier: parseFloat(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-black/10 pt-4">
                  <h3 className="font-medium text-black mb-3">Core Benefits</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTier.freeShipping}
                        onChange={(e) => setNewTier(prev => ({ ...prev, freeShipping: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <Truck size={18} className="text-black/60" />
                      <span className="text-sm">Free Shipping</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTier.earlyDropAccess}
                        onChange={(e) => setNewTier(prev => ({ ...prev, earlyDropAccess: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <Lightning size={18} className="text-black/60" />
                      <span className="text-sm">Early Drop Access</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTier.isInviteOnly}
                        onChange={(e) => setNewTier(prev => ({ ...prev, isInviteOnly: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <Star size={18} className="text-black/60" />
                      <span className="text-sm">Invite Only</span>
                    </label>
                  </div>
                </div>

                <div className="border-t border-black/10 pt-4">
                  <h3 className="font-medium text-black mb-3">Additional Perks</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PERK_LABELS) as Array<keyof ParsedPerks>).map((perkKey) => (
                      <label key={perkKey} className="flex items-center gap-2 cursor-pointer p-2 border border-black/10 hover:bg-black/5">
                        <input
                          type="checkbox"
                          checked={newTier.perks[perkKey]}
                          onChange={(e) => setNewTier(prev => ({
                            ...prev,
                            perks: { ...prev.perks, [perkKey]: e.target.checked }
                          }))}
                          className="w-4 h-4"
                        />
                        <div>
                          <span className="text-sm font-medium">{PERK_LABELS[perkKey].label}</span>
                          <p className="text-xs text-black/50">{PERK_LABELS[perkKey].description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-black/10 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowNewTierForm(false)}
                  className="px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTier}
                  disabled={creatingTier}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
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
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tiers List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <CircleNotch size={32} weight="bold" className="animate-spin text-black/30" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="text-center py-12 border border-black/10">
            <Medal size={48} className="mx-auto text-black/20 mb-4" />
            <h3 className="text-lg font-medium text-black mb-2">No tiers yet</h3>
            <p className="text-black/60 mb-4">Create your first loyalty tier to get started</p>
            <button
              onClick={() => setShowNewTierForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-medium"
            >
              <Plus size={18} weight="bold" />
              Add Your First Tier
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => {
              const isExpanded = expandedTier === tier.id
              const isEdited = hasChanges(tier.id)
              const isSaving = saving === tier.id
              const isDeleting = deleting === tier.id
              const perks = getTierPerks(tier)

              return (
                <div key={tier.id} className="border border-black/10 bg-white">
                  {/* Tier Header */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-black/5"
                    onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-black/5 flex items-center justify-center">
                        <Medal size={20} weight="bold" className="text-black" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-black">{tier.name}</h3>
                          {!tier.isActive && (
                            <span className="px-2 py-0.5 bg-black/10 text-black/60 text-xs font-medium">Inactive</span>
                          )}
                          {tier.isInviteOnly && (
                            <span className="px-2 py-0.5 bg-black text-white text-xs font-medium">Invite Only</span>
                          )}
                          {isEdited && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium">Unsaved</span>
                          )}
                        </div>
                        <p className="text-sm text-black/60">
                          {tier._count.customers} members • {tier.pointMultiplier}x points • {tier.minAnnualPoints.toLocaleString()} min points
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <CaretUp size={20} className="text-black/40" />
                      ) : (
                        <CaretDown size={20} className="text-black/40" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-black/10 p-6 space-y-6">
                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-black mb-2">Tier Name</label>
                          <input
                            type="text"
                            value={getTierValue(tier, 'name')}
                            onChange={(e) => handleChange(tier.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-black mb-2">Min Annual Points</label>
                          <input
                            type="number"
                            min="0"
                            value={getTierValue(tier, 'minAnnualPoints')}
                            onChange={(e) => handleChange(tier.id, 'minAnnualPoints', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                          />
                          <p className="text-xs text-black/50 mt-1">Points earned per year to qualify</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-black mb-2">Points Multiplier</label>
                          <input
                            type="number"
                            min="1"
                            step="0.25"
                            value={getTierValue(tier, 'pointMultiplier')}
                            onChange={(e) => handleChange(tier.id, 'pointMultiplier', parseFloat(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                          />
                          <p className="text-xs text-black/50 mt-1">e.g., 1.5 = 50% bonus points</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-black mb-2">Current Members</label>
                          <div className="flex items-center gap-2 px-3 py-2 border border-black/10 bg-black/5">
                            <Users size={16} className="text-black/60" />
                            <span className="font-medium">{tier._count.customers.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">Description</label>
                        <textarea
                          value={getTierValue(tier, 'description') || ''}
                          onChange={(e) => handleChange(tier.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-black/10 focus:border-black focus:outline-none"
                          placeholder="Brief description of this tier"
                        />
                      </div>

                      {/* Core Benefits */}
                      <div className="border-t border-black/10 pt-4">
                        <h4 className="font-medium text-black mb-3">Core Benefits</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <label className="flex items-center gap-3 cursor-pointer p-3 border border-black/10 hover:bg-black/5">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'freeShipping')}
                              onChange={(e) => handleChange(tier.id, 'freeShipping', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <Truck size={20} className="text-black/60" />
                            <div>
                              <span className="text-sm font-medium">Free Shipping</span>
                              <p className="text-xs text-black/50">On all orders</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 border border-black/10 hover:bg-black/5">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'earlyDropAccess')}
                              onChange={(e) => handleChange(tier.id, 'earlyDropAccess', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <Lightning size={20} className="text-black/60" />
                            <div>
                              <span className="text-sm font-medium">Early Access</span>
                              <p className="text-xs text-black/50">Limited drops</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer p-3 border border-black/10 hover:bg-black/5">
                            <input
                              type="checkbox"
                              checked={getTierValue(tier, 'isInviteOnly')}
                              onChange={(e) => handleChange(tier.id, 'isInviteOnly', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <Star size={20} className="text-black/60" />
                            <div>
                              <span className="text-sm font-medium">Invite Only</span>
                              <p className="text-xs text-black/50">Exclusive tier</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Additional Perks */}
                      <div className="border-t border-black/10 pt-4">
                        <h4 className="font-medium text-black mb-3">Additional Perks</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(Object.keys(PERK_LABELS) as Array<keyof ParsedPerks>).map((perkKey) => (
                            <label 
                              key={perkKey} 
                              className="flex items-center gap-2 cursor-pointer p-2 border border-black/10 hover:bg-black/5"
                            >
                              <input
                                type="checkbox"
                                checked={perks[perkKey]}
                                onChange={(e) => handlePerkChange(tier.id, perkKey, e.target.checked)}
                                className="w-4 h-4"
                              />
                              <div>
                                <span className="text-sm font-medium">{PERK_LABELS[perkKey].label}</span>
                                <p className="text-xs text-black/50">{PERK_LABELS[perkKey].description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-black/10 pt-4 flex items-center justify-between">
                        <button
                          onClick={() => handleDelete(tier)}
                          disabled={isDeleting || tier._count.customers > 0}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? (
                            <CircleNotch size={18} weight="bold" className="animate-spin" />
                          ) : (
                            <Trash size={18} weight="bold" />
                          )}
                          Delete Tier
                        </button>
                        
                        {tier._count.customers > 0 && (
                          <p className="text-xs text-black/50 flex items-center gap-1">
                            <Warning size={14} />
                            Can&apos;t delete tier with members
                          </p>
                        )}

                        {isEdited && (
                          <button
                            onClick={() => handleSave(tier)}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
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
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 flex gap-4">
          <Link 
            href="/admin/loyalty/rewards"
            className="flex items-center gap-2 px-4 py-2 border border-black/10 font-medium hover:bg-black/5 transition-colors"
          >
            <Gift size={18} />
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
