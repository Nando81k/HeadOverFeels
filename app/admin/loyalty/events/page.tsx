'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Plus, MagnifyingGlass, CircleNotch, Lightning, X, PencilSimple, Trash, Funnel } from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { LoyaltyNav } from '@/components/admin/LoyaltyNav'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PointsEvent {
  id: string
  name: string
  slug: string
  description: string | null
  pointsAmount: number
  eventType: string
  isActive: boolean
  multiplier: number | null
  conditions: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

const eventTypes = [
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'SIGNUP', label: 'Sign Up' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'BIRTHDAY', label: 'Birthday' },
  { value: 'CUSTOM', label: 'Custom' },
]

export default function PointsEventsPage() {
  const [events, setEvents] = useState<PointsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PointsEvent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    pointsAmount: 0,
    eventType: 'PURCHASE',
    isActive: true,
    multiplier: '',
    conditions: '',
    startsAt: '',
    endsAt: '',
  })

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      })
      
      const response = await fetch(`/api/admin/loyalty/events?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Ensure we always set an array
        const eventsArray = Array.isArray(data) ? data : (Array.isArray(data.events) ? data.events : [])
        setEvents(eventsArray)
      }
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      pointsAmount: 0,
      eventType: 'PURCHASE',
      isActive: true,
      multiplier: '',
      conditions: '',
      startsAt: '',
      endsAt: '',
    })
    setEditingEvent(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (event: PointsEvent) => {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      slug: event.slug,
      description: event.description || '',
      pointsAmount: event.pointsAmount,
      eventType: event.eventType,
      isActive: event.isActive,
      multiplier: event.multiplier?.toString() || '',
      conditions: event.conditions || '',
      startsAt: event.startsAt ? new Date(event.startsAt).toISOString().slice(0, 16) : '',
      endsAt: event.endsAt ? new Date(event.endsAt).toISOString().slice(0, 16) : '',
    })
    setShowModal(true)
  }

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (field === 'name' && typeof value === 'string') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const data = {
        ...formData,
        multiplier: formData.multiplier ? parseFloat(formData.multiplier) : null,
        conditions: formData.conditions || null,
        startsAt: formData.startsAt || null,
        endsAt: formData.endsAt || null,
      }

      const url = editingEvent 
        ? `/api/admin/loyalty/events/${editingEvent.id}`
        : '/api/admin/loyalty/events'
      
      const method = editingEvent ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        setShowModal(false)
        resetForm()
        loadEvents()
      }
    } catch (err) {
      console.error('Failed to save event:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (event: PointsEvent) => {
    if (!confirm(`Delete "${event.name}"? This cannot be undone.`)) return

    try {
      const response = await fetch(`/api/admin/loyalty/events/${event.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        loadEvents()
      }
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getEventStatus = (event: PointsEvent) => {
    if (!event.isActive) return { label: 'Inactive', class: 'bg-white/10 text-white/50 border-white/20' }
    
    const now = new Date()
    if (event.startsAt && new Date(event.startsAt) > now) {
      return { label: 'Scheduled', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    }
    if (event.endsAt && new Date(event.endsAt) < now) {
      return { label: 'Expired', class: 'bg-white/10 text-white/50 border-white/20' }
    }
    return { label: 'Active', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
  }

  return (
    <AdminLayout
      title="Points Events"
      subtitle="Configure how customers earn loyalty points"
      headerActions={
        <Button onClick={openCreateModal} className="bg-[#FF3131] hover:bg-[#E02828] gap-2">
          <Plus size={16} weight="bold" />
          Add Event
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <LoyaltyNav />
        
        {/* Filters */}
        <Card variant="dark">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlass size={18} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Funnel size={18} weight="bold" className="text-white/40" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
                  className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="" className="bg-neutral-900">All Status</option>
                  <option value="active" className="bg-neutral-900">Active</option>
                  <option value="inactive" className="bg-neutral-900">Inactive</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Events Grid */}
        <Card variant="dark">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightning size={20} weight="bold" />
              Events
            </CardTitle>
            <CardDescription>Rules for earning points in the loyalty program</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <CircleNotch size={32} weight="bold" className="animate-spin text-white/30" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Calendar size={48} weight="light" className="mx-auto mb-4 opacity-50" />
                <p>No points events configured</p>
                <Button onClick={openCreateModal} className="mt-4 bg-[#FF3131] hover:bg-[#E02828]">
                  Create First Event
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {events.map(event => {
                  const status = getEventStatus(event)
                  return (
                    <div 
                      key={event.id}
                      className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-white">{event.name}</h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${status.class}`}>
                              {status.label}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-white/50 mb-2">{event.description}</p>
                          )}
                          <div className="flex flex-wrap gap-4 text-sm">
                            <span className="text-white/70">
                              <span className="text-white font-medium">+{event.pointsAmount}</span> points
                            </span>
                            <span className="text-white/50">Type: {event.eventType}</span>
                            {event.multiplier && (
                              <span className="text-amber-400">{event.multiplier}x multiplier</span>
                            )}
                            {(event.startsAt || event.endsAt) && (
                              <span className="text-white/50">
                                {formatDate(event.startsAt)} → {formatDate(event.endsAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(event)}>
                            <PencilSimple size={16} weight="bold" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDelete(event)}
                            className="text-red-400 hover:text-red-300 hover:border-red-500/50"
                          >
                            <Trash size={16} weight="bold" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-neutral-900 rounded-xl border border-white/10 p-6 w-full max-w-lg my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Event Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="e.g., Purchase Points"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="Brief description of the event"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Points Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.pointsAmount}
                    onChange={(e) => handleInputChange('pointsAmount', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Event Type *</label>
                  <select
                    required
                    value={formData.eventType}
                    onChange={(e) => handleInputChange('eventType', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                  >
                    {eventTypes.map(type => (
                      <option key={type.value} value={type.value} className="bg-neutral-900">{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Multiplier (optional)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.multiplier}
                  onChange={(e) => handleInputChange('multiplier', e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
                  placeholder="e.g., 2 for double points"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Starts At</label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => handleInputChange('startsAt', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">Ends At</label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => handleInputChange('endsAt', e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">Conditions (JSON)</label>
                <textarea
                  value={formData.conditions}
                  onChange={(e) => handleInputChange('conditions', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none font-mono text-sm"
                  placeholder='{"minPurchase": 50}'
                />
              </div>

              <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="font-medium text-white">Active</span>
                  <p className="text-sm text-white/50">Event will be used for point calculations</p>
                </div>
              </label>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#FF3131] hover:bg-[#E02828] flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <CircleNotch size={18} className="animate-spin mr-2" />
                      Saving...
                    </>
                  ) : editingEvent ? 'Update Event' : 'Create Event'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
