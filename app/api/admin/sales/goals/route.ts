import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

// Valid order statuses for revenue calculation
const VALID_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

// Default goals if none exist
const DEFAULT_GOALS = {
  id: 'default',
  dailyTarget: 500,
  weeklyTarget: 3500,
  monthlyTarget: 15000,
  quarterlyTarget: 45000,
  yearlyTarget: 180000,
};

// Get or create goals settings
async function getGoalsSettings() {
  let goals = await prisma.salesGoals.findUnique({
    where: { id: 'default' }
  });

  if (!goals) {
    goals = await prisma.salesGoals.create({
      data: DEFAULT_GOALS
    });
  }

  return goals;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get goals from database
    const goalsSettings = await getGoalsSettings();

    // Get current date/time info
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start on Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Quarterly
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
    
    // Yearly
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Calculate expected progress for "on track" calculation
    const hoursInDay = 24;
    const currentHour = now.getHours();
    const dailyProgress = currentHour / hoursInDay;

    const daysInWeek = 7;
    const currentDayOfWeek = now.getDay() + 1;
    const weeklyProgress = currentDayOfWeek / daysInWeek;

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDayOfMonth = now.getDate();
    const monthlyProgress = currentDayOfMonth / daysInMonth;

    // Get daily sales
    const dailySales = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfDay },
        status: { in: VALID_STATUSES },
      },
      _sum: { total: true },
    });

    // Get weekly sales
    const weeklySales = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfWeek },
        status: { in: VALID_STATUSES },
      },
      _sum: { total: true },
    });

    // Get monthly sales
    const monthlySales = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: VALID_STATUSES },
      },
      _sum: { total: true },
    });

    // Get quarterly sales
    const quarterlySales = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfQuarter },
        status: { in: VALID_STATUSES },
      },
      _sum: { total: true },
    });

    // Get yearly sales
    const yearlySales = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfYear },
        status: { in: VALID_STATUSES },
      },
      _sum: { total: true },
    });

    // Calculate streak (days goals were met)
    const streak = await calculateStreak(goalsSettings.dailyTarget);

    // Get recent goal history
    const recentHistory = await prisma.salesGoalHistory.findMany({
      where: { salesGoalsId: 'default' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Calculate expected values based on time progress
    const dailyCurrent = dailySales._sum?.total || 0;
    const weeklyCurrent = weeklySales._sum?.total || 0;
    const monthlyCurrent = monthlySales._sum?.total || 0;
    const quarterlyCurrent = quarterlySales._sum?.total || 0;
    const yearlyCurrent = yearlySales._sum?.total || 0;

    return NextResponse.json({
      settings: goalsSettings,
      daily: {
        current: dailyCurrent,
        target: goalsSettings.dailyTarget,
        expected: goalsSettings.dailyTarget * dailyProgress,
        percentage: (dailyCurrent / goalsSettings.dailyTarget) * 100,
        remaining: Math.max(0, goalsSettings.dailyTarget - dailyCurrent),
        onTrack: dailyCurrent >= goalsSettings.dailyTarget * dailyProgress,
      },
      weekly: {
        current: weeklyCurrent,
        target: goalsSettings.weeklyTarget,
        expected: goalsSettings.weeklyTarget * weeklyProgress,
        percentage: (weeklyCurrent / goalsSettings.weeklyTarget) * 100,
        remaining: Math.max(0, goalsSettings.weeklyTarget - weeklyCurrent),
        onTrack: weeklyCurrent >= goalsSettings.weeklyTarget * weeklyProgress,
      },
      monthly: {
        current: monthlyCurrent,
        target: goalsSettings.monthlyTarget,
        expected: goalsSettings.monthlyTarget * monthlyProgress,
        percentage: (monthlyCurrent / goalsSettings.monthlyTarget) * 100,
        remaining: Math.max(0, goalsSettings.monthlyTarget - monthlyCurrent),
        onTrack: monthlyCurrent >= goalsSettings.monthlyTarget * monthlyProgress,
      },
      quarterly: {
        current: quarterlyCurrent,
        target: goalsSettings.quarterlyTarget,
        percentage: (quarterlyCurrent / goalsSettings.quarterlyTarget) * 100,
        remaining: Math.max(0, goalsSettings.quarterlyTarget - quarterlyCurrent),
      },
      yearly: {
        current: yearlyCurrent,
        target: goalsSettings.yearlyTarget,
        percentage: (yearlyCurrent / goalsSettings.yearlyTarget) * 100,
        remaining: Math.max(0, goalsSettings.yearlyTarget - yearlyCurrent),
      },
      streak,
      history: recentHistory,
    });
  } catch (error) {
    console.error('Error fetching sales goals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales goals' },
      { status: 500 }
    );
  }
}

// PUT - Update goals settings
export async function PUT(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate inputs
    const updates: Record<string, number> = {};
    
    if (body.dailyTarget !== undefined) {
      if (body.dailyTarget < 0) {
        return NextResponse.json({ error: 'Daily target must be non-negative' }, { status: 400 });
      }
      updates.dailyTarget = body.dailyTarget;
    }
    
    if (body.weeklyTarget !== undefined) {
      if (body.weeklyTarget < 0) {
        return NextResponse.json({ error: 'Weekly target must be non-negative' }, { status: 400 });
      }
      updates.weeklyTarget = body.weeklyTarget;
    }
    
    if (body.monthlyTarget !== undefined) {
      if (body.monthlyTarget < 0) {
        return NextResponse.json({ error: 'Monthly target must be non-negative' }, { status: 400 });
      }
      updates.monthlyTarget = body.monthlyTarget;
    }
    
    if (body.quarterlyTarget !== undefined) {
      if (body.quarterlyTarget < 0) {
        return NextResponse.json({ error: 'Quarterly target must be non-negative' }, { status: 400 });
      }
      updates.quarterlyTarget = body.quarterlyTarget;
    }
    
    if (body.yearlyTarget !== undefined) {
      if (body.yearlyTarget < 0) {
        return NextResponse.json({ error: 'Yearly target must be non-negative' }, { status: 400 });
      }
      updates.yearlyTarget = body.yearlyTarget;
    }

    // Upsert goals
    const goals = await prisma.salesGoals.upsert({
      where: { id: 'default' },
      update: updates,
      create: {
        ...DEFAULT_GOALS,
        ...updates,
      },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error updating sales goals:', error);
    return NextResponse.json(
      { error: 'Failed to update sales goals' },
      { status: 500 }
    );
  }
}

// Helper function to calculate streak of days meeting goals
async function calculateStreak(dailyGoal: number): Promise<number> {
  try {
    const now = new Date();
    let streak = 0;

    // Check last 30 days
    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() - i);
      const startOfDay = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate()
      );
      const endOfDay = new Date(
        checkDate.getFullYear(),
        checkDate.getMonth(),
        checkDate.getDate() + 1
      );

      const daySales = await prisma.order.aggregate({
        where: {
          createdAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: {
            in: VALID_STATUSES,
          },
        },
        _sum: {
          total: true,
        },
      });

      const total = daySales._sum?.total || 0;

      // If goal was met, increment streak
      if (total >= dailyGoal) {
        streak++;
      } else {
        // Streak broken
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Error calculating streak:', error);
    return 0;
  }
}
