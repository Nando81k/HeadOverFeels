'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'

interface CountdownTimerProps {
  targetDate: Date
  onExpire?: () => void
  className?: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function CountdownTimer({ targetDate, onExpire, className = '' }: CountdownTimerProps) {
  const [isExpired, setIsExpired] = useState(false)

  const calculateTimeLeft = useCallback((): TimeLeft => {
    const difference = new Date(targetDate).getTime() - new Date().getTime()

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    }
  }, [targetDate])

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft())

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft()
      setTimeLeft(newTimeLeft)

      // Check if countdown expired
      if (
        newTimeLeft.days === 0 &&
        newTimeLeft.hours === 0 &&
        newTimeLeft.minutes === 0 &&
        newTimeLeft.seconds === 0 &&
        !isExpired
      ) {
        setIsExpired(true)
        onExpire?.()
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isExpired, onExpire, calculateTimeLeft])

  if (isExpired) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-lg font-bold text-red-600">Drop Has Ended</p>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <Clock className="w-5 h-5" />
        <p className="text-sm font-medium uppercase tracking-wide">Drop Ends In</p>
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-black text-white rounded-lg p-3 text-center">
          <div className="text-2xl md:text-3xl font-bold tabular-nums">
            {String(timeLeft.days).padStart(2, '0')}
          </div>
          <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Days</div>
        </div>
        
        <div className="bg-black text-white rounded-lg p-3 text-center">
          <div className="text-2xl md:text-3xl font-bold tabular-nums">
            {String(timeLeft.hours).padStart(2, '0')}
          </div>
          <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Hours</div>
        </div>
        
        <div className="bg-black text-white rounded-lg p-3 text-center">
          <div className="text-2xl md:text-3xl font-bold tabular-nums">
            {String(timeLeft.minutes).padStart(2, '0')}
          </div>
          <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Minutes</div>
        </div>
        
        <div className="bg-black text-white rounded-lg p-3 text-center">
          <div className="text-2xl md:text-3xl font-bold tabular-nums">
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="text-xs uppercase tracking-wide mt-1 opacity-80">Seconds</div>
        </div>
      </div>
    </div>
  )
}
