import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')

  if (!input) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not configured')
    return NextResponse.json({ predictions: [] })
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&components=country:us&key=${apiKey}`
    )

    if (!response.ok) {
      console.error('Google Places API error:', response.status)
      return NextResponse.json({ predictions: [] })
    }

    const data = await response.json()

    const predictions = (data.predictions || []).map((prediction: {
      place_id: string
      description: string
      structured_formatting: {
        main_text: string
        secondary_text: string
      }
    }) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      mainText: prediction.structured_formatting?.main_text || prediction.description,
      secondaryText: prediction.structured_formatting?.secondary_text || '',
    }))

    return NextResponse.json({ predictions })
  } catch (error) {
    console.error('Error fetching place suggestions:', error)
    return NextResponse.json({ predictions: [] })
  }
}
