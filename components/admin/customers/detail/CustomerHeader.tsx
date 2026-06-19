'use client'

import { useState } from 'react'
import type { CustomerHeaderData } from '@/lib/admin/customers'
import { ProfileEditInspector } from '@/components/admin/customers/inspectors/ProfileEditInspector'
import { AnonymizeConfirmDialog } from '@/components/admin/customers/inspectors/AnonymizeConfirmDialog'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const nFmt = new Intl.NumberFormat('en-US')

export interface CustomerHeaderProps {
  header: CustomerHeaderData
  isSuperAdmin: boolean
}

function initials(email: string, name: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
  }
  return (email[0] ?? '?').toUpperCase()
}

export function CustomerHeader({ header, isSuperAdmin }: CustomerHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [anonOpen, setAnonOpen] = useState(false)

  return (
    <div className="bg-neutral-900/60 border border-white/8 rounded-md p-4 flex items-start gap-3">
      {header.profilePictureUrl ? (
        <img
          src={header.profilePictureUrl}
          alt=""
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-white/8 flex items-center justify-center text-white/70 text-sm font-semibold">
          {initials(header.email, header.name)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-white text-lg font-semibold truncate">
            {header.name ?? header.email}
          </h1>
          {header.isAnonymized ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-semibold">
              Anonymized
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
              Active
            </span>
          )}
          {header.tierName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{
                background: `${header.tierColor ?? '#64748B'}26`,
                color: header.tierColor ?? '#94A3B8',
              }}
            >
              {header.tierName}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-white/50 truncate">{header.email}</div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-white/60">
          <div>Joined {dFmt.format(header.createdAt)}</div>
          <div>
            <span className="text-white/80 font-medium">
              {nFmt.format(header.currentPoints)}
            </span>{' '}
            pts
          </div>
          <div>
            <span className="text-white/80 font-medium">
              {nFmt.format(header.lifetimePoints)}
            </span>{' '}
            lifetime
          </div>
          <div>
            <span className="text-white/80 font-medium">
              {nFmt.format(header.totalOrders)}
            </span>{' '}
            orders
          </div>
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 text-white/60"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-white/8 rounded-md shadow-lg z-10"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setEditOpen(true); setMenuOpen(false) }}
              disabled={header.isAnonymized}
              className="block w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.04] disabled:opacity-30"
            >
              Edit profile
            </button>
            {isSuperAdmin && !header.isAnonymized && (
              <button
                type="button"
                role="menuitem"
                onClick={() => { setAnonOpen(true); setMenuOpen(false) }}
                className="block w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
              >
                Anonymize…
              </button>
            )}
          </div>
        )}
      </div>
      <ProfileEditInspector
        open={editOpen}
        header={header}
        onClose={() => setEditOpen(false)}
      />
      <AnonymizeConfirmDialog
        open={anonOpen}
        customerId={header.id}
        customerEmail={header.email}
        onClose={() => setAnonOpen(false)}
      />
    </div>
  )
}
