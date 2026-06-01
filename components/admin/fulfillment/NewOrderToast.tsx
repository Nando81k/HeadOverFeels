// components/admin/fulfillment/NewOrderToast.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io as ioClient } from 'socket.io-client'
import { toast } from '@/lib/toast'

interface OrderNewPayload {
  id: string
  orderNumber: string
  total: number
  customerEmail: string
}

const DEDUPE_MS = 5000

export function NewOrderToast() {
  const router = useRouter()
  const seen = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const socket = ioClient({ path: '/api/socket', withCredentials: true })

    const handler = (raw: unknown) => {
      const p = raw as OrderNewPayload
      const now = Date.now()
      const last = seen.current.get(p.id) ?? 0
      if (now - last < DEDUPE_MS) return
      seen.current.set(p.id, now)

      toast.info(
        `New order ${p.orderNumber}`,
        `${p.customerEmail} · $${p.total.toFixed(2)}`
      )
    }

    socket.on('order:new', handler)

    return () => {
      socket.off('order:new', handler)
      socket.disconnect()
    }
  }, [router])

  return null
}
