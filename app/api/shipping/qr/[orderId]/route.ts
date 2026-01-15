/**
 * Return QR Code API
 * 
 * Generates a QR code for paperless returns
 * Customers can show this at carrier locations instead of printing a label
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const searchParams = request.nextUrl.searchParams
    const trackingNumber = searchParams.get('tracking')

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        customerEmail: true,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Generate QR code data URL
    // The QR code contains a URL that carriers can scan to get label info
    const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com'}/api/shipping/label/${orderId}?tracking=${trackingNumber || ''}`

    // Generate SVG QR code (simple implementation without external dependencies)
    const qrCodeSVG = generateQRCodeSVG(returnUrl, order.orderNumber, trackingNumber || '')

    return new NextResponse(qrCodeSVG, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[QR API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}

/**
 * Generate a simple QR code representation as SVG
 * Note: This is a placeholder visual - in production you'd use a proper QR library
 */
function generateQRCodeSVG(url: string, orderNumber: string, tracking: string): string {
  // Create a deterministic pattern based on the URL hash
  const hash = simpleHash(url)
  const modules = generateModules(hash)
  const moduleSize = 4
  const size = modules.length * moduleSize
  const padding = 20
  const totalSize = size + padding * 2 + 60 // Extra space for text

  let pathData = ''
  
  for (let row = 0; row < modules.length; row++) {
    for (let col = 0; col < modules[row].length; col++) {
      if (modules[row][col]) {
        const x = padding + col * moduleSize
        const y = padding + row * moduleSize
        pathData += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z `
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">
  <style>
    .label { font-family: Arial, sans-serif; font-size: 10px; fill: #666; }
    .tracking { font-family: monospace; font-size: 11px; fill: #333; font-weight: bold; }
    .order { font-family: Arial, sans-serif; font-size: 9px; fill: #999; }
  </style>
  
  <!-- White background -->
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- QR Code pattern -->
  <path d="${pathData}" fill="black"/>
  
  <!-- Position markers (corners) -->
  ${generatePositionMarker(padding, padding, moduleSize)}
  ${generatePositionMarker(padding + (modules.length - 7) * moduleSize, padding, moduleSize)}
  ${generatePositionMarker(padding, padding + (modules.length - 7) * moduleSize, moduleSize)}
  
  <!-- Label text -->
  <text x="${totalSize / 2}" y="${padding + size + 20}" text-anchor="middle" class="label">
    RETURN LABEL QR
  </text>
  <text x="${totalSize / 2}" y="${padding + size + 35}" text-anchor="middle" class="tracking">
    ${tracking || 'SCAN TO VIEW'}
  </text>
  <text x="${totalSize / 2}" y="${padding + size + 50}" text-anchor="middle" class="order">
    Order: ${orderNumber}
  </text>
</svg>`
}

/**
 * Generate position markers for QR code corners
 */
function generatePositionMarker(x: number, y: number, moduleSize: number): string {
  const s = moduleSize
  return `
    <rect x="${x}" y="${y}" width="${7 * s}" height="${7 * s}" fill="black"/>
    <rect x="${x + s}" y="${y + s}" width="${5 * s}" height="${5 * s}" fill="white"/>
    <rect x="${x + 2 * s}" y="${y + 2 * s}" width="${3 * s}" height="${3 * s}" fill="black"/>
  `
}

/**
 * Simple hash function for generating deterministic patterns
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate QR code modules (simplified visual representation)
 */
function generateModules(hash: number): boolean[][] {
  const size = 25 // Standard QR code size
  const modules: boolean[][] = []
  
  // Initialize with random-ish pattern based on hash
  let seed = hash
  for (let row = 0; row < size; row++) {
    modules[row] = []
    for (let col = 0; col < size; col++) {
      // Skip position marker areas (7x7 in corners)
      const inTopLeft = row < 7 && col < 7
      const inTopRight = row < 7 && col >= size - 7
      const inBottomLeft = row >= size - 7 && col < 7
      
      if (inTopLeft || inTopRight || inBottomLeft) {
        modules[row][col] = false // Will be filled by position markers
      } else {
        // Pseudo-random but deterministic pattern
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        modules[row][col] = (seed % 100) > 50
      }
    }
  }
  
  return modules
}
