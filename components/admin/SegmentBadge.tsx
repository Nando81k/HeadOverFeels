/**
 * Segment Badge Component
 * 
 * Displays customer segment with color coding
 */

import { type CustomerSegment, getSegmentInfo } from '@/lib/customer-segments';

interface SegmentBadgeProps {
  segment: CustomerSegment;
  showDescription?: boolean;
}

export function SegmentBadge({ segment, showDescription = false }: SegmentBadgeProps) {
  const info = getSegmentInfo(segment);
  
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${info.bgColor} ${info.color}`}>
        {info.label}
      </span>
      {showDescription && (
        <span className="text-sm text-gray-600">{info.description}</span>
      )}
    </div>
  );
}
