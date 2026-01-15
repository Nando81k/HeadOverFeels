import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().optional(),
  sourceDetails: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
})

const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.string().optional(),
})

// POST - Subscribe to newsletter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source, sourceDetails, utmSource, utmMedium, utmCampaign } = subscribeSchema.parse(body)

    // Check if email already exists as a subscriber
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingSubscriber) {
      // If they previously unsubscribed, reactivate
      if (!existingSubscriber.isActive) {
        await prisma.newsletterSubscriber.update({
          where: { id: existingSubscriber.id },
          data: {
            isActive: true,
            unsubscribedAt: null,
            unsubscribeReason: null,
            source: source || existingSubscriber.source,
            sourceDetails: sourceDetails || existingSubscriber.sourceDetails,
            utmSource: utmSource || existingSubscriber.utmSource,
            utmMedium: utmMedium || existingSubscriber.utmMedium,
            utmCampaign: utmCampaign || existingSubscriber.utmCampaign,
          },
        })
        return NextResponse.json({ 
          success: true, 
          message: 'Welcome back! You\'ve been resubscribed to our newsletter.' 
        })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'You\'re already subscribed to our newsletter!' 
      })
    }

    // Check if this email belongs to a customer
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingCustomer) {
      // Update customer's newsletter preference instead
      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: { newsletter: true },
      })
      return NextResponse.json({ 
        success: true, 
        message: 'You\'ve been subscribed to our newsletter!' 
      })
    }

    // Create new subscriber
    await prisma.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        source,
        sourceDetails,
        utmSource,
        utmMedium,
        utmCampaign,
        isActive: true,
      },
    })

    // TODO: Send verification email

    return NextResponse.json({ 
      success: true, 
      message: 'Thanks for subscribing! Check your email to confirm.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }
    console.error('Newsletter subscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 }
    )
  }
}

// DELETE - Unsubscribe from newsletter
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, reason } = unsubscribeSchema.parse(body)

    // Check newsletter subscriber table
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (subscriber) {
      await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
          unsubscribeReason: reason,
        },
      })
      return NextResponse.json({ 
        success: true, 
        message: 'You\'ve been unsubscribed from our newsletter.' 
      })
    }

    // Check if customer
    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (customer) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { newsletter: false },
      })
      return NextResponse.json({ 
        success: true, 
        message: 'You\'ve been unsubscribed from our newsletter.' 
      })
    }

    // Not found but don't reveal that
    return NextResponse.json({ 
      success: true, 
      message: 'You\'ve been unsubscribed from our newsletter.' 
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }
    console.error('Newsletter unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe. Please try again.' },
      { status: 500 }
    )
  }
}
