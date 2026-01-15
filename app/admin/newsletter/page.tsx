'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  EnvelopeSimple, 
  Users, 
  TrendUp, 
  Export, 
  MagnifyingGlass,
  Funnel,
  Check,
  X,
  CircleNotch,
  ArrowLeft,
  User,
  Calendar,
  Link as LinkIcon
} from '@phosphor-icons/react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Subscriber {
  id: string
  email: string
  name: string | null
  source: string | null
  sourceDetails?: string | null
  isActive: boolean
  isVerified?: boolean
  isCustomer: boolean
  createdAt: string
  unsubscribedAt?: string | null
  unsubscribeReason?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
}

interface Stats {
  activeSubscribers: number
  unsubscribed: number
  newLast30Days: number
  customerSubscribers: number
  totalActive: number
  bySource: Record<string, number>
}

interface Pagination {
  page: number
  limit: number
  totalSubscribers: number
  totalCustomerSubscribers: number
  totalPages: number
}

export default function NewsletterAdminPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchSubscribers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        status: statusFilter,
        source: sourceFilter,
        includeCustomers: 'true',
      })
      
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/newsletter?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSubscribers(data.subscribers)
        setStats(data.stats)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch subscribers:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, sourceFilter, search])

  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', format }),
      })

      if (res.ok) {
        if (format === 'csv') {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          const data = await res.json()
          const blob = new Blob([JSON.stringify(data.subscribers, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.json`
          a.click()
          URL.revokeObjectURL(url)
        }
      }
    } catch (error) {
      console.error('Failed to export:', error)
    } finally {
      setExporting(false)
    }
  }

  const sources = stats?.bySource ? Object.keys(stats.bySource) : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link 
            href="/admin" 
            className="p-2 hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={20} weight="bold" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-black">Newsletter Subscribers</h1>
            <p className="text-sm text-black/50">
              Manage your email subscriber list
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold hover:bg-black/80 disabled:opacity-50"
          >
            {exporting ? (
              <CircleNotch size={16} className="animate-spin" />
            ) : (
              <Export size={16} weight="bold" />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-black/10 p-4">
            <div className="flex items-center gap-2 text-black/50 mb-2">
              <Users size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Total Active</span>
            </div>
            <p className="text-3xl font-black text-black">{stats.totalActive.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="flex items-center gap-2 text-black/50 mb-2">
              <User size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Customers</span>
            </div>
            <p className="text-3xl font-black text-black">{stats.customerSubscribers.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="flex items-center gap-2 text-black/50 mb-2">
              <EnvelopeSimple size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Non-Customers</span>
            </div>
            <p className="text-3xl font-black text-black">{stats.activeSubscribers.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-black/10 p-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <TrendUp size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">New (30d)</span>
            </div>
            <p className="text-3xl font-black text-green-600">+{stats.newLast30Days.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={18} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by email..."
            className="w-full pl-10 pr-4 py-2 border border-black/10 text-sm focus:outline-none focus:border-black"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Funnel size={18} weight="bold" className="text-black/30" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'active' | 'unsubscribed')
              setPage(1)
            }}
            className="px-3 py-2 border border-black/10 text-sm focus:outline-none focus:border-black bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>

        {sources.length > 0 && (
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 border border-black/10 text-sm focus:outline-none focus:border-black bg-white"
          >
            <option value="all">All Sources</option>
            {sources.map(source => (
              <option key={source} value={source}>
                {source} ({stats?.bySource[source]})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-black/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <CircleNotch size={32} className="animate-spin text-black/30 mx-auto" />
            <p className="mt-2 text-sm text-black/50">Loading subscribers...</p>
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-12 text-center">
            <EnvelopeSimple size={48} weight="thin" className="text-black/20 mx-auto mb-4" />
            <p className="text-black/50">No subscribers found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-black/5 border-b border-black/10">
                  <tr>
                    <th className="text-left text-xs font-bold uppercase text-black/50 px-4 py-3">Email</th>
                    <th className="text-left text-xs font-bold uppercase text-black/50 px-4 py-3">Type</th>
                    <th className="text-left text-xs font-bold uppercase text-black/50 px-4 py-3">Source</th>
                    <th className="text-left text-xs font-bold uppercase text-black/50 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-bold uppercase text-black/50 px-4 py-3">Subscribed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {subscribers.map((subscriber) => (
                    <motion.tr
                      key={subscriber.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-black/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-black">{subscriber.email}</p>
                          {subscriber.name && (
                            <p className="text-xs text-black/50">{subscriber.name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold ${
                          subscriber.isCustomer 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {subscriber.isCustomer ? (
                            <>
                              <User size={12} weight="bold" />
                              Customer
                            </>
                          ) : (
                            <>
                              <EnvelopeSimple size={12} weight="bold" />
                              Subscriber
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-black/50">
                          <LinkIcon size={12} />
                          {subscriber.source || 'Unknown'}
                        </div>
                        {subscriber.utmCampaign && (
                          <p className="text-[10px] text-black/30 mt-0.5">
                            Campaign: {subscriber.utmCampaign}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {subscriber.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                            <Check size={14} weight="bold" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                            <X size={14} weight="bold" />
                            Unsubscribed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs text-black/50">
                          <Calendar size={12} />
                          {new Date(subscriber.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-black/10">
                <p className="text-sm text-black/50">
                  Showing {(pagination.page - 1) * pagination.limit + 1} -{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.totalSubscribers + pagination.totalCustomerSubscribers)} of{' '}
                  {pagination.totalSubscribers + pagination.totalCustomerSubscribers}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm font-bold disabled:opacity-30 hover:bg-black/5"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                    className="px-3 py-1 text-sm font-bold disabled:opacity-30 hover:bg-black/5"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Source Breakdown */}
      {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
        <div className="mt-8 bg-white border border-black/10 p-6">
          <h3 className="font-bold text-black mb-4">Subscribers by Source</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.bySource).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between p-3 bg-black/[0.02]">
                <span className="text-sm capitalize">{source.replace('_', ' ')}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
