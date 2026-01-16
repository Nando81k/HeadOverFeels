'use client'

import { 
  Package, 
  Truck, 
  House, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Warning,
  Airplane,
  Buildings
} from '@phosphor-icons/react'
import type { TrackingEvent, TrackingStatus } from '@/lib/shipping/tracking'

interface TrackingTimelineProps {
  events: TrackingEvent[]
  status: TrackingStatus
  estimatedDelivery?: string
  deliveredAt?: string
}

const STATUS_CONFIG: Record<TrackingStatus, {
  icon: typeof Package
  color: string
  bgColor: string
  borderColor: string
}> = {
  pre_transit: {
    icon: Package,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
  in_transit: {
    icon: Truck,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  out_for_delivery: {
    icon: Truck,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  delivered: {
    icon: House,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  available_for_pickup: {
    icon: Buildings,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  return_to_sender: {
    icon: Warning,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  failure: {
    icon: Warning,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  unknown: {
    icon: Clock,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-200',
  },
}

function getEventIcon(event: TrackingEvent) {
  const description = event.description.toLowerCase()
  
  if (description.includes('deliver') && !description.includes('out')) {
    return House
  }
  if (description.includes('out for delivery')) {
    return Truck
  }
  if (description.includes('transit') || description.includes('depart') || description.includes('enroute')) {
    return Airplane
  }
  if (description.includes('arrived') || description.includes('facility') || description.includes('hub')) {
    return Buildings
  }
  if (description.includes('pickup') || description.includes('picked up')) {
    return Package
  }
  if (description.includes('label') || description.includes('created')) {
    return Package
  }
  
  return MapPin
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export function TrackingTimeline({ 
  events, 
  status, 
  estimatedDelivery,
  deliveredAt 
}: TrackingTimelineProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unknown
  const StatusIcon = config.icon

  return (
    <div className="space-y-4">
      {/* Current Status Summary */}
      <div className={`p-4 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${config.bgColor} border ${config.borderColor} flex items-center justify-center`}>
            <StatusIcon size={24} weight="fill" className={config.color} />
          </div>
          <div className="flex-1">
            <p className={`font-semibold ${config.color}`}>
              {status === 'delivered' ? 'Delivered!' : 
               status === 'out_for_delivery' ? 'Out for Delivery' :
               status === 'in_transit' ? 'In Transit' :
               status === 'pre_transit' ? 'Label Created' :
               status === 'available_for_pickup' ? 'Ready for Pickup' :
               status === 'return_to_sender' ? 'Returning to Sender' :
               status === 'failure' ? 'Delivery Exception' : 'Processing'}
            </p>
            {deliveredAt && status === 'delivered' && (
              <p className="text-sm text-slate-600">
                Delivered {formatDate(deliveredAt).date} at {formatDate(deliveredAt).time}
              </p>
            )}
            {estimatedDelivery && status !== 'delivered' && (
              <p className="text-sm text-slate-600">
                Expected by {formatDate(estimatedDelivery).date}
              </p>
            )}
          </div>
          {status === 'delivered' && (
            <CheckCircle size={28} weight="fill" className="text-emerald-500" />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-slate-200" />
        
        <div className="space-y-0">
          {events.map((event, index) => {
            const Icon = getEventIcon(event)
            const { date, time } = formatDate(event.timestamp)
            const isFirst = index === 0
            const isDelivered = event.status === 'delivered'
            
            return (
              <div 
                key={`${event.timestamp}-${index}`}
                className={`relative flex gap-4 py-4 ${
                  isFirst ? '' : ''
                }`}
              >
                {/* Icon */}
                <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isFirst 
                    ? `${config.bgColor} border-2 ${config.borderColor}` 
                    : 'bg-white border border-slate-200'
                }`}>
                  <Icon 
                    size={20} 
                    weight={isFirst ? 'fill' : 'regular'} 
                    className={isFirst ? config.color : 'text-slate-400'} 
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <div>
                      <p className={`font-medium ${isFirst ? 'text-black' : 'text-slate-700'}`}>
                        {event.description}
                      </p>
                      {event.location.city && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={14} />
                          {event.location.city}{event.location.state ? `, ${event.location.state}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 sm:text-right whitespace-nowrap">
                      <p className="font-medium">{date}</p>
                      <p>{time}</p>
                    </div>
                  </div>
                </div>
                
                {/* Delivered badge */}
                {isDelivered && (
                  <div className="absolute right-0 -top-1">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      <CheckCircle size={14} weight="fill" />
                      Delivered
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
