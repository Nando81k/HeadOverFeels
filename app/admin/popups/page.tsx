'use client'

import { useState, useEffect, FormEvent } from 'react'
import Link from 'next/link'
import { 
  Plus, 
  MagnifyingGlass, 
  Eye,
  ChartLine,
  Trash,
  PencilSimple,
  ToggleRight,
  ToggleLeft,
  Timer,
  Scroll,
  SignOut,
  Lightning,
  Funnel,
  X
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsGridSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/lib/toast'

type PopupTemplate = 'MODAL' | 'BANNER' | 'SLIDE_IN' | 'FULL_SCREEN' | 'EMAIL_CAPTURE'
type TriggerType = 'DELAY' | 'SCROLL' | 'EXIT_INTENT' | 'IMMEDIATE'

interface PopupVariant {
  id: string
  name: string
  weight: number
  impressions: number
  clicks: number
  conversions: number
}

interface MarketingPopup {
  id: string
  name: string
  template: PopupTemplate
  triggerType: TriggerType
  triggerValue: number
  isActive: boolean
  priority: number
  startDate: string | null
  endDate: string | null
  variants?: PopupVariant[]
  stats?: {
    impressions: number
    clicks: number
    dismissals: number
    conversions: number
    ctr: string
  }
  _count: {
    analytics: number
  }
}

const templateConfig: Record<PopupTemplate, { label: string; icon: string }> = {
  MODAL: { label: 'Modal', icon: '◻️' },
  BANNER: { label: 'Banner', icon: '📢' },
  SLIDE_IN: { label: 'Slide-In', icon: '↗️' },
  FULL_SCREEN: { label: 'Full Screen', icon: '🖥️' },
  EMAIL_CAPTURE: { label: 'Email Capture', icon: '📧' }
}

const triggerConfig: Record<TriggerType, { label: string; icon: typeof Timer }> = {
  DELAY: { label: 'Time Delay', icon: Timer },
  SCROLL: { label: 'Scroll Depth', icon: Scroll },
  EXIT_INTENT: { label: 'Exit Intent', icon: SignOut },
  IMMEDIATE: { label: 'Immediate', icon: Lightning }
}

export default function PopupsPage() {
  const [popups, setPopups] = useState<MarketingPopup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('')
  const [filterTemplate, setFilterTemplate] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  
  useEffect(() => {
    fetchPopups()
  }, [])
  
  const fetchPopups = async () => {
    try {
      const res = await fetch('/api/popups')
      const data = await res.json()
      setPopups(data.data || [])
    } catch (error) {
      console.error('Failed to fetch popups:', error)
      toast.error('Failed to load popups')
    } finally {
      setLoading(false)
    }
  }
  
  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      await fetch(`/api/popups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState })
      })
      setPopups(prev => 
        prev.map(p => p.id === id ? { ...p, isActive: !currentState } : p)
      )
      toast.success(`Popup ${!currentState ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Failed to toggle popup:', error)
      toast.error('Failed to update popup')
    }
  }
  
  const deletePopup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this popup?')) return
    
    try {
      await fetch(`/api/popups/${id}`, { method: 'DELETE' })
      setPopups(prev => prev.filter(p => p.id !== id))
      toast.success('Popup deleted')
    } catch (error) {
      console.error('Failed to delete popup:', error)
      toast.error('Failed to delete popup')
    }
  }
  
  const getStatus = (popup: MarketingPopup): { label: string; color: string } => {
    const now = new Date()
    const start = popup.startDate ? new Date(popup.startDate) : null
    const end = popup.endDate ? new Date(popup.endDate) : null
    
    if (!popup.isActive) return { label: 'Inactive', color: 'bg-white/10 text-white/50' }
    if (start && now < start) return { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' }
    if (end && now > end) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' }
    return { label: 'Active', color: 'bg-emerald-500/20 text-emerald-400' }
  }
  
  const calculateStats = (popup: MarketingPopup) => {
    // Use popup-level stats from API
    const totals = {
      impressions: popup.stats?.impressions || 0,
      clicks: popup.stats?.clicks || 0,
      conversions: popup.stats?.conversions || 0
    }
    
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(1) : '0'
    const cvr = totals.clicks > 0 ? (totals.conversions / totals.clicks * 100).toFixed(1) : '0'
    
    return { ...totals, ctr, cvr }
  }
  
  // Search submit handler
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAppliedSearchQuery(searchQuery)
  }
  
  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('')
    setAppliedSearchQuery('')
    setFilterTemplate('all')
    setFilterStatus('all')
  }
  
  // Filter popups
  const filtered = popups.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(appliedSearchQuery.toLowerCase())
    const matchesTemplate = filterTemplate === 'all' || p.template === filterTemplate
    const status = getStatus(p)
    const matchesStatus = filterStatus === 'all' || status.label.toLowerCase() === filterStatus.toLowerCase()
    return matchesSearch && matchesTemplate && matchesStatus
  })
  
  // Overall stats - use popup-level stats from API
  const totalImpressions = popups.reduce((sum, p) => 
    sum + (p.stats?.impressions || 0), 0
  )
  const totalClicks = popups.reduce((sum, p) => 
    sum + (p.stats?.clicks || 0), 0
  )
  const activeCount = popups.filter(p => getStatus(p).label === 'Active').length
  const hasActiveFilters = appliedSearchQuery || filterTemplate !== 'all' || filterStatus !== 'all'
  
  return (
    <AdminLayout
      title="Marketing Popups"
      subtitle="Create and manage popups, banners, and announcements"
      headerActions={
        <Link href="/admin/popups/new">
          <Button className="bg-[#FF3131] hover:bg-[#E02828]">
            <Plus size={16} weight="bold" className="mr-2" />
            Create Popup
          </Button>
        </Link>
      }
    >
      {/* Stats Grid */}
      {loading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <Card>
            <CardHeader className="pb-1 md:pb-2 pt-3 md:pt-4 px-3 md:px-4">
              <CardTitle className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40 flex items-center gap-1">
                <Eye size={12} />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
              <div className="text-lg md:text-2xl font-bold text-white">{popups.length}</div>
              <p className="text-[10px] md:text-xs text-white/40">Popups</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-1 md:pb-2 pt-3 md:pt-4 px-3 md:px-4">
              <CardTitle className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40">Active</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
              <div className="text-lg md:text-2xl font-bold text-emerald-400">{activeCount}</div>
              <p className="text-[10px] md:text-xs text-white/40">Running</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-1 md:pb-2 pt-3 md:pt-4 px-3 md:px-4">
              <CardTitle className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40">Impressions</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
              <div className="text-lg md:text-2xl font-bold text-white">{totalImpressions.toLocaleString()}</div>
              <p className="text-[10px] md:text-xs text-white/40">Total views</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-1 md:pb-2 pt-3 md:pt-4 px-3 md:px-4">
              <CardTitle className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40">Clicks</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 md:pb-4">
              <div className="text-lg md:text-2xl font-bold text-blue-400">{totalClicks.toLocaleString()}</div>
              <p className="text-[10px] md:text-xs text-white/40">Total clicks</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/50"
                />
              </div>
            </form>
            
            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`border-white/10 ${showFilters ? 'bg-white/10' : ''}`}
            >
              <Funnel size={16} className="mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 bg-[#FF3131] text-white text-xs px-1.5 py-0.5 rounded">
                  {[appliedSearchQuery, filterTemplate !== 'all', filterStatus !== 'all'].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>
          
          {/* Filter Options */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-4 pt-4 mt-4 border-t border-white/10">
                  <div className="flex-1 md:min-w-[150px]">
                    <label className="block text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40 mb-1.5 md:mb-2">Template</label>
                    <select
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50"
                    >
                      <option value="all">All Templates</option>
                      <option value="MODAL">Modal</option>
                      <option value="BANNER">Banner</option>
                      <option value="SLIDE_IN">Slide-In</option>
                      <option value="FULL_SCREEN">Full Screen</option>
                      <option value="EMAIL_CAPTURE">Email Capture</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 md:min-w-[150px]">
                    <label className="block text-[9px] md:text-[10px] font-medium uppercase tracking-[0.1em] md:tracking-[0.15em] text-white/40 mb-1.5 md:mb-2">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm md:text-base text-white focus:outline-none focus:border-[#FF3131]/50"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                  
                  {hasActiveFilters && (
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="text-white/50 hover:text-white"
                      >
                        <X size={16} className="mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Popups Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-6 bg-white/10 rounded w-1/2 mb-3" />
                <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-12 bg-white/5 rounded" />
                  ))}
                </div>
              <div className="h-10 bg-white/5 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="No popups found"
          description={hasActiveFilters ? "Try adjusting your search or filters" : "Create your first popup to get started"}
          action={
            !hasActiveFilters ? { label: "Create Popup", href: "/admin/popups/new" } : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map((popup) => {
              const status = getStatus(popup)
              const stats = calculateStats(popup)
              const TriggerIcon = triggerConfig[popup.triggerType].icon
              
              return (
                <motion.div
                  key={popup.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="hover:border-white/20 transition-colors">
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white">{popup.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-white/50">
                              {templateConfig[popup.template].icon} {templateConfig[popup.template].label}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleActive(popup.id, popup.isActive)}
                          className="p-1"
                        >
                          {popup.isActive ? (
                            <ToggleRight size={28} weight="fill" className="text-emerald-400" />
                          ) : (
                            <ToggleLeft size={28} className="text-white/30" />
                          )}
                        </button>
                      </div>
                      
                      {/* Trigger Info */}
                      <div className="flex items-center gap-2 text-sm text-white/50 mb-3">
                        <TriggerIcon size={16} />
                        <span>{triggerConfig[popup.triggerType].label}</span>
                        {popup.triggerType === 'DELAY' && (
                          <span className="text-white/30">({popup.triggerValue}s)</span>
                        )}
                        {popup.triggerType === 'SCROLL' && (
                          <span className="text-white/30">({popup.triggerValue}%)</span>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        <div className="bg-white/5 rounded p-2 text-center">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40">Views</p>
                          <p className="text-sm md:text-base font-semibold text-white">{stats.impressions.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded p-2 text-center">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40">Clicks</p>
                          <p className="text-sm md:text-base font-semibold text-white">{stats.clicks.toLocaleString()}</p>
                        </div>
                        <div className="bg-white/5 rounded p-2 text-center">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40">CTR</p>
                          <p className="text-sm md:text-base font-semibold text-blue-400">{stats.ctr}%</p>
                        </div>
                        <div className="bg-white/5 rounded p-2 text-center">
                          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40">Conv.</p>
                          <p className="text-sm md:text-base font-semibold text-emerald-400">{stats.cvr}%</p>
                        </div>
                      </div>
                      
                      {/* Variants */}
                      {popup.variants && popup.variants.length > 1 && (
                        <div className="mb-3">
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">A/B Variants ({popup.variants.length})</p>
                          <div className="flex gap-1 rounded overflow-hidden">
                            {popup.variants.map((v, i) => (
                              <div
                                key={v.id}
                                className="flex-1 h-2"
                                style={{
                                  backgroundColor: i === 0 ? '#FF3131' : i === 1 ? '#3B82F6' : '#10B981'
                                }}
                                title={`${v.name}: ${v.weight}%`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                        <Link
                          href={`/admin/popups/${popup.id}`}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
                        >
                          <PencilSimple size={16} />
                          Edit
                        </Link>
                        <Link
                          href={`/admin/popups/${popup.id}/analytics`}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
                        >
                          <ChartLine size={16} />
                          Analytics
                        </Link>
                        <button
                          onClick={() => deletePopup(popup.id)}
                          className="p-2 text-white/40 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      {/* Mobile Floating Add Button */}
      <Link
        href="/admin/popups/new"
        className="sm:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-[#FF3131] hover:bg-[#E02828] text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="Create Popup"
      >
        <Plus size={24} weight="bold" />
      </Link>    </AdminLayout>
  )
}
