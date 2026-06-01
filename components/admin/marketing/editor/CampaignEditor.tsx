'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import {
  updateCampaignDraft,
  queueCampaignSend,
  sendCampaignTest,
  previewCampaignAudience,
} from '@/app/admin/marketing/actions'
import type { CampaignDetailFull } from '@/app/admin/marketing/actions'

export interface CampaignEditorProps {
  detail: CampaignDetailFull
  campaignId: string
}

interface AudienceFilterShape {
  activeOnly?: boolean
  source?: string
  signupDateFrom?: string
  signupDateTo?: string
  customerMode?: 'all' | 'customer' | 'subscriber'
}

function parseAudienceFilter(raw: unknown): AudienceFilterShape {
  if (raw && typeof raw === 'object') return raw as AudienceFilterShape
  return {}
}

export function CampaignEditor({ detail, campaignId }: CampaignEditorProps) {
  const [pending, startTransition] = useTransition()

  // Basic fields
  const [name, setName] = useState(detail.name ?? '')
  const [subject, setSubject] = useState(detail.subject)
  const [preheader, setPreheader] = useState(detail.preheader ?? '')
  const [heroImageUrl, setHeroImageUrl] = useState(detail.heroImageUrl ?? '')
  const [ctaLabel, setCtaLabel] = useState(detail.ctaLabel ?? '')
  const [ctaUrl, setCtaUrl] = useState(detail.ctaUrl ?? '')
  const [bodyMarkdown, setBodyMarkdown] = useState(detail.bodyMarkdown)

  // Audience filter
  const [audience, setAudience] = useState<AudienceFilterShape>(
    parseAudienceFilter(detail.audienceFilter),
  )

  // Send test
  const [testEmail, setTestEmail] = useState('')

  // Audience preview count
  const [audienceCount, setAudienceCount] = useState<number | null>(null)

  // Dirty tracking
  const [dirty, setDirty] = useState(false)

  function markDirty() {
    if (!dirty) setDirty(true)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Action handlers
  // ──────────────────────────────────────────────────────────────────────────

  function handleSaveDraft() {
    startTransition(async () => {
      const r = await updateCampaignDraft(campaignId, {
        name: name || null,
        subject,
        preheader: preheader || null,
        heroImageUrl: heroImageUrl || null,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        bodyMarkdown,
        audienceFilter: audience,
      })
      if (r.ok) {
        toast.success('Draft saved')
        setDirty(false)
      } else {
        toast.error((r as { ok: false; error: string }).error || 'Failed to save')
      }
    })
  }

  function handleQueueSend() {
    if (!window.confirm('Queue this campaign for send?')) return
    startTransition(async () => {
      const r = await queueCampaignSend(campaignId)
      if (r.ok) {
        toast.success('Campaign queued for send')
      } else {
        toast.error((r as { ok: false; error: string }).error || 'Failed to queue')
      }
    })
  }

  function handleSendTest() {
    if (!testEmail) {
      toast.error('Enter a test email')
      return
    }
    startTransition(async () => {
      const r = await sendCampaignTest(campaignId, testEmail)
      if (r.ok) {
        toast.success(`Test sent to ${testEmail}`)
      } else {
        toast.error((r as { ok: false; error: string }).error || 'Failed to send test')
      }
    })
  }

  function handlePreviewAudience() {
    startTransition(async () => {
      const r = await previewCampaignAudience(campaignId)
      if (r.ok && r.data) {
        setAudienceCount(r.data.count)
      } else {
        toast.error('Failed to preview audience')
      }
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── LEFT: Composer (2/3 width on desktop) ─────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* Basics card */}
        <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
          <h2 className="text-base font-semibold text-white">Basics</h2>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Internal name
            </span>
            <input
              aria-label="Internal name"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Subject
            </span>
            <input
              aria-label="Subject"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); markDirty() }}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Preheader
            </span>
            <input
              aria-label="Preheader"
              value={preheader}
              onChange={(e) => { setPreheader(e.target.value); markDirty() }}
              placeholder="Preview text shown after subject in inbox"
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Hero image URL
            </span>
            <input
              aria-label="Hero image URL"
              value={heroImageUrl}
              onChange={(e) => { setHeroImageUrl(e.target.value); markDirty() }}
              placeholder="https://..."
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
                CTA label
              </span>
              <input
                aria-label="CTA label"
                value={ctaLabel}
                onChange={(e) => { setCtaLabel(e.target.value); markDirty() }}
                placeholder="Shop Now"
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
              />
            </label>
            <label>
              <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
                CTA URL
              </span>
              <input
                aria-label="CTA URL"
                value={ctaUrl}
                onChange={(e) => { setCtaUrl(e.target.value); markDirty() }}
                placeholder="/collections/new"
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
              />
            </label>
          </div>
        </section>

        {/* Body card */}
        <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
          <h2 className="text-base font-semibold text-white">Body</h2>
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Markdown
            </span>
            <textarea
              aria-label="Body markdown"
              value={bodyMarkdown}
              onChange={(e) => { setBodyMarkdown(e.target.value); markDirty() }}
              rows={12}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-white/20 resize-y"
            />
          </label>
        </section>

        {/* Send test + delivery log card */}
        <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
          <h2 className="text-base font-semibold text-white">Test Delivery</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Test email"
              type="email"
              className="flex-1 min-w-[200px] bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            />
            <button
              onClick={handleSendTest}
              disabled={pending}
              className="px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40 hover:bg-white/12 transition-colors"
            >
              Send Test
            </button>
          </div>

          {detail.recentTestDeliveries.length > 0 && (
            <div className="pt-3 border-t border-white/8">
              <h3 className="text-[11px] uppercase tracking-wide text-white/40 mb-2">
                Recent test deliveries
              </h3>
              <ul className="space-y-1 text-xs">
                {detail.recentTestDeliveries.map((d) => (
                  <li key={d.id} className="flex justify-between items-center text-white/70">
                    <span className="font-mono">{d.email}</span>
                    <span
                      className={
                        d.status === 'SENT'
                          ? 'text-emerald-300'
                          : d.status === 'FAILED'
                          ? 'text-rose-300'
                          : 'text-amber-300'
                      }
                    >
                      {d.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Bottom action bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {dirty && (
            <span className="text-xs text-amber-400/80 mr-1">Unsaved changes</span>
          )}
          <button
            onClick={handleSaveDraft}
            disabled={pending}
            className="px-4 py-2 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40 hover:bg-white/12 transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={handleQueueSend}
            disabled={pending}
            className="px-4 py-2 text-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded disabled:opacity-40 hover:bg-emerald-500/30 transition-colors"
          >
            Queue Send
          </button>
        </div>
      </div>

      {/* ── RIGHT: Sidebar (audience filters + live preview) ──────────────────── */}
      <div className="space-y-4">

        {/* Audience filters card */}
        <section className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Audience filters</h3>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={audience.activeOnly === true}
              onChange={(e) => {
                setAudience({ ...audience, activeOnly: e.target.checked })
                markDirty()
              }}
              className="accent-emerald-500"
            />
            <span className="text-white/70">Active subscribers only</span>
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
              Source
            </span>
            <select
              value={audience.source ?? ''}
              onChange={(e) => {
                setAudience({ ...audience, source: e.target.value || undefined })
                markDirty()
              }}
              className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
            >
              <option value="">All sources</option>
              <option value="popup">Popup</option>
              <option value="footer">Footer</option>
              <option value="checkout">Checkout</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
                Signup from
              </span>
              <input
                type="date"
                value={audience.signupDateFrom ?? ''}
                onChange={(e) => {
                  setAudience({ ...audience, signupDateFrom: e.target.value || undefined })
                  markDirty()
                }}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wide text-white/40 mb-1">
                Signup to
              </span>
              <input
                type="date"
                value={audience.signupDateTo ?? ''}
                onChange={(e) => {
                  setAudience({ ...audience, signupDateTo: e.target.value || undefined })
                  markDirty()
                }}
                className="w-full bg-neutral-900 border border-white/8 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-white/20"
              />
            </label>
          </div>

          <fieldset>
            <legend className="block text-[11px] uppercase tracking-wide text-white/40 mb-2">
              Customer mode
            </legend>
            <div className="space-y-1">
              {(
                [
                  { value: 'all', label: 'All subscribers' },
                  { value: 'customer', label: 'Customers only' },
                  { value: 'subscriber', label: 'Subscribers only' },
                ] as const
              ).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="customerMode"
                    value={value}
                    checked={(audience.customerMode ?? 'all') === value}
                    onChange={() => {
                      setAudience({ ...audience, customerMode: value })
                      markDirty()
                    }}
                    className="accent-emerald-500"
                  />
                  <span className="text-white/70">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            onClick={handlePreviewAudience}
            disabled={pending}
            className="w-full px-3 py-1.5 text-xs bg-white/8 border border-white/15 rounded text-white disabled:opacity-40 hover:bg-white/12 transition-colors"
          >
            Preview Audience
          </button>

          {audienceCount !== null && (
            <p className="text-xs text-white/60 text-center">
              {audienceCount} subscribers match
            </p>
          )}
        </section>

        {/* Live preview card */}
        <section
          data-testid="campaign-live-preview"
          className="bg-neutral-900/60 border border-white/8 rounded-lg p-4 space-y-2"
        >
          <h3 className="text-sm font-semibold text-white">Live Preview</h3>

          {heroImageUrl && (
            <div className="w-full h-24 bg-neutral-800 rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImageUrl}
                alt="Hero"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement
                  el.style.display = 'none'
                }}
              />
            </div>
          )}

          <p className="text-base text-white font-semibold leading-snug">{subject}</p>

          {preheader && (
            <p className="text-xs text-white/50">{preheader}</p>
          )}

          <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed">
            {bodyMarkdown}
          </pre>

          {ctaLabel && ctaUrl && (
            <div className="pt-2">
              <span className="inline-block px-4 py-2 bg-white text-neutral-900 text-xs font-semibold rounded cursor-pointer">
                {ctaLabel}
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
