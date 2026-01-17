'use client'

import { useState, FormEvent } from 'react'
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { CircleNotch, ShieldCheck, Lock } from '@phosphor-icons/react'

interface PaymentFormProps {
  amount: number
  orderId: string
  onSuccess: () => void
  onError: (error: string) => void
}

export function PaymentForm({ amount, orderId, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      // Confirm payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/confirmation?orderId=${orderId}&success=true`,
        },
        redirect: 'if_required',
      })

      if (error) {
        setErrorMessage(error.message || 'Payment failed')
        onError(error.message || 'Payment failed')
      } else {
        // Payment succeeded - confirm the order and award points
        try {
          const confirmResponse = await fetch(`/api/orders/${orderId}/confirm-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId: null }), // Could pass actual ID if available
          })
          
          if (!confirmResponse.ok) {
            console.error('Failed to confirm order, but payment succeeded')
          } else {
            const confirmData = await confirmResponse.json()
            console.log('Order confirmed:', confirmData)
          }
        } catch (confirmError) {
          // Don't fail payment success if confirmation fails
          console.error('Error confirming order:', confirmError)
        }
        
        onSuccess()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setErrorMessage(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <PaymentElement />
        
        {errorMessage && (
          <div className="mt-4 p-4 bg-[#FF3131]/10 border border-[#FF3131]/20 rounded-2xl">
            <p className="text-sm text-[#FF3131] font-medium">{errorMessage}</p>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-black hover:bg-black/80 text-white font-bold py-6 text-base rounded-full transition-all duration-300 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
        size="lg"
      >
        {loading ? (
          <>
            <CircleNotch size={20} weight="bold" className="mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <Lock size={18} weight="bold" className="mr-2" />
            Pay ${amount.toFixed(2)}
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
