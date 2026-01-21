'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Lightning, Star, Lock, Sparkle, Clock, CheckCircle, ArrowRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'

interface EarlyAccessDrop {
  id: string
  name: string
  slug: string
  price: number
  image: string
  releaseDate: string | null
  dropEndDate: string | null
  totalInventory: number
  hasAccess: boolean
  accessReason: string | null
  canUnlock: boolean
  pointsCost: number | null
  earlyAccessEnds: string | null
  tierName?: string
}

interface EarlyAccessDropsProps {
  currentPoints: number
  onPointsChange?: (newPoints: number) => void
}

export function EarlyAccessDrops({ currentPoints, onPointsChange }: EarlyAccessDropsProps) {
  const [drops, setDrops] = useState<EarlyAccessDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDrops() {
      try {
        const response = await fetch('/api/drops/early-access/available')
        if (response.ok) {
          const data = await response.json()
          setDrops(data.drops || [])
        }
      } catch (error) {
        console.error('Failed to fetch early access drops:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDrops()
  }, [])

  const handleUnlock = async (dropId: string, pointsCost: number) => {
    if (currentPoints < pointsCost) return
    
    setUnlocking(dropId)
    try {
      const response = await fetch('/api/drops/early-access/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: dropId })
      })
      
      if (response.ok) {
        const result = await response.json()
        // Update local state
        setDrops(drops.map(drop => 
          drop.id === dropId 
            ? { ...drop, hasAccess: true, accessReason: 'points_unlock', canUnlock: false }
            : drop
        ))
        setShowSuccess(dropId)
        onPointsChange?.(result.remainingPoints)
        
        // Hide success after 3 seconds
        setTimeout(() => setShowSuccess(null), 3000)
      }
    } catch (error) {
      console.error('Failed to unlock early access:', error)
    } finally {
      setUnlocking(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Lightning size={24} weight="fill" className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-black">Early Access Drops</h3>
            <p className="text-sm text-black/60">Loading available drops...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-violet-100 rounded-xl"></div>
          <div className="h-24 bg-violet-100 rounded-xl"></div>
        </div>
      </div>
    )
  }

  if (drops.length === 0) {
    return null // Don't show section if no drops with early access
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-xl">
            <Lightning size={24} weight="fill" className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-black">Early Access Drops</h3>
            <p className="text-sm text-black/60">Unlock exclusive drops before public release</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {drops.map((drop) => (
            <motion.div
              key={drop.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative bg-white rounded-xl p-4 border transition-all ${
                drop.hasAccess 
                  ? 'border-emerald-200 bg-emerald-50/50' 
                  : 'border-violet-200 hover:border-violet-300'
              }`}
            >
              {/* Success overlay */}
              <AnimatePresence>
                {showSuccess === drop.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-emerald-500/95 rounded-xl flex items-center justify-center z-10"
                  >
                    <div className="text-center text-white">
                      <CheckCircle size={40} weight="fill" className="mx-auto mb-2" />
                      <p className="font-bold">Early Access Unlocked!</p>
                      <p className="text-sm text-white/80">You can now shop this drop</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-4">
                {/* Product Image */}
                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={drop.image}
                    alt={drop.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  {drop.hasAccess && (
                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                      <Star size={24} weight="fill" className="text-emerald-500" />
                    </div>
                  )}
                </div>

                {/* Drop Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-black text-sm truncate">{drop.name}</h4>
                      <p className="text-xs text-black/60">${drop.price.toFixed(2)}</p>
                    </div>
                    {drop.hasAccess && (
                      <span className="shrink-0 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                        <CheckCircle size={12} weight="fill" />
                        Unlocked
                      </span>
                    )}
                  </div>

                  {/* Early Access Timer */}
                  {drop.earlyAccessEnds && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-black/50">
                      <Clock size={12} />
                      <span>
                        Early access ends {new Date(drop.earlyAccessEnds).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-2 flex items-center gap-2">
                    {drop.hasAccess ? (
                      <Link href={`/drops/${drop.slug}`} className="flex-1">
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          Shop Now
                          <ArrowRight size={14} className="ml-1" />
                        </Button>
                      </Link>
                    ) : drop.canUnlock && drop.pointsCost ? (
                      <Button
                        size="sm"
                        onClick={() => handleUnlock(drop.id, drop.pointsCost!)}
                        disabled={unlocking === drop.id || currentPoints < drop.pointsCost}
                        className={`flex-1 text-xs ${
                          currentPoints >= drop.pointsCost
                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {unlocking === drop.id ? (
                          'Unlocking...'
                        ) : currentPoints >= drop.pointsCost ? (
                          <>
                            <Sparkle size={14} className="mr-1" weight="fill" />
                            Unlock ({drop.pointsCost} pts)
                          </>
                        ) : (
                          <>
                            <Lock size={14} className="mr-1" />
                            {drop.pointsCost} pts needed
                          </>
                        )}
                      </Button>
                    ) : (
                      <Link href={`/drops/${drop.slug}`} className="flex-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs border-violet-200 text-violet-700 hover:bg-violet-50"
                        >
                          View Drop
                          <ArrowRight size={14} className="ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* View All Drops Link */}
      <Link href="/drops" className="mt-4 block">
        <Button
          variant="outline"
          className="w-full border-violet-200 text-violet-700 hover:bg-violet-100"
        >
          View All Drops
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </Link>
    </div>
  )
}
