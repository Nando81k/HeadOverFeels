import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('placeId')

  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not configured')
    return NextResponse.json({ error: 'API not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,formatted_address&key=${apiKey}`
    )

    if (!response.ok) {
      console.error('Google Places API error:', response.status)
      return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.result

    if (!result) {
      return NextResponse.json({ error: 'Place not found' }, { status: 404 })
    }

    // Parse address components
    const components = result.address_components || []
    
    let streetNumber = ''
    let streetName = ''
    let city = ''
    let state = ''
    let zipCode = ''
    let country = 'United States'

    for (const component of components) {
      const types = component.types || []
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name
      }
      if (types.includes('route')) {
        streetName = component.long_name
      }
      if (types.includes('locality')) {
        city = component.long_name
      }
      if (types.includes('sublocality_level_1') && !city) {
        city = component.long_name
      }
      if (types.includes('administrative_area_level_1')) {
        state = component.short_name // Use short name for state (e.g., "CA")
      }
      if (types.includes('postal_code')) {
        zipCode = component.long_name
      }
      if (types.includes('country')) {
        country = component.long_name
      }
    }

    const address = streetNumber && streetName 
      ? `${streetNumber} ${streetName}`
      : streetName || result.formatted_address?.split(',')[0] || ''

    return NextResponse.json({
      address,
      city,
      state,
      zipCode,
      country,
      formattedAddress: result.formatted_address,
    })
  } catch (error) {
    console.error('Error fetching place details:', error)
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 })
  }
}
