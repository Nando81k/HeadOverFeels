'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Clock,
  Zap,
  Target,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface MultiplierEvent {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  multiplier: number
  tierIds: string | null
  categoryIds: string | null
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
  computedStatus: 'active' | 'upcoming' | 'past' | 'inactive'
  createdAt: string
}

interface LoyaltyTier {
  id: string
  name: string
  slug: string
}

export default function PointsEventsPage() {
  const [events, setEvents] = useState<MultiplierEvent[]>([])
  const [tiers, setTiers] = useState<LoyaltyTier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<MultiplierEvent | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    multiplier: 2.0,
    tierIds: [] as string[],
    isActive: true,
  })

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/loyalty/events?status=${statusFilter}`)
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setEvents(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  const fetchTiers = async () => {
    try {
      const response = await fetch('/api/admin/loyalty/tiers')
      const data = await response.json()
      if (data.data) {
        setTiers(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch tiers:', err)
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchTiers()
  }, [fetchEvents])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      multiplier: 2.0,
      tierIds: [],
      isActive: true,
    })
  }

  const openCreateModal = () => {
    resetForm()
    setEditingEvent(null)
    setIsCreateModalOpen(true)
  }

  const openEditModal = (event: MultiplierEvent) => {
    setEditingEvent(event)
    setFormData({
      name: event.name,
      description: event.description || '',
      startDate: event.startDate.slice(0, 16), // Format for datetime-local
      endDate: event.endDate.slice(0, 16),
      multiplier: event.multiplier,
      tierIds: event.tierIds ? JSON.parse(event.tierIds) : [],
      isActive: event.isActive,
    })
    setIsCreateModalOpen(true)
  }

  const closeModal = () => {
    setIsCreateModalOpen(false)
    setEditingEvent(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        multiplier: formData.multiplier,
        tierIds: formData.tierIds.length > 0 ? formData.tierIds : null,
        isActive: formData.isActive,
      }

      const url = editingEvent
        ? `/api/admin/loyalty/events/${editingEvent.id}`
        : '/api/admin/loyalty/events'
      
      const response = await fetch(url, {
        method: editingEvent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      await fetchEvents()
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/loyalty/events/${eventId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      await fetchEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event')
    }
  }

  const toggleActive = async (event: MultiplierEvent) => {
    try {
      const response = await fetch(`/api/admin/loyalty/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !event.isActive }),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      await fetchEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Zap className="w-3 h-3" />
            Active
          </span>
        )
      case 'upcoming':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            Upcoming
          </span>
        )
      case 'past':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <Check className="w-3 h-3" />
            Ended
          </span>
        )
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <X className="w-3 h-3" />
            Inactive
          </span>
        )
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getMultiplierDisplay = (multiplier: number) => {
    if (multiplier === 2) return '2x Double Points'
    if (multiplier === 3) return '3x Triple Points'
    return `${multiplier}x Points`
  }

  // Stats calculations
  const activeEvents = events.filter(e => e.computedStatus === 'active').length
  const upcomingEvents = events.filter(e => e.computedStatus === 'upcoming').length
  const totalBonusPoints = events.reduce((sum, e) => sum + e.totalBonusPointsAwarded, 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Points Multiplier Events</h1>
          <p className="text-gray-600">Create Double Points weekends and special bonus events</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/loyalty"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Loyalty
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Now</p>
              <p className="text-xl font-bold text-gray-900">{activeEvents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-xl font-bold text-gray-900">{upcomingEvents}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Bonus Points Awarded</p>
              <p className="text-xl font-bold text-gray-900">{totalBonusPoints.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Target className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-xl font-bold text-gray-900">{events.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'active', 'upcoming', 'past'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-pink-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-pink-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No events found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-pink-600 hover:text-pink-700 font-medium"
            >
              Create your first event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {events.map((event) => (
              <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{event.name}</h3>
                      {getStatusBadge(event.computedStatus)}
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                        <TrendingUp className="w-3 h-3" />
                        {getMultiplierDisplay(event.multiplier)}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </span>
                      {event.ordersAffected > 0 && (
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {event.ordersAffected} orders · {event.totalBonusPointsAwarded.toLocaleString()} bonus pts
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(event)}
                      className={`p-2 rounded-lg transition-colors ${
                        event.isActive
                          ? 'bg-green-100 text-green-600 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={event.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {event.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(event)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingEvent ? 'Edit Event' : 'Create Points Event'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="e.g., Double Points Weekend"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="Optional marketing description"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Points Multiplier: {formData.multiplier}x
                  </label>
                  <input
                    type="range"
                    min="1.1"
                    max="5"
                    step="0.1"
                    value={formData.multiplier}
                    onChange={(e) => setFormData({ ...formData, multiplier: parseFloat(e.target.value) })}
                    className="w-full accent-pink-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1.1x (10% bonus)</span>
                    <span>2x (Double)</span>
                    <span>5x (5x Points)</span>
                  </div>
                </div>

                {tiers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Eligible Tiers (leave empty for all)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tiers.map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => {
                            const newTierIds = formData.tierIds.includes(tier.id)
                              ? formData.tierIds.filter(id => id !== tier.id)
                              : [...formData.tierIds, tier.id]
                            setFormData({ ...formData, tierIds: newTierIds })
                          }}
                          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                            formData.tierIds.includes(tier.id)
                              ? 'bg-pink-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tier.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Event is active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
