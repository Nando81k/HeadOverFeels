// components/admin/dashboard/LiveActivityFeed.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { io, type Socket } from 'socket.io-client'
import { ActivityFeedItem } from '@/components/ui/ActivityFeedItem'
import type { ActivityItem } from '@/lib/admin/dashboard'

// TODO: server-side emit not yet wired in lib/socket.ts — subscriptions are inert until server emits

const VISIBLE_COUNT = 5

interface Props {
  initialItems: ActivityItem[]
}

export function LiveActivityFeed({ initialItems }: Props) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems)

  useEffect(() => {
    // Adjust event names per investigation in Step 1.
    // If no server emit yet, this effect is harmless — just initial render.
    const socket: Socket = io({ path: '/api/socket' })

    const handler = (item: ActivityItem) => {
      setItems((prev) => [item, ...prev].slice(0, VISIBLE_COUNT))
    }

    socket.on('order.created', handler)
    socket.on('order.refunded', handler)
    socket.on('drop.sale', handler)

    return () => {
      socket.off('order.created', handler)
      socket.off('order.refunded', handler)
      socket.off('drop.sale', handler)
      socket.disconnect()
    }
  }, [])

  return (
    <div className="rounded-[10px] bg-white/[0.025] border border-white/6 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          <span className="font-bold text-white text-[11px]">Live activity</span>
        </div>
        <Link href="/admin/orders" className="text-white/40 text-[9px] hover:text-white/70">
          {VISIBLE_COUNT} most recent · <span className="underline">View all</span>
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-white/40 text-[11px] py-4">No activity yet today</div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((it) => (
            <ActivityFeedItem
              key={it.id}
              status={it.status}
              title={it.title}
              description={it.description}
              timestamp={`${it.value ? `${it.value} · ` : ''}${it.timestamp}`}
              href={it.href}
            />
          ))}
        </div>
      )}
    </div>
  )
}
