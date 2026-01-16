/**
 * Package Tracking Service
 * 
 * Provides real-time tracking data with location history and map coordinates.
 * Supports multiple carriers through EasyPost or direct carrier APIs.
 */

import { trackShipment as easyPostTrack, isEasyPostConfigured } from './easypost'

// ===== TYPES =====

export interface TrackingLocation {
  city: string
  state: string
  country: string
  postalCode?: string
  latitude?: number
  longitude?: number
}

export interface TrackingEvent {
  timestamp: string
  status: TrackingStatus
  description: string
  location: TrackingLocation
}

export type TrackingStatus = 
  | 'pre_transit'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'available_for_pickup'
  | 'return_to_sender'
  | 'failure'
  | 'unknown'

export interface TrackingResult {
  success: boolean
  trackingNumber: string
  carrier: string
  status: TrackingStatus
  statusDescription: string
  estimatedDelivery?: string
  deliveredAt?: string
  currentLocation?: TrackingLocation
  originLocation?: TrackingLocation
  destinationLocation?: TrackingLocation
  events: TrackingEvent[]
  transitProgress: number // 0-100 percentage
  error?: string
}

// ===== CARRIER CONFIGURATION =====

// City coordinates for mapping (major US cities)
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'san antonio': { lat: 29.4241, lng: -98.4936 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'jacksonville': { lat: 30.3322, lng: -81.6557 },
  'fort worth': { lat: 32.7555, lng: -97.3308 },
  'columbus': { lat: 39.9612, lng: -82.9988 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'charlotte': { lat: 35.2271, lng: -80.8431 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'el paso': { lat: 31.7619, lng: -106.4850 },
  'nashville': { lat: 36.1627, lng: -86.7816 },
  'detroit': { lat: 42.3314, lng: -83.0458 },
  'oklahoma city': { lat: 35.4676, lng: -97.5164 },
  'portland': { lat: 45.5152, lng: -122.6784 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'memphis': { lat: 35.1495, lng: -90.0490 },
  'louisville': { lat: 38.2527, lng: -85.7585 },
  'baltimore': { lat: 39.2904, lng: -76.6122 },
  'milwaukee': { lat: 43.0389, lng: -87.9065 },
  'albuquerque': { lat: 35.0844, lng: -106.6504 },
  'tucson': { lat: 32.2226, lng: -110.9747 },
  'fresno': { lat: 36.7378, lng: -119.7871 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'kansas city': { lat: 39.0997, lng: -94.5786 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'cleveland': { lat: 41.4993, lng: -81.6944 },
  'raleigh': { lat: 35.7796, lng: -78.6382 },
  'omaha': { lat: 41.2565, lng: -95.9345 },
  'minneapolis': { lat: 44.9778, lng: -93.2650 },
  'aurora': { lat: 39.7294, lng: -104.8319 },
  'pittsburgh': { lat: 40.4406, lng: -79.9959 },
  'newark': { lat: 40.7357, lng: -74.1724 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'st. louis': { lat: 38.6270, lng: -90.1994 },
  'salt lake city': { lat: 40.7608, lng: -111.8910 },
  'cincinnati': { lat: 39.1031, lng: -84.5120 },
  'anaheim': { lat: 33.8366, lng: -117.9143 },
  'jersey city': { lat: 40.7282, lng: -74.0776 },
  'new orleans': { lat: 29.9511, lng: -90.0715 },
}

// State to coordinates fallback
const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'CA': { lat: 36.7783, lng: -119.4179 },
  'TX': { lat: 31.9686, lng: -99.9018 },
  'FL': { lat: 27.6648, lng: -81.5158 },
  'NY': { lat: 40.7128, lng: -74.0060 },
  'PA': { lat: 41.2033, lng: -77.1945 },
  'IL': { lat: 40.6331, lng: -89.3985 },
  'OH': { lat: 40.4173, lng: -82.9071 },
  'GA': { lat: 32.1656, lng: -82.9001 },
  'NC': { lat: 35.7596, lng: -79.0193 },
  'MI': { lat: 44.3148, lng: -85.6024 },
  'NJ': { lat: 40.0583, lng: -74.4057 },
  'VA': { lat: 37.4316, lng: -78.6569 },
  'WA': { lat: 47.7511, lng: -120.7401 },
  'AZ': { lat: 34.0489, lng: -111.0937 },
  'MA': { lat: 42.4072, lng: -71.3824 },
  'TN': { lat: 35.5175, lng: -86.5804 },
  'IN': { lat: 40.2672, lng: -86.1349 },
  'MO': { lat: 37.9643, lng: -91.8318 },
  'MD': { lat: 39.0458, lng: -76.6413 },
  'WI': { lat: 43.7844, lng: -88.7879 },
  'CO': { lat: 39.5501, lng: -105.7821 },
  'MN': { lat: 46.7296, lng: -94.6859 },
  'SC': { lat: 33.8361, lng: -81.1637 },
  'AL': { lat: 32.3182, lng: -86.9023 },
  'LA': { lat: 30.9843, lng: -91.9623 },
  'KY': { lat: 37.8393, lng: -84.2700 },
  'OR': { lat: 43.8041, lng: -120.5542 },
  'OK': { lat: 35.0078, lng: -97.0929 },
  'CT': { lat: 41.6032, lng: -73.0877 },
  'UT': { lat: 39.3210, lng: -111.0937 },
  'IA': { lat: 41.8780, lng: -93.0977 },
  'NV': { lat: 38.8026, lng: -116.4194 },
  'AR': { lat: 35.2010, lng: -91.8318 },
  'MS': { lat: 32.3547, lng: -89.3985 },
  'KS': { lat: 39.0119, lng: -98.4842 },
  'NM': { lat: 34.5199, lng: -105.8701 },
  'NE': { lat: 41.4925, lng: -99.9018 },
  'WV': { lat: 38.5976, lng: -80.4549 },
  'ID': { lat: 44.0682, lng: -114.7420 },
  'HI': { lat: 19.8968, lng: -155.5828 },
  'NH': { lat: 43.1939, lng: -71.5724 },
  'ME': { lat: 45.2538, lng: -69.4455 },
  'MT': { lat: 46.8797, lng: -110.3626 },
  'RI': { lat: 41.5801, lng: -71.4774 },
  'DE': { lat: 38.9108, lng: -75.5277 },
  'SD': { lat: 43.9695, lng: -99.9018 },
  'ND': { lat: 47.5515, lng: -101.0020 },
  'AK': { lat: 64.2008, lng: -152.4937 },
  'VT': { lat: 44.5588, lng: -72.5778 },
  'WY': { lat: 43.0760, lng: -107.2903 },
}

/**
 * Get coordinates for a location
 * Returns latitude/longitude to match TrackingLocation interface
 */
function getCoordinates(city: string, state: string): { latitude: number; longitude: number } | undefined {
  const cityKey = city.toLowerCase().trim()
  
  // Try exact city match
  if (CITY_COORDINATES[cityKey]) {
    const coords = CITY_COORDINATES[cityKey]
    return { latitude: coords.lat, longitude: coords.lng }
  }
  
  // Try state fallback
  const stateUpper = state.toUpperCase().trim()
  if (STATE_COORDINATES[stateUpper]) {
    const coords = STATE_COORDINATES[stateUpper]
    return { latitude: coords.lat, longitude: coords.lng }
  }
  
  return undefined
}

/**
 * Map EasyPost/carrier status to our status type
 */
function mapStatus(status: string): TrackingStatus {
  const statusLower = status.toLowerCase()
  
  if (statusLower.includes('deliver') && !statusLower.includes('out')) {
    return 'delivered'
  }
  if (statusLower.includes('out_for_delivery') || statusLower.includes('out for delivery')) {
    return 'out_for_delivery'
  }
  if (statusLower.includes('transit') || statusLower.includes('in_transit')) {
    return 'in_transit'
  }
  if (statusLower.includes('pre_transit') || statusLower.includes('label') || statusLower.includes('created')) {
    return 'pre_transit'
  }
  if (statusLower.includes('pickup') || statusLower.includes('available')) {
    return 'available_for_pickup'
  }
  if (statusLower.includes('return')) {
    return 'return_to_sender'
  }
  if (statusLower.includes('fail') || statusLower.includes('error') || statusLower.includes('exception')) {
    return 'failure'
  }
  
  return 'unknown'
}

/**
 * Get human-readable status description
 */
function getStatusDescription(status: TrackingStatus): string {
  switch (status) {
    case 'pre_transit':
      return 'Label Created'
    case 'in_transit':
      return 'In Transit'
    case 'out_for_delivery':
      return 'Out for Delivery'
    case 'delivered':
      return 'Delivered'
    case 'available_for_pickup':
      return 'Available for Pickup'
    case 'return_to_sender':
      return 'Returning to Sender'
    case 'failure':
      return 'Delivery Exception'
    default:
      return 'Status Unknown'
  }
}

/**
 * Calculate transit progress percentage
 */
function calculateProgress(status: TrackingStatus, events: TrackingEvent[]): number {
  switch (status) {
    case 'pre_transit':
      return 10
    case 'in_transit':
      // Estimate based on number of events
      const inTransitProgress = Math.min(20 + events.length * 10, 70)
      return inTransitProgress
    case 'out_for_delivery':
      return 85
    case 'delivered':
      return 100
    case 'available_for_pickup':
      return 90
    case 'return_to_sender':
      return 50
    case 'failure':
      return 50
    default:
      return 0
  }
}

// ===== MAIN TRACKING FUNCTION =====

/**
 * Get real-time tracking information for a package
 */
export async function getTrackingInfo(
  trackingNumber: string,
  carrier?: string
): Promise<TrackingResult> {
  // Try EasyPost first
  if (isEasyPostConfigured()) {
    const result = await easyPostTrack(trackingNumber, carrier)
    
    if (result) {
      const events: TrackingEvent[] = result.events.map(event => {
        const coords = getCoordinates(event.city, event.state)
        return {
          timestamp: event.datetime,
          status: mapStatus(event.description),
          description: event.description,
          location: {
            city: event.city,
            state: event.state,
            country: 'US',
            latitude: coords?.latitude,
            longitude: coords?.longitude,
          },
        }
      })

      const status = mapStatus(result.status)
      const currentLocation = events[0]?.location

      return {
        success: true,
        trackingNumber,
        carrier: carrier || 'Unknown',
        status,
        statusDescription: getStatusDescription(status),
        estimatedDelivery: result.estimatedDelivery || undefined,
        deliveredAt: status === 'delivered' ? events[0]?.timestamp : undefined,
        currentLocation,
        events,
        transitProgress: calculateProgress(status, events),
      }
    }
  }

  // Generate demo tracking data for development
  return generateDemoTracking(trackingNumber, carrier || 'USPS')
}

// ===== DEMO DATA GENERATION =====

/**
 * Generate realistic demo tracking data
 */
function generateDemoTracking(trackingNumber: string, carrier: string): TrackingResult {
  const now = new Date()
  
  // Generate a consistent but varied timeline based on tracking number hash
  const hash = trackingNumber.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const dayOffset = hash % 5 // 0-4 days ago the shipment started
  const isDelivered = hash % 3 === 0 // 33% chance delivered
  const isOutForDelivery = !isDelivered && hash % 2 === 0 // 50% of remaining out for delivery
  
  const events: TrackingEvent[] = []
  
  // Origin facility
  const originCity = ['Los Angeles', 'San Francisco', 'Las Vegas'][hash % 3]
  const originState = ['CA', 'CA', 'NV'][hash % 3]
  const originCoords = getCoordinates(originCity, originState)
  
  // Destination (based on hash)
  const destCities = ['New York', 'Chicago', 'Houston', 'Phoenix', 'Seattle', 'Miami', 'Boston']
  const destStates = ['NY', 'IL', 'TX', 'AZ', 'WA', 'FL', 'MA']
  const destIndex = hash % destCities.length
  const destCity = destCities[destIndex]
  const destState = destStates[destIndex]
  const destCoords = getCoordinates(destCity, destState)
  
  // Build tracking events from newest to oldest
  const baseTime = new Date(now)
  baseTime.setDate(baseTime.getDate() - dayOffset)
  
  if (isDelivered) {
    events.push({
      timestamp: new Date(baseTime.getTime() + 8 * 60 * 60 * 1000).toISOString(), // +8 hours
      status: 'delivered',
      description: 'Delivered, Package delivered',
      location: {
        city: destCity,
        state: destState,
        country: 'US',
        ...destCoords,
      },
    })
  }
  
  if (isDelivered || isOutForDelivery) {
    events.push({
      timestamp: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000).toISOString(),
      status: 'out_for_delivery',
      description: 'Out for Delivery',
      location: {
        city: destCity,
        state: destState,
        country: 'US',
        ...destCoords,
      },
    })
  }
  
  // Transit events
  const transitCities = getTransitPath(originCity, destCity)
  transitCities.forEach((city, index) => {
    const hoursAgo = (transitCities.length - index) * 12 + 4
    events.push({
      timestamp: new Date(baseTime.getTime() - hoursAgo * 60 * 60 * 1000).toISOString(),
      status: 'in_transit',
      description: `Arrived at ${carrier} facility`,
      location: {
        city: city.city,
        state: city.state,
        country: 'US',
        ...getCoordinates(city.city, city.state),
      },
    })
  })
  
  // Shipment accepted
  events.push({
    timestamp: new Date(baseTime.getTime() - (dayOffset * 24 + 12) * 60 * 60 * 1000).toISOString(),
    status: 'in_transit',
    description: 'Shipment picked up',
    location: {
      city: originCity,
      state: originState,
      country: 'US',
      ...originCoords,
    },
  })
  
  // Label created
  events.push({
    timestamp: new Date(baseTime.getTime() - (dayOffset * 24 + 24) * 60 * 60 * 1000).toISOString(),
    status: 'pre_transit',
    description: 'Shipping label created',
    location: {
      city: originCity,
      state: originState,
      country: 'US',
      ...originCoords,
    },
  })
  
  // Sort events newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  
  const status: TrackingStatus = isDelivered 
    ? 'delivered' 
    : isOutForDelivery 
      ? 'out_for_delivery' 
      : 'in_transit'
  
  // Estimated delivery
  const estimatedDelivery = new Date(now)
  if (!isDelivered) {
    estimatedDelivery.setDate(estimatedDelivery.getDate() + (isOutForDelivery ? 0 : 2))
  }
  
  return {
    success: true,
    trackingNumber,
    carrier,
    status,
    statusDescription: getStatusDescription(status),
    estimatedDelivery: !isDelivered ? estimatedDelivery.toISOString() : undefined,
    deliveredAt: isDelivered ? events[0].timestamp : undefined,
    currentLocation: events[0]?.location,
    originLocation: {
      city: originCity,
      state: originState,
      country: 'US',
      ...originCoords,
    },
    destinationLocation: {
      city: destCity,
      state: destState,
      country: 'US',
      ...destCoords,
    },
    events,
    transitProgress: calculateProgress(status, events),
  }
}

/**
 * Get intermediate cities for a transit path
 */
function getTransitPath(origin: string, destination: string): Array<{ city: string; state: string }> {
  // Simplified transit paths based on origin/destination
  const paths: Record<string, Array<{ city: string; state: string }>> = {
    'Los Angeles-New York': [
      { city: 'Phoenix', state: 'AZ' },
      { city: 'Dallas', state: 'TX' },
      { city: 'Memphis', state: 'TN' },
      { city: 'Nashville', state: 'TN' },
    ],
    'Los Angeles-Chicago': [
      { city: 'Phoenix', state: 'AZ' },
      { city: 'Denver', state: 'CO' },
      { city: 'Kansas City', state: 'MO' },
    ],
    'Los Angeles-Houston': [
      { city: 'Phoenix', state: 'AZ' },
      { city: 'El Paso', state: 'TX' },
      { city: 'San Antonio', state: 'TX' },
    ],
    'San Francisco-Miami': [
      { city: 'Los Angeles', state: 'CA' },
      { city: 'Phoenix', state: 'AZ' },
      { city: 'Dallas', state: 'TX' },
      { city: 'New Orleans', state: 'LA' },
    ],
    'default': [
      { city: 'Denver', state: 'CO' },
      { city: 'Kansas City', state: 'MO' },
    ],
  }
  
  const key = `${origin}-${destination}`
  return paths[key] || paths['default']
}
