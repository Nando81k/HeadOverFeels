'use client'

import { useState, useTransition } from 'react'
import type { AddressType } from '@prisma/client'
import type { AddressRow } from '@/lib/admin/customers'
import { createAddress, updateAddress } from '@/app/admin/customers/actions'
import { toast } from '@/lib/toast'

export interface AddressInspectorProps {
  open: boolean
  customerId: string
  address: AddressRow | null
  onClose: () => void
}

const ADDRESS_TYPES: AddressType[] = ['SHIPPING', 'BILLING', 'BOTH']

export function AddressInspector({ open, customerId, address, onClose }: AddressInspectorProps) {
  const isEdit = address !== null
  const [firstName, setFirstName] = useState(address?.firstName ?? '')
  const [lastName, setLastName] = useState(address?.lastName ?? '')
  const [company, setCompany] = useState(address?.company ?? '')
  const [address1, setAddress1] = useState(address?.address1 ?? '')
  const [address2, setAddress2] = useState(address?.address2 ?? '')
  const [city, setCity] = useState(address?.city ?? '')
  const [state, setState] = useState(address?.state ?? '')
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? '')
  const [country, setCountry] = useState(address?.country ?? 'US')
  const [type, setType] = useState<AddressType>(address?.type ?? 'SHIPPING')
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)
  const [isPending, startTransition] = useTransition()

  if (!open) return null

  const handleSubmit = () => {
    startTransition(async () => {
      const payload = {
        firstName, lastName,
        company: company.trim() || null,
        address1, address2: address2.trim() || null,
        city, state, postalCode, country, isDefault, type,
      }
      const r = isEdit
        ? await updateAddress(address!.id, payload)
        : await createAddress(customerId, payload)
      if (r.ok) {
        toast.success(isEdit ? 'Address updated' : 'Address added')
        onClose()
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <div role="dialog" aria-label="Edit address" className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close inspector backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-neutral-950 border-l border-white/8 overflow-y-auto">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit address' : 'New address'}
          </h2>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-sm">
            ✕
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/50">First name</span>
            <input
              aria-label="first name" type="text" value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Last name</span>
            <input
              aria-label="last name" type="text" value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Company</span>
            <input
              type="text" value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Address line 1</span>
            <input
              aria-label="address line 1" type="text" value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block col-span-2">
            <span className="text-xs text-white/50">Address line 2</span>
            <input
              type="text" value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">City</span>
            <input
              aria-label="city" type="text" value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">State</span>
            <input
              aria-label="state" type="text" value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Postal code</span>
            <input
              aria-label="postal code" type="text" value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Country</span>
            <input
              type="text" value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs text-white/50">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AddressType)}
              className="mt-1 w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-white"
            >
              {ADDRESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 col-span-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default address
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
