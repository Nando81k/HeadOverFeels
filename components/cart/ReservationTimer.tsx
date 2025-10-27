'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ReservationTimerProps {
  expiresAt: Date | string;
  onExpire?: () => void;
  variant?: 'default' | 'compact';
}

interface TimeLeft {
  minutes: number;
  seconds: number;
  total: number; // Total milliseconds
}

export default function ReservationTimer({
  expiresAt,
  onExpire,
  variant = 'default',
}: ReservationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [hasExpired, setHasExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft | null => {
      const now = new Date().getTime();
      const expireTime = new Date(expiresAt).getTime();
      const difference = expireTime - now;

      if (difference <= 0) {
        return null;
      }

      return {
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        total: difference,
      };
    };

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      
      if (!newTimeLeft) {
        setHasExpired(true);
        setTimeLeft(null);
        clearInterval(timer);
        onExpire?.();
      } else {
        setTimeLeft(newTimeLeft);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  if (hasExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"
      >
        <p className="text-red-600 font-semibold text-sm">
          ⏰ Your reservation has expired
        </p>
        <p className="text-red-500 text-xs mt-1">
          This item is no longer reserved for you
        </p>
      </motion.div>
    );
  }

  if (!timeLeft) {
    return null;
  }

  const percentage = (timeLeft.total / (15 * 60 * 1000)) * 100; // Assuming 15 min reservation
  const isUrgent = timeLeft.total < 5 * 60 * 1000; // Less than 5 minutes
  const isCritical = timeLeft.total < 2 * 60 * 1000; // Less than 2 minutes

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-medium text-blue-700">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        <span>
          Reserved: {timeLeft.minutes}:{String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border-2 ${
        isCritical
          ? 'bg-red-50 border-red-300'
          : isUrgent
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-blue-50 border-blue-200'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.svg
            animate={isCritical ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className={`w-5 h-5 ${
              isCritical
                ? 'text-red-600'
                : isUrgent
                ? 'text-yellow-600'
                : 'text-blue-600'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </motion.svg>
          <span
            className={`font-semibold text-sm ${
              isCritical
                ? 'text-red-700'
                : isUrgent
                ? 'text-yellow-700'
                : 'text-blue-700'
            }`}
          >
            {isCritical
              ? '🚨 Hurry! Almost out of time'
              : isUrgent
              ? '⚡ Time running out'
              : '🔒 Reserved for you'}
          </span>
        </div>
      </div>

      {/* Countdown Display */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div
          className={`flex items-baseline gap-1 px-4 py-2 rounded-lg ${
            isCritical
              ? 'bg-red-600'
              : isUrgent
              ? 'bg-yellow-600'
              : 'bg-blue-600'
          } text-white`}
        >
          <motion.span
            key={`min-${timeLeft.minutes}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-3xl font-black"
          >
            {String(timeLeft.minutes).padStart(2, '0')}
          </motion.span>
          <span className="text-xl font-bold">:</span>
          <motion.span
            key={`sec-${timeLeft.seconds}`}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="text-3xl font-black"
          >
            {String(timeLeft.seconds).padStart(2, '0')}
          </motion.span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="h-2 bg-white/50 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${percentage}%` }}
            className={`h-full transition-all duration-1000 ${
              isCritical
                ? 'bg-red-600'
                : isUrgent
                ? 'bg-yellow-600'
                : 'bg-blue-600'
            }`}
          />
        </div>
      </div>

      {/* Message */}
      <p
        className={`text-xs text-center font-medium ${
          isCritical
            ? 'text-red-600'
            : isUrgent
            ? 'text-yellow-700'
            : 'text-blue-600'
        }`}
      >
        {isCritical
          ? 'Complete checkout now or lose this item!'
          : isUrgent
          ? 'Complete your purchase soon to secure this item'
          : 'Complete checkout within this time to secure your item'}
      </p>
    </motion.div>
  );
}
