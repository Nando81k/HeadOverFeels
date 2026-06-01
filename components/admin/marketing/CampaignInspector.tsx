'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Inspector } from '@/components/ui/Inspector'
import { toast } from '@/lib/toast'
import {
  duplicateCampaign,
  deleteCampaign,
} from '@/app/admin/marketing/actions'
import type { CampaignDetailFull } from '@/app/admin/marketing/actions'

export interface CampaignInspectorProps {
  open: boolean
  detail: CampaignDetailFull | null
  onClose: () => void
  onMutated?: (id: string) => void
}

const STATUS_PILL: Record<string, string> = {
  DRAFT:   'bg-white/8 text-white/60',
  QUEUED:  'bg-amber-500/15 text-amber-300',
  SENDING: 'bg-sky-500/15 text-sky-300',
  SENT:    'bg-emerald-500/15 text-emerald-300',
  FAILED:  'bg-rose-500/15 text-rose-300',
}

function formatDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

export function CampaignInspector({ open, detail, onClose, onMutated }: CampaignInspectorProps) {
  const [pending, startTransition] = useTransition()

  function handleDuplicate() {
    if (!detail) return
    startTransition(async () => {
      const r = await duplicateCampaign(detail.id)
      if (r.ok) {
        toast.success('Duplicated')
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to duplicate')
      }
    })
  }

  function handleDelete() {
    if (!detail) return
    if (!window.confirm('Delete this draft campaign?')) return
    startTransition(async () => {
      const r = await deleteCampaign(detail.id)
      if (r.ok) {
        toast.success('Deleted')
        onMutated?.(detail.id)
      } else {
        toast.error('Failed to delete')
      }
    })
  }

  const isDraft = detail?.status === 'DRAFT'

  return (
    <Inspector open={open} onClose={onClose} title={detail?.subject ?? 'Campaign'}>
      {!detail ? (
        <div className="p-6 text-sm text-white/40">Loading…</div>
      ) : (
        <div className="p-4 space-y-3 text-sm">
          <div>
            <h3 className="text-base font-semibold text-white">{detail.subject}</h3>
            {detail.preheader && (
              <p className="text-[11px] text-white/50 mt-1">{detail.preheader}</p>
            )}
          </div>

          <div className="bg-neutral-900/60 border border-white/8 rounded p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase text-white/40">Status</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_PILL[detail.status] ?? 'bg-white/8 text-white/40'}`}
              >
                {detail.status}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Audience</span>
              <span className="tabular-nums text-white">{detail.audienceCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Sent</span>
              <span className="tabular-nums text-white">{detail.sentCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Failed</span>
              <span className="tabular-nums text-rose-300">{detail.failedCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Sent at</span>
              <span className="text-white/70 text-xs">{formatDate(detail.sentAt)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleDuplicate}
              disabled={pending}
              className="flex-1 px-3 py-1.5 text-sm bg-white/8 border border-white/15 rounded text-white disabled:opacity-40"
            >
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              disabled={pending || !isDraft}
              title={isDraft ? 'Delete draft' : 'Only DRAFT campaigns can be deleted'}
              className="flex-1 px-3 py-1.5 text-sm bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded disabled:opacity-40"
            >
              Delete
            </button>
          </div>

          <div className="pt-2 border-t border-white/8">
            <Link
              href={`/admin/marketing/campaigns/${detail.id}/edit`}
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              Open editor →
            </Link>
          </div>
        </div>
      )}
    </Inspector>
  )
}
