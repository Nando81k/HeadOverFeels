'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  CircleNotch,
  EnvelopeSimple,
  Export,
  Funnel,
  Link as LinkIcon,
  MagnifyingGlass,
  PaperPlaneRight,
  PencilSimple,
  Plus,
  TrendUp,
  User,
  Users,
  X,
} from '@phosphor-icons/react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import type { NewsletterAudienceFilter } from '@/lib/newsletter/types'

type AdminNewsletterTab = 'subscribers' | 'campaigns'

type CampaignStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED'

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

interface CampaignSummary {
  id: string
  name: string | null
  subject: string
  status: CampaignStatus
  audienceCount: number
  sentCount: number
  failedCount: number
  sentAt: string | null
  createdAt: string
  updatedAt: string
  audienceFilter: NewsletterAudienceFilter
  createdByAdmin: {
    id: string
    name: string | null
    email: string
  }
}

interface CampaignDelivery {
  id: string
  email: string
  status: 'SENT' | 'FAILED'
  providerMessageId: string | null
  errorMessage: string | null
  sentAt: string | null
  isTest: boolean
  createdAt: string
}

interface CampaignDetail {
  id: string
  name: string | null
  subject: string
  preheader: string | null
  heroImageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  bodyMarkdown: string
  status: CampaignStatus
  audienceFilter: NewsletterAudienceFilter
  audienceCount: number
  sentCount: number
  failedCount: number
  sentAt: string | null
  createdAt: string
  updatedAt: string
  createdByAdmin: {
    id: string
    name: string | null
    email: string
  }
  deliveries: CampaignDelivery[]
}

interface Stats {
  activeSubscribers: number
  unsubscribed: number
  newLast30Days: number
  customerSubscribers: number
  totalActive: number
  bySource: Record<string, number>
  campaigns?: {
    total: number
    draft: number
    queued: number
    sent: number
    failed: number
  }
}

interface Pagination {
  page: number
  limit: number
  totalSubscribers: number
  totalPages: number
}

interface CampaignPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface CampaignFormState {
  name: string
  subject: string
  preheader: string
  heroImageUrl: string
  ctaLabel: string
  ctaUrl: string
  bodyMarkdown: string
  audienceFilter: NewsletterAudienceFilter
}

const DEFAULT_AUDIENCE_FILTER: NewsletterAudienceFilter = {
  activeOnly: true,
  source: null,
  signupDateFrom: null,
  signupDateTo: null,
  customerMode: 'all',
}

const DEFAULT_CAMPAIGN_FORM: CampaignFormState = {
  name: '',
  subject: 'Newsletter Update',
  preheader: '',
  heroImageUrl: '',
  ctaLabel: 'Shop Now',
  ctaUrl: '/products',
  bodyMarkdown: 'Thanks for being part of Head Over Feels.',
  audienceFilter: DEFAULT_AUDIENCE_FILTER,
}

function toDateInputValue(isoValue: string | null): string {
  if (!isoValue) {
    return ''
  }

  try {
    return new Date(isoValue).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

function toIsoDate(dateValue: string): string | null {
  if (!dateValue) {
    return null
  }

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function getCampaignStatusClass(status: CampaignStatus): string {
  switch (status) {
    case 'SENT':
      return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
    case 'FAILED':
      return 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
    case 'QUEUED':
      return 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
    case 'SENDING':
      return 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    default:
      return 'bg-white/5 text-white/70 border border-white/10'
  }
}

function toCampaignForm(campaign: CampaignDetail): CampaignFormState {
  return {
    name: campaign.name || '',
    subject: campaign.subject,
    preheader: campaign.preheader || '',
    heroImageUrl: campaign.heroImageUrl || '',
    ctaLabel: campaign.ctaLabel || '',
    ctaUrl: campaign.ctaUrl || '',
    bodyMarkdown: campaign.bodyMarkdown,
    audienceFilter: {
      activeOnly: campaign.audienceFilter.activeOnly,
      source: campaign.audienceFilter.source,
      signupDateFrom: campaign.audienceFilter.signupDateFrom,
      signupDateTo: campaign.audienceFilter.signupDateTo,
      customerMode: campaign.audienceFilter.customerMode,
    },
  }
}

export default function NewsletterAdminPage() {
  const [activeTab, setActiveTab] = useState<AdminNewsletterTab>('subscribers')

  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignPagination, setCampaignPagination] = useState<CampaignPagination | null>(null)
  const [campaignPage, setCampaignPage] = useState(1)
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | CampaignStatus>('all')
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null)
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(DEFAULT_CAMPAIGN_FORM)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [campaignCreating, setCampaignCreating] = useState(false)
  const [audiencePreview, setAudiencePreview] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [campaignSending, setCampaignSending] = useState(false)
  const [campaignNotice, setCampaignNotice] = useState<string | null>(null)
  const [campaignError, setCampaignError] = useState<string | null>(null)

  const fetchSubscribers = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        status: statusFilter,
        source: sourceFilter,
      })

      if (search) {
        params.set('search', search)
      }

      const response = await fetch(`/api/admin/newsletter?${params.toString()}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch subscribers')
      }

      const data = await response.json()
      setSubscribers(data.subscribers || [])
      setStats(data.stats || null)
      setPagination(data.pagination || null)
    } catch (error) {
      console.error('Failed to fetch subscribers:', error)
    } finally {
      setLoading(false)
    }
  }, [page, search, sourceFilter, statusFilter])

  const fetchCampaignDetail = useCallback(async (campaignId: string) => {
    try {
      const response = await fetch(`/api/admin/newsletter/campaigns/${campaignId}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to load campaign detail')
      }

      const data = await response.json()
      const detail = data.campaign as CampaignDetail
      setCampaignDetail(detail)
      setCampaignForm(toCampaignForm(detail))
      setAudiencePreview(detail.audienceCount)
      setCampaignError(null)
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to load campaign detail')
    }
  }, [])

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true)

    try {
      const params = new URLSearchParams({
        page: campaignPage.toString(),
        limit: '12',
      })

      if (campaignStatusFilter !== 'all') {
        params.set('status', campaignStatusFilter)
      }

      const response = await fetch(`/api/admin/newsletter/campaigns?${params.toString()}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch campaigns')
      }

      const data = await response.json()
      const nextCampaigns = (data.campaigns || []) as CampaignSummary[]
      setCampaigns(nextCampaigns)
      setCampaignPagination(data.pagination || null)

      setSelectedCampaignId((currentSelectedCampaignId) => {
        if (!currentSelectedCampaignId && nextCampaigns.length > 0) {
          return nextCampaigns[0].id
        }

        if (
          currentSelectedCampaignId &&
          !nextCampaigns.some((campaign) => campaign.id === currentSelectedCampaignId)
        ) {
          return nextCampaigns[0]?.id || null
        }

        return currentSelectedCampaignId
      })
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to fetch campaigns')
    } finally {
      setCampaignsLoading(false)
    }
  }, [campaignPage, campaignStatusFilter])

  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  useEffect(() => {
    if (activeTab !== 'campaigns') {
      return
    }

    fetchCampaigns()
  }, [activeTab, fetchCampaigns])

  useEffect(() => {
    if (activeTab !== 'campaigns' || !selectedCampaignId) {
      return
    }

    fetchCampaignDetail(selectedCampaignId)
  }, [activeTab, selectedCampaignId, fetchCampaignDetail])

  useEffect(() => {
    if (activeTab !== 'campaigns' || !selectedCampaignId) {
      return
    }

    if (campaignDetail?.status !== 'QUEUED' && campaignDetail?.status !== 'SENDING') {
      return
    }

    const interval = window.setInterval(() => {
      fetchCampaigns()
      fetchCampaignDetail(selectedCampaignId)
    }, 5000)

    return () => {
      window.clearInterval(interval)
    }
  }, [activeTab, campaignDetail?.status, fetchCampaignDetail, fetchCampaigns, selectedCampaignId])

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true)

    try {
      const response = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', format }),
      })

      if (!response.ok) {
        throw new Error('Failed to export subscribers')
      }

      if (format === 'csv') {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`
        anchor.click()
        URL.revokeObjectURL(url)
        return
      }

      const data = await response.json()
      const blob = new Blob([JSON.stringify(data.subscribers, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export subscribers:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleCreateDraft = async () => {
    setCampaignCreating(true)
    setCampaignNotice(null)
    setCampaignError(null)

    try {
      const response = await fetch('/api/admin/newsletter/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULT_CAMPAIGN_FORM),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create draft')
      }

      const data = await response.json()
      const createdCampaign = data.campaign as CampaignDetail
      setSelectedCampaignId(createdCampaign.id)
      setCampaignNotice('New draft campaign created.')
      await fetchCampaigns()
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to create campaign')
    } finally {
      setCampaignCreating(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!selectedCampaignId) {
      return
    }

    if (campaignDetail?.status !== 'DRAFT') {
      setCampaignError('Only draft campaigns can be edited.')
      return
    }

    setCampaignSaving(true)
    setCampaignNotice(null)
    setCampaignError(null)

    try {
      const response = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignForm.name,
          subject: campaignForm.subject,
          preheader: campaignForm.preheader,
          heroImageUrl: campaignForm.heroImageUrl,
          ctaLabel: campaignForm.ctaLabel,
          ctaUrl: campaignForm.ctaUrl,
          bodyMarkdown: campaignForm.bodyMarkdown,
          audienceFilter: campaignForm.audienceFilter,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save campaign')
      }

      const updatedCampaign = data.campaign as CampaignDetail
      setCampaignDetail(updatedCampaign)
      setCampaignForm(toCampaignForm(updatedCampaign))
      setAudiencePreview(updatedCampaign.audienceCount)
      setCampaignNotice('Draft saved successfully.')
      await fetchCampaigns()
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to save campaign')
    } finally {
      setCampaignSaving(false)
    }
  }

  const handlePreviewAudience = async () => {
    if (!selectedCampaignId) {
      return
    }

    setPreviewLoading(true)
    setCampaignNotice(null)
    setCampaignError(null)

    try {
      const response = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaignId}/preview-audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceFilter: campaignForm.audienceFilter,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview audience')
      }

      setAudiencePreview(data.estimatedRecipients)
      setCampaignNotice(`Estimated recipients: ${Number(data.estimatedRecipients || 0).toLocaleString()}`)
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to preview audience')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSendTest = async () => {
    if (!selectedCampaignId) {
      return
    }

    setTestSending(true)
    setCampaignNotice(null)
    setCampaignError(null)

    try {
      const response = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaignId}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      setCampaignNotice(data.message || 'Test email sent successfully.')
      await fetchCampaignDetail(selectedCampaignId)
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to send test email')
    } finally {
      setTestSending(false)
    }
  }

  const handleSendNow = async () => {
    if (!selectedCampaignId || campaignDetail?.status !== 'DRAFT') {
      return
    }

    const confirmed = window.confirm('Queue this campaign for sending? Delivery starts in the background.')
    if (!confirmed) {
      return
    }

    setCampaignSending(true)
    setCampaignNotice(null)
    setCampaignError(null)

    try {
      const response = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaignId}/send`, {
        method: 'POST',
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send campaign')
      }

      setCampaignNotice(data.message || 'Campaign queued for dispatch.')

      await Promise.all([
        fetchCampaigns(),
        fetchCampaignDetail(selectedCampaignId),
        fetchSubscribers(),
      ])
    } catch (error) {
      setCampaignError(error instanceof Error ? error.message : 'Failed to send campaign')
    } finally {
      setCampaignSending(false)
    }
  }

  const sourceOptions = useMemo(() => {
    const keys = stats?.bySource ? Object.keys(stats.bySource) : []
    return keys.sort((first, second) => first.localeCompare(second))
  }, [stats?.bySource])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (!campaignForm.audienceFilter.activeOnly) count += 1
    if (campaignForm.audienceFilter.source) count += 1
    if (campaignForm.audienceFilter.signupDateFrom) count += 1
    if (campaignForm.audienceFilter.signupDateTo) count += 1
    if (campaignForm.audienceFilter.customerMode !== 'all') count += 1
    return count
  }, [campaignForm.audienceFilter])

  return (
    <AdminLayout
      title="Newsletter"
      subtitle="Manage subscribers and one-time campaigns"
      headerActions={
        activeTab === 'subscribers' ? (
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {exporting ? <CircleNotch size={16} className="animate-spin" /> : <Export size={16} weight="bold" />}
            Export CSV
          </button>
        ) : (
          <button
            onClick={handleCreateDraft}
            disabled={campaignCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#E02828] disabled:opacity-50"
          >
            {campaignCreating ? <CircleNotch size={16} className="animate-spin" /> : <Plus size={16} weight="bold" />}
            New Draft
          </button>
        )
      }
    >
      <div className="space-y-6">
      <div className="border border-white/10 bg-white/5 p-1 inline-flex rounded-lg">
        <button
          onClick={() => setActiveTab('subscribers')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'subscribers'
              ? 'bg-[#FF3131] text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          Subscribers
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'campaigns'
              ? 'bg-[#FF3131] text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          Campaigns
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-neutral-900 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 mb-2">
              <Users size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Total Active</span>
            </div>
            <p className="text-3xl font-black text-white">{stats.totalActive.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-neutral-900 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 mb-2">
              <User size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Customer Linked</span>
            </div>
            <p className="text-3xl font-black text-white">{stats.customerSubscribers.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-neutral-900 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-white/50 mb-2">
              <EnvelopeSimple size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">Unsubscribed</span>
            </div>
            <p className="text-3xl font-black text-white">{stats.unsubscribed.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-neutral-900 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <TrendUp size={18} weight="bold" />
              <span className="text-xs font-bold uppercase">New (30d)</span>
            </div>
            <p className="text-3xl font-black text-green-600">+{stats.newLast30Days.toLocaleString()}</p>
          </div>
        </div>
      )}

      {activeTab === 'subscribers' ? (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <MagnifyingGlass size={18} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by email..."
                className="w-full pl-10 pr-4 py-2 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex items-center gap-2">
              <Funnel size={18} weight="bold" className="text-white/30" />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as 'all' | 'active' | 'unsubscribed')
                  setPage(1)
                }}
                className="px-3 py-2 border border-white/10 text-sm focus:outline-none focus:border-white/30 bg-neutral-900"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </div>

            {sourceOptions.length > 0 && (
              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value)
                  setPage(1)
                }}
                className="px-3 py-2 border border-white/10 text-sm focus:outline-none focus:border-white/30 bg-neutral-900"
              >
                <option value="all">All Sources</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source} ({stats?.bySource[source] || 0})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-neutral-900 border border-white/10 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <CircleNotch size={32} className="animate-spin text-white/30 mx-auto" />
                <p className="mt-2 text-sm text-white/50">Loading subscribers...</p>
              </div>
            ) : subscribers.length === 0 ? (
              <div className="p-12 text-center">
                <EnvelopeSimple size={48} weight="thin" className="text-white/20 mx-auto mb-4" />
                <p className="text-white/50">No subscribers found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/[0.04] border-b border-white/10">
                      <tr>
                        <th className="text-left text-xs font-bold uppercase text-white/50 px-4 py-3">Email</th>
                        <th className="text-left text-xs font-bold uppercase text-white/50 px-4 py-3">Type</th>
                        <th className="text-left text-xs font-bold uppercase text-white/50 px-4 py-3">Source</th>
                        <th className="text-left text-xs font-bold uppercase text-white/50 px-4 py-3">Status</th>
                        <th className="text-left text-xs font-bold uppercase text-white/50 px-4 py-3">Subscribed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {subscribers.map((subscriber) => (
                        <tr key={subscriber.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-white">{subscriber.email}</p>
                              {subscriber.name && (
                                <p className="text-xs text-white/50">{subscriber.name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
                              subscriber.isCustomer ? 'bg-[#FF3131] text-white' : 'bg-white/10 text-white/70'
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
                            <div className="flex items-center gap-1 text-xs text-white/50">
                              <LinkIcon size={12} />
                              {subscriber.source || 'Unknown'}
                            </div>
                            {subscriber.utmCampaign && (
                              <p className="text-[10px] text-white/30 mt-0.5">
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
                            <div className="flex items-center gap-1 text-xs text-white/50">
                              <Calendar size={12} />
                              {new Date(subscriber.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                    <p className="text-sm text-white/50">
                      Showing {(pagination.page - 1) * pagination.limit + 1} -{' '}
                      {Math.min(pagination.page * pagination.limit, pagination.totalSubscribers)} of{' '}
                      {pagination.totalSubscribers}
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm font-bold disabled:opacity-30 hover:bg-white/10"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage((currentPage) => Math.min(pagination.totalPages, currentPage + 1))}
                        disabled={page === pagination.totalPages}
                        className="px-3 py-1 text-sm font-bold disabled:opacity-30 hover:bg-white/10"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {stats?.bySource && Object.keys(stats.bySource).length > 0 && (
            <div className="mt-8 bg-neutral-900 border border-white/10 p-6">
              <h3 className="font-bold text-white mb-4">Subscribers by Source</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-md">
                    <span className="text-sm capitalize">{source.replaceAll('_', ' ')}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <aside className="border border-white/10 bg-neutral-900">
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wide text-white">Campaign History</h2>
                {stats?.campaigns && (
                  <span className="text-xs text-white/50">{stats.campaigns.total} total</span>
                )}
              </div>

              <select
                value={campaignStatusFilter}
                onChange={(event) => {
                  setCampaignStatusFilter(event.target.value as 'all' | CampaignStatus)
                  setCampaignPage(1)
                }}
                className="w-full px-3 py-2 border border-white/10 text-sm focus:outline-none focus:border-white/30 bg-neutral-900"
              >
                <option value="all">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="QUEUED">Queued</option>
                <option value="SENDING">Sending</option>
                <option value="SENT">Sent</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="max-h-[720px] overflow-auto divide-y divide-white/10">
              {campaignsLoading ? (
                <div className="p-6 text-center text-white/50 text-sm">
                  <CircleNotch size={20} className="animate-spin mx-auto mb-2" />
                  Loading campaigns...
                </div>
              ) : campaigns.length === 0 ? (
                <div className="p-6 text-center text-sm text-white/50">No campaigns yet.</div>
              ) : (
                campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`w-full text-left p-4 hover:bg-white/[0.03] transition-colors ${
                      selectedCampaignId === campaign.id ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-white leading-snug line-clamp-2">{campaign.subject}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 ${getCampaignStatusClass(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-white/50">Audience: {campaign.audienceCount.toLocaleString()}</p>
                    <p className="text-xs text-white/50">Sent: {campaign.sentCount.toLocaleString()} • Failed: {campaign.failedCount.toLocaleString()}</p>
                    <p className="text-[11px] text-white/40 mt-1">{new Date(campaign.createdAt).toLocaleString()}</p>
                  </button>
                ))
              )}
            </div>

            {campaignPagination && campaignPagination.totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-white/10">
                <button
                  onClick={() => setCampaignPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={campaignPage === 1}
                  className="text-xs font-bold px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                >
                  Prev
                </button>
                <p className="text-xs text-white/50">
                  {campaignPagination.page} / {campaignPagination.totalPages}
                </p>
                <button
                  onClick={() => setCampaignPage((currentPage) => Math.min(campaignPagination.totalPages, currentPage + 1))}
                  disabled={campaignPage === campaignPagination.totalPages}
                  className="text-xs font-bold px-2 py-1 hover:bg-white/10 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </aside>

          <section className="space-y-4">
            {campaignNotice && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
                {campaignNotice}
              </div>
            )}

            {campaignError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                {campaignError}
              </div>
            )}

            {!campaignDetail ? (
              <div className="rounded-xl border border-white/10 bg-neutral-900 p-10 text-center text-white/50 text-sm">
                Select a campaign draft or create a new one.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-white/50">Campaign</p>
                      <h3 className="text-xl font-black text-white mt-1">{campaignDetail.subject}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 ${getCampaignStatusClass(campaignDetail.status)}`}>
                        {campaignDetail.status}
                      </span>
                      <span className="text-xs text-white/50">{new Date(campaignDetail.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="text-sm font-semibold text-white">
                      Campaign Name
                      <input
                        value={campaignForm.name}
                        onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                    </label>

                    <label className="text-sm font-semibold text-white">
                      Subject
                      <input
                        value={campaignForm.subject}
                        onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, subject: event.target.value }))}
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                    </label>

                    <label className="text-sm font-semibold text-white md:col-span-2">
                      Preheader
                      <input
                        value={campaignForm.preheader}
                        onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, preheader: event.target.value }))}
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                    </label>

                    <label className="text-sm font-semibold text-white">
                      Hero Image URL
                      <input
                        value={campaignForm.heroImageUrl}
                        onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, heroImageUrl: event.target.value }))}
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm font-semibold text-white">
                        CTA Label
                        <input
                          value={campaignForm.ctaLabel}
                          onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, ctaLabel: event.target.value }))}
                          disabled={campaignDetail.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                        />
                      </label>
                      <label className="text-sm font-semibold text-white">
                        CTA URL
                        <input
                          value={campaignForm.ctaUrl}
                          onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, ctaUrl: event.target.value }))}
                          disabled={campaignDetail.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                        />
                      </label>
                    </div>

                    <label className="text-sm font-semibold text-white md:col-span-2">
                      Body (Markdown)
                      <textarea
                        value={campaignForm.bodyMarkdown}
                        onChange={(event) => setCampaignForm((currentForm) => ({ ...currentForm, bodyMarkdown: event.target.value }))}
                        rows={10}
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black uppercase tracking-wide">Audience Filters</h4>
                      <span className="text-xs text-white/50">{activeFiltersCount} active</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={campaignForm.audienceFilter.activeOnly}
                          onChange={(event) => {
                            const checked = event.target.checked
                            setCampaignForm((currentForm) => ({
                              ...currentForm,
                              audienceFilter: {
                                ...currentForm.audienceFilter,
                                activeOnly: checked,
                              },
                            }))
                          }}
                          disabled={campaignDetail.status !== 'DRAFT'}
                        />
                        Active subscribers only
                      </label>

                      <label className="text-sm font-semibold text-white">
                        Source
                        <select
                          value={campaignForm.audienceFilter.source || 'all'}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            setCampaignForm((currentForm) => ({
                              ...currentForm,
                              audienceFilter: {
                                ...currentForm.audienceFilter,
                                source: nextValue === 'all' ? null : nextValue,
                              },
                            }))
                          }}
                          disabled={campaignDetail.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                        >
                          <option value="all">All sources</option>
                          {sourceOptions.map((source) => (
                            <option key={source} value={source}>{source}</option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-semibold text-white">
                        Customer Link
                        <select
                          value={campaignForm.audienceFilter.customerMode}
                          onChange={(event) => {
                            const nextMode = event.target.value as NewsletterAudienceFilter['customerMode']
                            setCampaignForm((currentForm) => ({
                              ...currentForm,
                              audienceFilter: {
                                ...currentForm.audienceFilter,
                                customerMode: nextMode,
                              },
                            }))
                          }}
                          disabled={campaignDetail.status !== 'DRAFT'}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                        >
                          <option value="all">All</option>
                          <option value="customer">Customers only</option>
                          <option value="subscriber">Non-customer only</option>
                        </select>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-sm font-semibold text-white">
                          From
                          <input
                            type="date"
                            value={toDateInputValue(campaignForm.audienceFilter.signupDateFrom)}
                            onChange={(event) => {
                              setCampaignForm((currentForm) => ({
                                ...currentForm,
                                audienceFilter: {
                                  ...currentForm.audienceFilter,
                                  signupDateFrom: toIsoDate(event.target.value),
                                },
                              }))
                            }}
                            disabled={campaignDetail.status !== 'DRAFT'}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                          />
                        </label>
                        <label className="text-sm font-semibold text-white">
                          To
                          <input
                            type="date"
                            value={toDateInputValue(campaignForm.audienceFilter.signupDateTo)}
                            onChange={(event) => {
                              setCampaignForm((currentForm) => ({
                                ...currentForm,
                                audienceFilter: {
                                  ...currentForm.audienceFilter,
                                  signupDateTo: toIsoDate(event.target.value),
                                },
                              }))
                            }}
                            disabled={campaignDetail.status !== 'DRAFT'}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-sm text-white focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handlePreviewAudience}
                        disabled={campaignDetail.status !== 'DRAFT' || previewLoading}
                        className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                      >
                        {previewLoading ? 'Previewing...' : 'Preview Audience'}
                      </button>
                      <span className="text-sm text-white/60">
                        Estimated recipients: {(audiencePreview ?? campaignDetail.audienceCount).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      onClick={handleSaveDraft}
                      disabled={campaignDetail.status !== 'DRAFT' || campaignSaving}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#E02828] disabled:opacity-50"
                    >
                      {campaignSaving ? <CircleNotch size={14} className="animate-spin" /> : <PencilSimple size={14} weight="bold" />}
                      Save Draft
                    </button>

                    <button
                      onClick={handleSendNow}
                      disabled={campaignDetail.status !== 'DRAFT' || campaignSending}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                    >
                      {campaignSending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneRight size={14} weight="bold" />}
                      Queue Send
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-wide text-white">Send Test</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="email"
                        value={testEmail}
                        onChange={(event) => setTestEmail(event.target.value)}
                        placeholder="test@example.com"
                        disabled={campaignDetail.status !== 'DRAFT'}
                        className="flex-1 min-w-[220px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 disabled:bg-white/[0.03]"
                      />
                      <button
                        onClick={handleSendTest}
                        disabled={campaignDetail.status !== 'DRAFT' || testSending || !testEmail}
                        className="rounded-lg bg-[#FF3131] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#E02828] disabled:opacity-50"
                      >
                        {testSending ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/10 text-xs text-white/60">
                      Delivery logs include test sends and live campaign sends.
                    </div>

                    <div className="max-h-64 overflow-auto border border-white/10">
                      {campaignDetail.deliveries.length === 0 ? (
                        <p className="text-xs text-white/50 p-3">No delivery records yet.</p>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wide text-white/50">
                            <tr>
                              <th className="text-left px-3 py-2">Email</th>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="text-left px-3 py-2">Type</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10 text-xs">
                            {campaignDetail.deliveries.map((delivery) => (
                              <tr key={delivery.id}>
                                <td className="px-3 py-2 text-white">{delivery.email}</td>
                                <td className={`px-3 py-2 font-bold ${delivery.status === 'SENT' ? 'text-green-600' : 'text-red-600'}`}>
                                  {delivery.status}
                                </td>
                                <td className="px-3 py-2 text-white/60">{delivery.isTest ? 'Test' : 'Live'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-3">
                    <h4 className="text-sm font-black uppercase tracking-wide text-white">Live Preview</h4>
                    <div className="rounded-xl border border-white/10 p-4 bg-white/[0.03] space-y-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Head Over Feels</p>
                      <h5 className="text-2xl font-black text-white leading-tight">{campaignForm.subject || 'Newsletter Subject'}</h5>
                      {campaignForm.preheader && (
                        <p className="text-sm text-white/60">{campaignForm.preheader}</p>
                      )}
                      {campaignForm.heroImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={campaignForm.heroImageUrl}
                          alt="Campaign hero preview"
                          className="w-full border border-white/10"
                        />
                      )}
                      <p className="text-sm text-white whitespace-pre-wrap">{campaignForm.bodyMarkdown}</p>
                      {campaignForm.ctaLabel && campaignForm.ctaUrl && (
                        <a
                          href={campaignForm.ctaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-lg bg-[#FF3131] px-3 py-2 text-sm font-bold text-white"
                        >
                          {campaignForm.ctaLabel}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
