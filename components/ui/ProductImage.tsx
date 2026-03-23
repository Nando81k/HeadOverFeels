'use client';

import Image from 'next/image';
import { getPrimaryImageWithFallback } from '@/lib/commerce/product-placeholders';

interface ProductImageProps {
  src?: string | string[];
  alt: string;
  productSlug?: string;
  color?: string | null;
  colorHex?: string | null;
  sizeLabel?: string | null;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
}

/**
 * Product image component with automatic placeholder fallback
 * Uses Unsplash for high-quality placeholder images when no image is provided
 */
export default function ProductImage({
  src,
  alt,
  productSlug,
  color,
  colorHex,
  sizeLabel,
  fill = false,
  width,
  height,
  className = '',
  priority = false,
  sizes,
}: ProductImageProps) {
  // Handle array of images (take first one)
  const imageSrc = Array.isArray(src) ? src[0] : src;
  const finalSrc = getPrimaryImageWithFallback({
    images: imageSrc ?? '',
    productName: alt,
    productSlug,
    color,
    colorHex,
    size: sizeLabel,
  });

  if (fill) {
    return (
      <Image
        src={finalSrc}
        alt={alt}
        fill
        className={className}
        priority={priority}
        sizes={sizes}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width || 800}
      height={height || 1000}
      className={className}
      priority={priority}
      sizes={sizes}
    />
  );
}
