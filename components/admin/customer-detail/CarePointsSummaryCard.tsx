/**
 * Care Points Summary Card Component
 * 
 * Displays care points overview with:
 * - Current balance
 * - Tier progress
 * - Points expiring soon
 * - Gift points button
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Crown, 
  Gift, 
  Clock, 
  TrendUp, 
  ArrowRight,
  Warning,
  IconProps 
} from '@phosphor-icons/react';

type PhosphorIcon = React.ComponentType<IconProps>;

interface Tier {
  id: string;
  name: string;
  minAnnualPoints: number;
  pointMultiplier: number;
  perks: string[];
}

interface CarePointsSummaryCardProps {
  currentPoints: number;
  lifetimePoints: number;
  annualPointsEarned: number;
  currentTier: Tier | null;
  nextTier: Tier | null;
  expiringPoints: number;
  expiringDate: string | null;
  onGiftPoints: () => void;
  loading?: boolean;
}

// Tier colors mapping
const TIER_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  'Warm Heart': { 
    bg: 'bg-amber-500/20', 
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20'
  },
  'Kind Soul': { 
    bg: 'bg-emerald-500/20', 
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20'
  },
  'Caring Spirit': { 
    bg: 'bg-blue-500/20', 
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/20'
  },
  'Heart Guardian': { 
    bg: 'bg-purple-500/20', 
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    glow: 'shadow-purple-500/20'
  },
  'default': { 
    bg: 'bg-gray-500/20', 
    text: 'text-gray-400',
    border: 'border-gray-500/30',
    glow: 'shadow-gray-500/20'
  },
};

export default function CarePointsSummaryCard({
  currentPoints,
  lifetimePoints,
  annualPointsEarned,
  currentTier,
  nextTier,
  expiringPoints,
  expiringDate,
  onGiftPoints,
  loading = false
}: CarePointsSummaryCardProps) {
  const tierColors = TIER_COLORS[currentTier?.name || 'default'] || TIER_COLORS['default'];
  
  // Calculate progress to next tier
  const pointsToNextTier = nextTier 
    ? Math.max(0, nextTier.minAnnualPoints - annualPointsEarned) 
    : 0;
  const progressPercent = nextTier 
    ? Math.min(100, (annualPointsEarned / nextTier.minAnnualPoints) * 100)
    : 100;

  // Loading skeleton
  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-8 bg-white/10 rounded w-1/2 animate-pulse mb-2" />
            <div className="h-4 bg-white/10 rounded w-1/3 animate-pulse" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-12 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-neutral-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 ${tierColors.glow} shadow-lg`}
    >
      {/* Header with Balance */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <motion.div 
            className={`relative p-4 rounded-2xl ${tierColors.bg} ${tierColors.border} border`}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Star size={32} weight="fill" className={tierColors.text} />
            {currentTier && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 p-1 rounded-full bg-neutral-900"
              >
                <Crown size={14} weight="fill" className={tierColors.text} />
              </motion.div>
            )}
          </motion.div>
          <div>
            <p className="text-sm text-white/40 mb-1">Care Points Balance</p>
            <motion.p 
              className="text-3xl font-bold text-white"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {currentPoints.toLocaleString()}
            </motion.p>
            <p className="text-sm text-white/40 mt-1">
              {lifetimePoints.toLocaleString()} lifetime
            </p>
          </div>
        </div>

        {/* Gift Points Button */}
        <motion.button
          onClick={onGiftPoints}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20"
        >
          <Gift size={18} weight="bold" />
          Gift Points
        </motion.button>
      </div>

      {/* Current Tier */}
      <div className={`p-4 rounded-xl ${tierColors.bg} ${tierColors.border} border mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown size={20} weight="fill" className={tierColors.text} />
            <div>
              <p className="text-sm text-white/60">Current Tier</p>
              <p className={`font-semibold ${tierColors.text}`}>
                {currentTier?.name || 'No Tier'}
              </p>
            </div>
          </div>
          {currentTier && (
            <div className="text-right">
              <p className="text-xs text-white/40">Points Multiplier</p>
              <p className={`text-lg font-bold ${tierColors.text}`}>
                {currentTier.pointMultiplier}x
              </p>
            </div>
          )}
        </div>

        {/* Tier perks preview */}
        {currentTier?.perks && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs text-white/40 mb-2">Perks</p>
            <div className="flex flex-wrap gap-2">
              {(() => {
                // Parse perks if it's a string
                const perksData = typeof currentTier.perks === 'string' 
                  ? JSON.parse(currentTier.perks) 
                  : currentTier.perks;
                
                // If perks is an array, use it directly
                if (Array.isArray(perksData)) {
                  return perksData.slice(0, 3).map((perk: string, i: number) => (
                    <span 
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60"
                    >
                      {perk}
                    </span>
                  ));
                }
                
                // If perks is an object, convert keys to readable labels
                const perkLabels: Record<string, string> = {
                  birthdayPoints: 'Birthday Points',
                  dropAccess: 'Drop Access',
                  careBox: 'Care Box',
                  freeShipping: 'Free Shipping',
                  exclusiveItems: 'Exclusive Items',
                  membersWall: 'Members Wall',
                  privateDropAccess: 'Private Drops',
                  customEmbroidery: 'Custom Embroidery',
                  concierge: 'Concierge Service',
                };
                
                return Object.entries(perksData)
                  .filter(([, value]) => value === true)
                  .slice(0, 3)
                  .map(([key], i) => (
                    <span 
                      key={i}
                      className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60"
                    >
                      {perkLabels[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="p-4 rounded-xl bg-white/5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendUp size={16} className="text-white/60" />
              <span className="text-sm text-white/60">Next Tier</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{nextTier.name}</span>
              <ArrowRight size={14} className="text-white/40" />
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
            />
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">
              {annualPointsEarned.toLocaleString()} / {nextTier.minAnnualPoints.toLocaleString()} pts
            </span>
            <span className="text-white/60 font-medium">
              {pointsToNextTier.toLocaleString()} pts to go
            </span>
          </div>
        </div>
      )}

      {/* Expiring Points Warning */}
      {expiringPoints > 0 && expiringDate && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20"
        >
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Warning size={18} weight="bold" className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-400">
              {expiringPoints.toLocaleString()} points expiring
            </p>
            <p className="text-xs text-orange-400/60">
              <Clock size={10} className="inline mr-1" />
              {new Date(expiringDate).toLocaleDateString()}
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
