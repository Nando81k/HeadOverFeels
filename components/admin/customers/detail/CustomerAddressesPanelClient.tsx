'use client'

import { useState, useTransition } from 'react'
import type { AddressRow } from '@/lib/admin/customers'
import { deleteAddress, setDefaultAddress } from '@/app/admin/customers/actions'
import { AddressInspector } from '@/components/admin/customers/inspectors/AddressInspector'
import { toast } from '@/lib/toast'

export interface CustomerAddressesPanelClientProps {
  customerId: string
  addresses: AddressRow[]
}

export function CustomerAddressesPanelClient({
  customerId,
  addresses,
}: CustomerAddressesPanelClientProps) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const editing = editId ? addresses.find((a) => a.id === editId) ?? null : null

  const onDelete = (id: string) => {
    if (!confirm('Delete this address?')) return
    startTransition(async () => {
      const r = await deleteAddress(id)
      if (r.ok) toast.success('Address deleted')
      else toast.error(r.error)
    })
  }

  const onSetDefault = (id: string) => {
    startTransition(async () => {
      const r = await setDefaultAddress(customerId, id)
      if (r.ok) toast.success('Default address updated')
      else toast.error(r.error)
    })
  }

  return (
    <section className="bg-neutral-900/60 border border-white/8 rounded-md">
      <header className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Addresses</h2>
        <button
          type="button"
          onClick={() => { setEditId(null); setOpen(true) }}
          className="text-xs px-2 py-1 rounded bg-[#FF3131] text-white hover:bg-[#ff4747]"
        >
          + Add address
        </button>
      </header>
      {addresses.length === 0 ? (
        <div className="p-4 text-sm text-white/40">No addresses on file.</div>
      ) : (
        <ul>
          {addresses.map((a) => (
            <li key={a.id} className="border-b border-white/4 last:border-b-0 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-white">
                    {a.firstName} {a.lastName}
                    {a.isDefault && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Default
                      </span>
                    )}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/60">
                      {a.type}
                    </span>
                  </div>
                  <div className="text-xs text-white/60">
                    {a.address1}{a.address2 ? `, ${a.address2}` : ''}
                  </div>
                  <div className="text-xs text-white/40">
                    {a.city}, {a.state} {a.postalCode} · {a.country}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.isDefault && (
                    <button
                      type="button"
                      onClick={() => onSetDefault(a.id)}
                      disabled={isPending}
                      className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditId(a.id); setOpen(true) }}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
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
      <AddressInspector
        open={open}
        customerId={customerId}
        address={editing}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
