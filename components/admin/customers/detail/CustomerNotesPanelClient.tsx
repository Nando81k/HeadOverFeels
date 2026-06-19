'use client'

import { useState, useTransition } from 'react'
import type { CustomerNoteRow } from '@/lib/admin/customers'
import { deleteCustomerNote } from '@/app/admin/customers/actions'
import { NoteInspector } from '@/components/admin/customers/inspectors/NoteInspector'
import { toast } from '@/lib/toast'

const dFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export interface CustomerNotesPanelClientProps {
  customerId: string
  notes: CustomerNoteRow[]
}

export function CustomerNotesPanelClient({ customerId, notes }: CustomerNotesPanelClientProps) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editing = editId ? notes.find((n) => n.id === editId) ?? null : null

  const onDelete = (id: string) => {
    if (!confirm('Delete this note?')) return
    startTransition(async () => {
      const r = await deleteCustomerNote(id)
      if (r.ok) toast.success('Note deleted')
      else toast.error(r.error)
    })
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Notes</h2>
        <button
          type="button"
          onClick={() => { setEditId(null); setOpen(true) }}
          className="text-xs px-2 py-1 rounded bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + Add note
        </button>
      </header>
      {notes.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No notes yet.</div>
      ) : (
        <ul>
          {notes.map((n) => (
            <li key={n.id} className="border-b border-white/4 last:border-b-0 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white whitespace-pre-wrap">{n.content}</div>
                  <div className="mt-1 text-xs text-white/40 flex items-center gap-2">
                    <span>{n.authorName}</span>
                    <span>·</span>
                    <span>{dFmt.format(n.createdAt)}</span>
                    {n.isImportant && (
                      <span aria-label="important" className="text-amber-300">★</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditId(n.id); setOpen(true) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    disabled={isPending}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <NoteInspector
        open={open}
        customerId={customerId}
        note={editing}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
