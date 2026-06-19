'use client'

import { useState, useTransition } from 'react'
import type { CustomerHeaderData } from '@/lib/admin/customers'
import { updateCustomerProfile } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface ProfileEditInspectorProps {
  open: boolean
  header: CustomerHeaderData
  onClose: () => void
}

function dateInputValue(d: Date | null): string {
  if (!d) return ''
  return d.toISOString().slice(0, 10)
}

export function ProfileEditInspector({ open, header, onClose }: ProfileEditInspectorProps) {
  const [name, setName] = useState(header.name ?? '')
  const [phone, setPhone] = useState(header.phone ?? '')
  const [birthday, setBirthday] = useState(dateInputValue(header.birthday))
  const [newsletter, setNewsletter] = useState(header.newsletter)
  const [smsOptIn, setSmsOptIn] = useState(header.smsOptIn)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    startTransition(async () => {
      const r = await updateCustomerProfile(header.id, {
        name: name.trim() || null,
        phone: phone.trim() || null,
        birthday: birthday ? new Date(birthday) : null,
        newsletter,
        smsOptIn,
      })
      if (r.ok) {
        toast.success('Profile updated')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit profile" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Edit profile</h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Email (not editable)</span>
            <input
              aria-label="email"
              type="email"
              value={header.email}
              disabled
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/4 border border-white/10 text-white/40"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Name</span>
            <input
              aria-label="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Phone</span>
            <input
              aria-label="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Birthday</span>
            <input
              aria-label="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
            />
            Newsletter opt-in
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
            />
            SMS opt-in
          </label>
        </div>
        <div className="p-4 border-t border-white/8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/70 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded bg-[#FF3131] text-white hover:bg-[#ff4747] disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
