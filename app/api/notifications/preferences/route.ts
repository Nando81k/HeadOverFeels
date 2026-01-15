import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications/service'

// GET /api/notifications/preferences - Get customer notification preferences
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get('auth_session')?.value
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await getNotificationPreferences(sessionId)
    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

// PUT /api/notifications/preferences - Update customer notification preferences
export async function PUT(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('auth_session')?.value
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { preferences } = body

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Invalid preferences data' },
        { status: 400 }
      )
    }

    // Validate that only allowed keys are present
    const allowedKeys = [
      'inAppPointsEarned',
      'inAppTierUpdates',
      'inAppOrderUpdates',
      'inAppPromotions',
      'inAppDropAlerts',
      'inAppRewardReminders',
      'emailPointsEarned',
      'emailTierUpdates',
      'emailOrderUpdates',
      'emailPromotions',
      'emailDropAlerts',
      'emailRewardReminders',
      'emailPointsExpiring',
      'emailBirthdayBonus',
      'smsOrderUpdates',
      'smsDropAlerts',
    ]

    const filteredPrefs: Record<string, boolean> = {}
    for (const key of allowedKeys) {
      if (key in preferences && typeof preferences[key] === 'boolean') {
        filteredPrefs[key] = preferences[key]
      }
    }

    const updatedPreferences = await updateNotificationPreferences(
      sessionId,
      filteredPrefs
    )

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences,
    })
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}
