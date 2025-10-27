'use client';

import Image from 'next/image';

interface ProductImageProps {
  src?: string | string[];
  alt: string;
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
  fill = false,
  width,
  height,
  className = '',
  priority = false,
  sizes,
}: ProductImageProps) {
  // Handle array of images (take first one)
  const imageSrc = Array.isArray(src) ? src[0] : src;

  // Generate placeholder based on product name/category
  const getPlaceholderUrl = () => {
    const productName = alt.toLowerCase();
    
    // Map product types to Unsplash collections
    if (productName.includes('hoodie') || productName.includes('sweatshirt')) {
      return 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('t-shirt') || productName.includes('tee')) {
      return 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('pants') || productName.includes('jeans') || productName.includes('cargo')) {
      return 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('jacket') || productName.includes('coat') || productName.includes('vest')) {
      return 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('hat') || productName.includes('beanie') || productName.includes('cap')) {
      return 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('bag') || productName.includes('tote') || productName.includes('backpack')) {
      return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('shoes') || productName.includes('sneakers') || productName.includes('boots')) {
      return 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=1000&fit=crop&q=80';
    }
    if (productName.includes('accessories')) {
      return 'https://images.unsplash.com/photo-1529958030586-3aae4ca485ff?w=800&h=1000&fit=crop&q=80';
    }
    
    // Default fashion/clothing placeholder
    return 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&h=1000&fit=crop&q=80';
  };

  const finalSrc = imageSrc || getPlaceholderUrl();

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
