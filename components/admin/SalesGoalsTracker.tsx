'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Target, 
  TrendUp, 
  Calendar, 
  CurrencyDollar, 
  Trophy, 
  Flame, 
  PencilSimple, 
  Check, 
  X,
  CalendarBlank,
  ChartLineUp,
  Spinner,
  ArrowClockwise,
  CheckCircle
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface SalesGoal {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  target: number;
  current: number;
  percentage: number;
  remaining: number;
  onTrack?: boolean;
}

interface GoalSettings {
  dailyTarget: number;
  weeklyTarget: number;
  monthlyTarget: number;
  quarterlyTarget: number;
  yearlyTarget: number;
}

interface SalesGoalsTrackerProps {
  showEditButton?: boolean;
  compact?: boolean;
  onGoalsUpdated?: () => void;
}

export default function SalesGoalsTracker({
  showEditButton = true,
  compact = false,
  onGoalsUpdated,
}: SalesGoalsTrackerProps) {
  const [goalsData, setGoalsData] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const defaultGoals: GoalSettings = {
    dailyTarget: 500,
    weeklyTarget: 3500,
    monthlyTarget: 15000,
    quarterlyTarget: 45000,
    yearlyTarget: 180000,
  };
  const [settings, setSettings] = useState<GoalSettings>(defaultGoals);
  const [editSettings, setEditSettings] = useState<GoalSettings>(defaultGoals);

  // Fetch current sales data
  const fetchSalesData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sales/goals', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        
        // Store settings from API
        if (data.settings) {
          setSettings({
            dailyTarget: data.settings.dailyTarget,
            weeklyTarget: data.settings.weeklyTarget,
            monthlyTarget: data.settings.monthlyTarget,
            quarterlyTarget: data.settings.quarterlyTarget,
            yearlyTarget: data.settings.yearlyTarget,
          });
          setEditSettings({
            dailyTarget: data.settings.dailyTarget,
            weeklyTarget: data.settings.weeklyTarget,
            monthlyTarget: data.settings.monthlyTarget,
            quarterlyTarget: data.settings.quarterlyTarget,
            yearlyTarget: data.settings.yearlyTarget,
          });
        }
        
        const transformedGoals: SalesGoal[] = [
          {
            period: 'daily',
            target: data.daily.target,
            current: data.daily.current,
            percentage: data.daily.percentage,
            remaining: data.daily.remaining,
            onTrack: data.daily.onTrack,
          },
          {
            period: 'weekly',
            target: data.weekly.target,
            current: data.weekly.current,
            percentage: data.weekly.percentage,
            remaining: data.weekly.remaining,
            onTrack: data.weekly.onTrack,
          },
          {
            period: 'monthly',
            target: data.monthly.target,
            current: data.monthly.current,
            percentage: data.monthly.percentage,
            remaining: data.monthly.remaining,
            onTrack: data.monthly.onTrack,
          },
          {
            period: 'quarterly',
            target: data.quarterly.target,
            current: data.quarterly.current,
            percentage: data.quarterly.percentage,
            remaining: data.quarterly.remaining,
          },
          {
            period: 'yearly',
            target: data.yearly.target,
            current: data.yearly.current,
            percentage: data.yearly.percentage,
            remaining: data.yearly.remaining,
          },
        ];

        setGoalsData(transformedGoals);
        setStreak(data.streak || 0);
      }
    } catch (error) {
      console.error('Error fetching sales goals:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesData();
    const interval = setInterval(fetchSalesData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchSalesData]);

  const handleSaveGoals = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const response = await fetch('/api/admin/sales/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editSettings),
      });

      if (response.ok) {
        const savedGoals = await response.json();
        // Update both settings and editSettings with the saved data
        const newSettings = {
          dailyTarget: savedGoals.dailyTarget,
          weeklyTarget: savedGoals.weeklyTarget,
          monthlyTarget: savedGoals.monthlyTarget,
          quarterlyTarget: savedGoals.quarterlyTarget,
          yearlyTarget: savedGoals.yearlyTarget,
        };
        setSettings(newSettings);
        setEditSettings(newSettings);
        setIsEditing(false);
        setSaveSuccess(true);
        // Refresh the goals data from API
        await fetchSalesData();
        onGoalsUpdated?.();
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save goals');
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Failed to save goals');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset edit form to current saved settings
    setEditSettings({ ...settings });
    setIsEditing(false);
  };

  // When entering edit mode, sync editSettings with current settings
  const handleStartEdit = () => {
    setEditSettings({ ...settings });
    setIsEditing(true);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-gradient-to-r from-green-500 to-emerald-500';
    if (percentage >= 75) return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    if (percentage >= 50) return 'bg-gradient-to-r from-yellow-500 to-amber-500';
    return 'bg-gradient-to-r from-red-500 to-orange-500';
  };

  const getMotivationalMessage = (percentage: number) => {
    if (percentage >= 100) return '🎉 Goal crushed!';
    if (percentage >= 90) return '🔥 Almost there!';
    if (percentage >= 75) return '💪 Keep pushing!';
    if (percentage >= 50) return '📈 Halfway there!';
    if (percentage >= 25) return '🚀 Good start!';
    return '⚡ Let\'s go!';
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case 'daily':
        return Calendar;
      case 'weekly':
        return TrendUp;
      case 'monthly':
        return Target;
      case 'quarterly':
        return CalendarBlank;
      case 'yearly':
        return ChartLineUp;
      default:
        return Target;
    }
  };

  const getPeriodColor = (period: string) => {
    switch (period) {
      case 'daily':
        return 'from-blue-500 to-blue-600';
      case 'weekly':
        return 'from-purple-500 to-purple-600';
      case 'monthly':
        return 'from-pink-500 to-pink-600';
      case 'quarterly':
        return 'from-amber-500 to-amber-600';
      case 'yearly':
        return 'from-emerald-500 to-emerald-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-white/10 w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white/5"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Filter goals for display (compact shows only daily/weekly/monthly)
  const displayGoals = compact 
    ? goalsData.filter(g => ['daily', 'weekly', 'monthly'].includes(g.period))
    : goalsData;

  return (
    <div className="overflow-hidden">
      {/* Success Banner */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-emerald-500/20 border-b border-emerald-500/30 px-5 py-2 flex items-center gap-2"
          >
            <CheckCircle size={16} weight="fill" className="text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Goals saved!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10">
              <Target size={18} weight="bold" className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-medium tracking-[0.1em] text-white uppercase">Sales Goals</h3>
              <p className="text-xs text-white/40">Track your targets</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30"
              >
                <Flame size={16} weight="fill" className="text-amber-400" />
                <div className="text-right">
                  <div className="text-[10px] text-amber-400 font-medium uppercase tracking-wide">Streak</div>
                  <div className="text-sm font-bold text-amber-400">{streak} days</div>
                </div>
              </motion.div>
            )}
            {showEditButton && (
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSalesData}
                  className="p-1.5 hover:bg-white/10 transition-colors"
                  title="Refresh data"
                >
                  <ArrowClockwise size={16} className="text-white/40" />
                </button>
                {!isEditing ? (
                  <button
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black hover:bg-white/90 transition-colors font-medium text-xs uppercase tracking-wide"
                  >
                    <PencilSimple size={12} weight="bold" />
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-2 py-1.5 bg-white/10 text-white hover:bg-white/20 transition-colors text-xs uppercase tracking-wide"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveGoals}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400 transition-colors font-medium text-xs uppercase tracking-wide disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Spinner size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} weight="bold" />
                      )}
                      Save
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Panel */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-white/5 border-b border-white/10">
              <h4 className="text-[10px] font-medium tracking-[0.15em] text-white/40 uppercase mb-3">Edit Goal Targets</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { key: 'dailyTarget', label: 'Daily', icon: Calendar },
                  { key: 'weeklyTarget', label: 'Weekly', icon: TrendUp },
                  { key: 'monthlyTarget', label: 'Monthly', icon: Target },
                  { key: 'quarterlyTarget', label: 'Quarterly', icon: CalendarBlank },
                  { key: 'yearlyTarget', label: 'Yearly', icon: ChartLineUp },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key} className="space-y-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-medium text-white/40 uppercase tracking-wide">
                      <Icon size={12} />
                      {label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs">$</span>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={editSettings[key as keyof GoalSettings]}
                        onChange={(e) => setEditSettings(prev => ({
                          ...prev,
                          [key]: parseFloat(e.target.value) || 0
                        }))}
                        className="w-full pl-6 pr-2 py-1.5 bg-white/5 border border-white/10 text-white text-xs focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals List */}
      <div className="p-5 space-y-4">
        {displayGoals.map((goal, index) => {
          const Icon = getPeriodIcon(goal.period);
          const progressColor = getProgressColor(goal.percentage);
          const periodColor = getPeriodColor(goal.period);
          const message = getMotivationalMessage(goal.percentage);

          return (
            <motion.div
              key={goal.period}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="space-y-2 p-4 bg-white/5 hover:bg-white/[0.07] transition-colors border border-white/5"
            >
              {/* Goal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 bg-gradient-to-br ${periodColor}`}>
                    <Icon size={14} weight="bold" className="text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white text-sm capitalize">
                      {goal.period}
                    </h4>
                    <p className="text-[10px] text-white/40">{message}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-lg font-bold text-white">
                    <CurrencyDollar size={16} weight="bold" className="text-white/50" />
                    {goal.current.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-white/40">
                    of ${goal.target.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white/60">
                    {Math.min(100, goal.percentage).toFixed(1)}%
                  </span>
                  {goal.remaining > 0 && (
                    <span className="text-white/40">
                      ${goal.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })} to go
                    </span>
                  )}
                </div>
                <div className="h-2 bg-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, goal.percentage)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full ${progressColor} relative`}
                  >
                    {goal.percentage >= 100 && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                      >
                        <Trophy size={10} weight="fill" className="text-white drop-shadow" />
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Status Badge */}
              {goal.onTrack !== undefined && (
                <div className="flex items-center gap-2">
                  {goal.onTrack ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium uppercase tracking-wide">
                      <TrendUp size={10} weight="bold" />
                      <span>On Track</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-medium uppercase tracking-wide">
                      <Target size={10} weight="bold" />
                      <span>Needs Push</span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="px-5 py-3 bg-white/5 border-t border-white/10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">
            {goalsData.filter(g => g.percentage >= 100).length > 0
              ? `🎯 ${goalsData.filter(g => g.percentage >= 100).length}/${goalsData.length} goals hit`
              : '💪 Keep pushing!'}
          </p>
          {!compact && goalsData.length > 0 && (
            <div className="text-xs text-white/30">
              Avg: {(goalsData.reduce((acc, g) => acc + g.percentage, 0) / goalsData.length).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
