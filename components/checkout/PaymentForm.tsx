'use client'

import { useState, FormEvent } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { CircleNotch, ShieldCheck, Lock, WarningCircle } from '@phosphor-icons/react'
import { useTierAccent } from '@/lib/loyalty/use-tier-accent'

interface PaymentFormProps {
  amount: number
  orderId: string
  onSuccess: () => void
  onError: (error: string) => void
}

type ErrorKind = 'auth_required' | 'declined' | 'generic'

interface PaymentError {
  kind: ErrorKind
  message: string
}

export function PaymentForm({ amount, orderId, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const tierAccent = useTierAccent()
  const [loading, setLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null)

  const confirmOrderOnServer = async (paymentIntentId: string | null) => {
    try {
      const confirmResponse = await fetch(`/api/orders/${orderId}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      })

      if (!confirmResponse.ok) {
        console.error('Failed to confirm order, but payment succeeded')
      } else {
        const confirmData = await confirmResponse.json()
        console.log('Order confirmed:', confirmData)
      }
    } catch (confirmError) {
      // Don't fail payment success if server confirmation fails
      console.error('Error confirming order:', confirmError)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setPaymentError(null)

    try {
      // --- Outcome 1 & 2 & 3: confirm payment ---
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/confirmation?orderId=${orderId}&success=true`,
        },
        redirect: 'if_required',
      })

      // --- Outcome 2: 3DS / SCA authentication required ---
      if (error) {
        const isAuthRequired =
          (error.type === 'card_error' && error.code === 'authentication_required') ||
          (error.type === 'card_error' &&
            error.code === 'card_declined' &&
            (error as { decline_code?: string }).decline_code === 'authentication_required')

        if (isAuthRequired) {
          const msg = 'Your bank requires extra verification. Please try again to complete authentication.'
          setPaymentError({ kind: 'auth_required', message: msg })
          onError(msg)
        } else if (error.type === 'card_error' || error.type === 'validation_error') {
          // Definitive decline or validation issue — tell them clearly
          const msg = error.message || 'Your card was declined. Please try a different payment method.'
          setPaymentError({ kind: 'declined', message: msg })
          onError(msg)
        } else {
          // Network / API / other errors
          const msg = error.message || 'Payment failed. Please try again.'
          setPaymentError({ kind: 'generic', message: msg })
          onError(msg)
        }
        return
      }

      // --- Outcome 3: requires_action returned without an error (Stripe will handle redirect,
      //     but when redirect: 'if_required' is set, we drive the challenge manually) ---
      if (paymentIntent?.status === 'requires_action') {
        const clientSecret = paymentIntent.client_secret
        if (!clientSecret) {
          const msg = 'Authentication could not be initiated. Please try again.'
          setPaymentError({ kind: 'auth_required', message: msg })
          onError(msg)
          return
        }

        const { error: nextActionError, paymentIntent: completedIntent } =
          await stripe.handleNextAction({ clientSecret })

        if (nextActionError) {
          const isAuthFail =
            nextActionError.type === 'card_error' &&
            (nextActionError.code === 'authentication_required' ||
              nextActionError.code === 'card_declined')

          const msg = isAuthFail
            ? 'Verification was not completed. Please try again or use a different payment method.'
            : nextActionError.message || 'Payment failed after verification. Please try again.'

          const kind: ErrorKind = isAuthFail ? 'auth_required' : 'generic'
          setPaymentError({ kind, message: msg })
          onError(msg)
          return
        }

        // handleNextAction succeeded — payment is confirmed
        await confirmOrderOnServer(completedIntent?.id ?? null)
        onSuccess()
        return
      }

      // --- Outcome 1: Success (no error, status is succeeded / processing) ---
      await confirmOrderOnServer(paymentIntent?.id ?? null)
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setPaymentError({ kind: 'generic', message })
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  // Determine banner accent colour based on error kind
  const errorBorderColor =
    paymentError?.kind === 'auth_required' ? '#F59E0B' : '#FF3131'
  const errorBgColor =
    paymentError?.kind === 'auth_required'
      ? 'rgba(245,158,11,0.06)'
      : 'rgba(255,49,49,0.04)'
  const errorTextColor =
    paymentError?.kind === 'auth_required' ? '#B45309' : '#FF3131'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <PaymentElement />

        {paymentError && (
          <div
            className="mt-4 flex items-start gap-2 border-l-2 py-2 pl-3 pr-2"
            style={{ borderColor: errorBorderColor, backgroundColor: errorBgColor }}
            role="alert"
          >
            <WarningCircle
              size={16}
              weight="bold"
              className="mt-0.5 shrink-0"
              style={{ color: errorTextColor }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: errorTextColor }}>
                {paymentError.kind === 'auth_required'
                  ? 'Verification required'
                  : paymentError.kind === 'declined'
                  ? 'Card declined'
                  : 'Payment failed'}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: errorTextColor }}>
                {paymentError.message}
              </p>
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={!stripe || loading}
        style={{ backgroundColor: tierAccent.accent }}
        className="w-full text-white font-black uppercase tracking-[0.16em] py-6 text-xs rounded-none transition-all duration-300 hover:brightness-90 hover:shadow-lg disabled:opacity-50 disabled:hover:brightness-100 disabled:hover:shadow-none"
        size="lg"
      >
        {loading ? (
          <>
            <CircleNotch size={20} weight="bold" className="mr-2 animate-spin" />
            {paymentError?.kind === 'auth_required'
              ? 'Verifying...'
              : 'Processing Payment...'}
          </>
        ) : (
          <>
            <Lock size={18} weight="bold" className="mr-2" />
            {paymentError?.kind === 'auth_required'
              ? 'Retry Verification'
              : `Pay $${amount.toFixed(2)}`}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-black/50">
        <ShieldCheck size={14} weight="bold" className="text-green-600" />
        <span>Your payment information is secure and encrypted</span>
      </div>
    </form>
  )
}
