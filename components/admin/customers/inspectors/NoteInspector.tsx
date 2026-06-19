'use client'

import { useState, useTransition } from 'react'
import type { CustomerNoteRow } from '@/lib/admin/customers'
import { createCustomerNote, updateCustomerNote } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface NoteInspectorProps {
  open: boolean
  customerId: string
  note: CustomerNoteRow | null
  onClose: () => void
}

export function NoteInspector({ open, customerId, note, onClose }: NoteInspectorProps) {
  const isEdit = note !== null
  const [content, setContent] = useState(note?.content ?? '')
  const [isImportant, setIsImportant] = useState(note?.isImportant ?? false)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error('Note content is required')
      return
    }
    startTransition(async () => {
      const r = isEdit
        ? await updateCustomerNote(note!.id, content.trim(), isImportant)
        : await createCustomerNote(customerId, content.trim(), isImportant)
      if (r.ok) {
        toast.success(isEdit ? 'Note updated' : 'Note added')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit note" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit note' : 'New note'}
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">Content</span>
            <textarea
              aria-label="content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80">
            <input
              aria-label="important"
              type="checkbox"
              checked={isImportant}
              onChange={(e) => setIsImportant(e.target.checked)}
            />
            Mark as important
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
