'use client'

import { useState } from 'react'
import { Navigation } from '@/components/layout/Navigation'
import { EnvelopeSimple, MapPin, Phone, InstagramLogo, TwitterLogo, FacebookLogo, PaperPlaneTilt } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setSubmitted(true)
    setIsSubmitting(false)
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false)
      setFormData({ name: '', email: '', subject: '', message: '' })
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero */}
      <div className="bg-white text-black py-12 sm:py-20 pt-24 sm:pt-28 border-b border-black/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black mb-4 sm:mb-6">
            Get in Touch
          </h1>
          <p className="text-base sm:text-xl text-black/70">
            Have questions? We&apos;d love to hear from you
          </p>
        </div>
      </div>

      {/* Contact Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black mb-4 sm:mb-6">Send us a Message</h2>
            <p className="text-sm sm:text-base text-black/70 mb-6 sm:mb-8">
              Fill out the form below and we&apos;ll get back to you within 24 hours
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-black mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-bold text-black mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-bold text-black mb-2">
                  Subject *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent bg-white text-black"
                >
                  <option value="">Select a subject</option>
                  <option value="order">Order Inquiry</option>
                  <option value="product">Product Question</option>
                  <option value="collaboration">Collaboration</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-bold text-black mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-black/10 rounded-none focus:ring-2 focus:ring-black focus:border-transparent resize-none bg-white text-black"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting || submitted}
                className="w-full"
                size="lg"
              >
                {submitted ? (
                  <>
                    <PaperPlaneTilt size={20} weight="bold" className="mr-2" />
                    Message Sent!
                  </>
                ) : isSubmitting ? (
                  'Sending...'
                ) : (
                  <>
                    <PaperPlaneTilt size={20} weight="bold" className="mr-2" />
                    Send Message
                  </>
                )}
              </Button>

              {submitted && (
                <p className="text-black/70 text-sm text-center font-medium">
                  Thank you! We&apos;ll get back to you soon.
                </p>
              )}
            </form>
          </div>

          {/* Contact Information */}
          <div className="lg:pl-12">
            <h2 className="text-2xl sm:text-3xl font-black mb-4 sm:mb-6">Contact Information</h2>
            <p className="text-sm sm:text-base text-black/70 mb-6 sm:mb-8">
              Reach out through any of these channels
            </p>

            <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-12">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-none flex items-center justify-center shrink-0">
                  <EnvelopeSimple size={20} weight="bold" className="text-white sm:hidden" />
                  <EnvelopeSimple size={24} weight="bold" className="text-white hidden sm:block" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1">Email</h3>
                  <a href="mailto:hello@headoverfeels.com" className="text-black/70 hover:text-black transition-colors">
                    hello@headoverfeels.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-none flex items-center justify-center shrink-0">
                  <Phone size={20} weight="bold" className="text-white sm:hidden" />
                  <Phone size={24} weight="bold" className="text-white hidden sm:block" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1">Phone</h3>
                  <a href="tel:+15551234567" className="text-black/70 hover:text-black transition-colors">
                    +1 (555) 123-4567
                  </a>
                  <p className="text-sm text-black/60 mt-1">Mon-Fri, 9am-6pm EST</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-none flex items-center justify-center shrink-0">
                  <MapPin size={20} weight="bold" className="text-white sm:hidden" />
                  <MapPin size={24} weight="bold" className="text-white hidden sm:block" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-1">Address</h3>
                  <p className="text-black/70">
                    123 Street Culture Ave<br />
                    Brooklyn, NY 11211<br />
                    United States
                  </p>
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Follow Us</h3>
              <div className="flex gap-3 sm:gap-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 border border-black/10 rounded-none flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="Instagram"
                >
                  <InstagramLogo size={18} weight="bold" className="sm:hidden" />
                  <InstagramLogo size={20} weight="bold" className="hidden sm:block" />
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 border border-black/10 rounded-none flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="Twitter"
                >
                  <TwitterLogo size={18} weight="bold" className="sm:hidden" />
                  <TwitterLogo size={20} weight="bold" className="hidden sm:block" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 border border-black/10 rounded-none flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-colors"
                  aria-label="Facebook"
                >
                  <FacebookLogo size={18} weight="bold" className="sm:hidden" />
                  <FacebookLogo size={20} weight="bold" className="hidden sm:block" />
                </a>
              </div>
            </div>

            {/* Store Hours */}
            <div className="mt-12 p-6 bg-black/5 rounded-none border border-black/10">
              <h3 className="font-bold text-lg mb-3">Store Hours</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-black/70">Monday - Friday</span>
                  <span className="font-bold">10am - 8pm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/70">Saturday</span>
                  <span className="font-bold">11am - 7pm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/70">Sunday</span>
                  <span className="font-bold">12pm - 6pm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Teaser */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Got Questions?</h2>
          <p className="text-gray-600 mb-8">
            Check out our FAQ section for quick answers to common questions
          </p>
          <Button variant="outline" size="lg">
            View FAQs
          </Button>
        </div>
      </div>
    </div>
  )
}
