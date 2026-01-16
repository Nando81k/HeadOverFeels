'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { TrackingLocation } from '@/lib/shipping/tracking'
import 'leaflet/dist/leaflet.css'

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)

interface TrackingMapProps {
  origin?: TrackingLocation
  destination?: TrackingLocation
  currentLocation?: TrackingLocation
  events?: Array<{ location: TrackingLocation }>
  status: string
  compact?: boolean
}

// Map status to colors
const STATUS_COLORS: Record<string, string> = {
  pre_transit: '#6b7280',
  in_transit: '#3b82f6',
  out_for_delivery: '#f59e0b',
  delivered: '#10b981',
  available_for_pickup: '#8b5cf6',
  return_to_sender: '#ef4444',
  failure: '#ef4444',
  unknown: '#6b7280',
}

export function TrackingMap({ 
  origin, 
  destination, 
  currentLocation,
  events = [],
  status,
  compact = false
}: TrackingMapProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.unknown

  // Only render on client side
  useEffect(() => {
    setIsMounted(true)
    import('leaflet').then((leaflet) => {
      setL(leaflet)
    })
  }, [])

  // Collect all points with valid coordinates
  const points = useMemo(() => {
    const result: Array<{ lat: number; lng: number; type: 'origin' | 'destination' | 'current' | 'transit'; label?: string }> = []
    
    if (origin?.latitude && origin?.longitude) {
      result.push({ lat: origin.latitude, lng: origin.longitude, type: 'origin', label: origin.city || 'Origin' })
    }
    
    if (destination?.latitude && destination?.longitude) {
      result.push({ lat: destination.latitude, lng: destination.longitude, type: 'destination', label: destination.city || 'Destination' })
    }
    
    if (currentLocation?.latitude && currentLocation?.longitude) {
      result.push({ lat: currentLocation.latitude, lng: currentLocation.longitude, type: 'current', label: currentLocation.city || 'Current Location' })
    }
    
    // Add transit points from events
    events.forEach(event => {
      if (event.location?.latitude && event.location?.longitude) {
        const exists = result.some(p => 
          Math.abs(p.lat - event.location.latitude!) < 0.1 && 
          Math.abs(p.lng - event.location.longitude!) < 0.1
        )
        if (!exists) {
          result.push({ 
            lat: event.location.latitude, 
            lng: event.location.longitude, 
            type: 'transit',
            label: event.location.city || 'Transit'
          })
        }
      }
    })
    
    return result
  }, [origin, destination, currentLocation, events])

  // Create icons
  const icons = useMemo(() => {
    if (!L) return null

    const createIcon = (color: string, size: number = 32) => {
      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: ${size - 14}px;
              height: ${size - 14}px;
              background: white;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      })
    }

    const createPulsingIcon = (color: string) => {
      return L.divIcon({
        className: 'pulsing-marker',
        html: `
          <div style="position: relative; width: 40px; height: 40px;">
            <div class="pulse-ring" style="
              position: absolute;
              width: 40px;
              height: 40px;
              background: ${color}40;
              border-radius: 50%;
              animation: pulse 2s ease-out infinite;
              top: 0;
              left: 0;
            "></div>
            <div style="
              position: absolute;
              width: 24px;
              height: 24px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 10px ${color}80;
              top: 8px;
              left: 8px;
            ">
              <div style="
                width: 8px;
                height: 8px;
                background: white;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
              "></div>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20],
      })
    }

    const createHomeIcon = () => {
      return L.divIcon({
        className: 'home-marker',
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: #10b981;
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 10px rgba(16, 185, 129, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg style="transform: rotate(45deg); width: 16px; height: 16px;" viewBox="0 0 24 24" fill="white">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      })
    }

    return {
      origin: createIcon('#64748b', 28),
      destination: createHomeIcon(),
      current: createPulsingIcon(statusColor),
      transit: createIcon('#94a3b8', 22),
    }
  }, [L, statusColor])

  // If not mounted or no valid points, show placeholder
  if (!isMounted || !L || points.length < 2) {
    return (
      <div className="relative w-full h-full min-h-[300px] bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-slate-800 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">Live tracking map</p>
          <p className="text-slate-600 text-xs mt-1">Available once shipment is in transit</p>
        </div>
      </div>
    )
  }

  // Calculate bounds
  const lats = points.map(p => p.lat)
  const lngs = points.map(p => p.lng)
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lats) - 1, Math.min(...lngs) - 1],
    [Math.max(...lats) + 1, Math.max(...lngs) + 1]
  ]

  // Create route line points
  const routePoints: [number, number][] = []
  const originPoint = points.find(p => p.type === 'origin')
  const currentPoint = points.find(p => p.type === 'current')
  const destPoint = points.find(p => p.type === 'destination')
  
  if (originPoint) routePoints.push([originPoint.lat, originPoint.lng])
  
  // Add transit points
  const transitPoints = points.filter(p => p.type === 'transit')
  transitPoints.forEach(p => routePoints.push([p.lat, p.lng]))
  
  if (currentPoint && currentPoint !== originPoint) {
    routePoints.push([currentPoint.lat, currentPoint.lng])
  }
  if (destPoint) routePoints.push([destPoint.lat, destPoint.lng])

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden">
      {/* Global styles for map */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .leaflet-container {
          background: #1e293b !important;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
        }
        .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          color: white !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
        }
        .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
        }
        .leaflet-popup-content {
          margin: 12px 16px !important;
          font-size: 13px !important;
        }
        .leaflet-popup-close-button {
          color: white !important;
        }
        .custom-marker, .pulsing-marker, .home-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          border-radius: 8px !important;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.9) !important;
          color: white !important;
          border: none !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30, 41, 59, 1) !important;
        }
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.5) !important;
          color: rgba(255,255,255,0.5) !important;
          font-size: 10px !important;
          padding: 2px 6px !important;
        }
        .leaflet-control-attribution a {
          color: rgba(255,255,255,0.6) !important;
        }
      `}</style>
      
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={!compact}
        zoomControl={!compact}
        dragging={!compact}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        {/* CartoDB Dark Matter - sleek dark map style */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Route line */}
        {routePoints.length >= 2 && (
          <>
            {/* Shadow line */}
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: '#000000',
                weight: 6,
                opacity: 0.3,
              }}
            />
            {/* Main line */}
            <Polyline
              positions={routePoints}
              pathOptions={{
                color: statusColor,
                weight: 4,
                opacity: 0.9,
                dashArray: status === 'delivered' ? undefined : '12, 8',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}
        
        {/* Markers */}
        {icons && points.map((point, index) => {
          const icon = icons[point.type]
          if (!icon) return null
          
          return (
            <Marker
              key={`${point.type}-${index}`}
              position={[point.lat, point.lng]}
              icon={icon}
            >
              <Popup>
                <div className="text-center min-w-[120px]">
                  <p className="font-semibold text-white text-sm">{point.label}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    {point.type === 'origin' && '📦 Shipment Origin'}
                    {point.type === 'destination' && '🏠 Delivery Address'}
                    {point.type === 'current' && '🚚 Current Location'}
                    {point.type === 'transit' && '📍 Transit Stop'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      
      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2.5 text-xs bg-black/70 backdrop-blur-md px-3 py-2 rounded-full border border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-slate-400/30" />
          <span className="text-slate-300">Origin</span>
        </div>
        <div className="w-px h-3 bg-white/20" />
        <div className="flex items-center gap-1.5">
          <div 
            className="w-2.5 h-2.5 rounded-full ring-2" 
            style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
          />
          <span className="text-white font-medium">Package</span>
        </div>
        <div className="w-px h-3 bg-white/20" />
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
          <span className="text-emerald-300">Delivery</span>
        </div>
      </div>
    </div>
  )
}
