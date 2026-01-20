'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { 
  ArrowLeft, 
  Eye,
  Desktop,
  DeviceMobile,
  Plus,
  Trash,
  X,
  Timer,
  Scroll,
  SignOut,
  Lightning,
  Upload,
  Palette,
  FloppyDisk,
  CaretDown,
  CaretUp,
  Check,
  Sparkle,
  Calendar,
  SlidersHorizontal,
  Users
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import {
  EmailCaptureModal,
  ModalTemplate,
  BannerTemplate,
  SlideInTemplate,
  FullScreenTemplate,
  PopupContent
} from '@/components/marketing/templates'

type PopupTemplate = 'MODAL' | 'BANNER' | 'SLIDE_IN' | 'FULL_SCREEN' | 'EMAIL_CAPTURE'
type TriggerType = 'DELAY' | 'SCROLL' | 'EXIT_INTENT' | 'IMMEDIATE'
type PopupPosition = 'TOP' | 'BOTTOM' | 'CENTER' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'
type PopupFrequency = 'ALWAYS' | 'ONCE_PER_SESSION' | 'ONCE_PER_DAY' | 'ONCE_EVER'

interface Variant {
  id?: string
  name: string
  weight: number
  content: PopupContent
}

interface FormData {
  name: string
  template: PopupTemplate
  position: PopupPosition
  triggerType: TriggerType
  triggerValue: number
  frequency: PopupFrequency
  priority: number
  isActive: boolean
  startDate: string
  endDate: string
  targetPages: string[]
  targetNewVisitors: boolean
  targetReturning: boolean
  variants: Variant[]
}

const templateOptions: Array<{ value: PopupTemplate; label: string; icon: string; description: string }> = [
  { value: 'EMAIL_CAPTURE', label: 'Email Capture', icon: '📧', description: 'Collect emails with discount offer' },
  { value: 'MODAL', label: 'Modal', icon: '◻️', description: 'Standard promotional popup' },
  { value: 'BANNER', label: 'Banner', icon: '📢', description: 'Top or bottom announcement bar' },
  { value: 'SLIDE_IN', label: 'Slide-In', icon: '↗️', description: 'Corner notification popup' },
  { value: 'FULL_SCREEN', label: 'Full Screen', icon: '🖥️', description: 'Full page takeover' }
]

const triggerOptions: Array<{ value: TriggerType; label: string; icon: typeof Timer; description: string }> = [
  { value: 'DELAY', label: 'Time Delay', icon: Timer, description: 'Show after X seconds' },
  { value: 'SCROLL', label: 'Scroll Depth', icon: Scroll, description: 'Show at scroll percentage' },
  { value: 'EXIT_INTENT', label: 'Exit Intent', icon: SignOut, description: 'Show when leaving' },
  { value: 'IMMEDIATE', label: 'Immediate', icon: Lightning, description: 'Show on page load' }
]

const frequencyOptions = [
  { value: 'ONCE_PER_SESSION', label: 'Once per session' },
  { value: 'ONCE_PER_DAY', label: 'Once per day' },
  { value: 'ONCE_EVER', label: 'Once ever' },
  { value: 'ALWAYS', label: 'Every page view' }
]

const positionOptions: Record<PopupTemplate, Array<{ value: PopupPosition; label: string }>> = {
  MODAL: [{ value: 'CENTER', label: 'Center' }],
  EMAIL_CAPTURE: [{ value: 'CENTER', label: 'Center' }],
  FULL_SCREEN: [{ value: 'CENTER', label: 'Full Screen' }],
  BANNER: [
    { value: 'TOP', label: 'Top' },
    { value: 'BOTTOM', label: 'Bottom' }
  ],
  SLIDE_IN: [
    { value: 'BOTTOM_RIGHT', label: 'Bottom Right' },
    { value: 'BOTTOM_LEFT', label: 'Bottom Left' },
    { value: 'TOP_RIGHT', label: 'Top Right' },
    { value: 'TOP_LEFT', label: 'Top Left' }
  ]
}

const defaultContent: PopupContent = {
  heading: 'Limited Time Offer!',
  body: 'Get 20% off your first order when you sign up today.',
  buttonText: 'Shop Now',
  buttonUrl: '/products',
  backgroundColor: '#18181B',
  textColor: '#ffffff',
  buttonColor: '#FF3131'
}

export default function EditPopupPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [activeVariant, setActiveVariant] = useState(0)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor')
  
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }
  
  const [formData, setFormData] = useState<FormData>({
    name: '',
    template: 'EMAIL_CAPTURE',
    position: 'CENTER',
    triggerType: 'DELAY',
    triggerValue: 5,
    frequency: 'ONCE_PER_SESSION',
    priority: 1,
    isActive: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    targetPages: [],
    targetNewVisitors: true,
    targetReturning: true,
    variants: [
      { name: 'Control', weight: 100, content: { ...defaultContent } }
    ]
  })
  
  // Fetch popup data
  useEffect(() => {
    const fetchPopup = async () => {
      try {
        const res = await fetch(`/api/popups/${resolvedParams.id}`)
        if (!res.ok) throw new Error('Failed to fetch popup')
        
        const data = await res.json()
        
        // Parse variants content
        const variants = data.variants?.map((v: Variant & { content: string | PopupContent }) => ({
          ...v,
          content: typeof v.content === 'string' ? JSON.parse(v.content) : v.content
        })) || [{ name: 'Control', weight: 100, content: { ...defaultContent } }]
        
        setFormData({
          name: data.name || '',
          template: data.template || 'EMAIL_CAPTURE',
          position: data.position || 'CENTER',
          triggerType: data.triggerType || 'DELAY',
          triggerValue: data.triggerValue || 5,
          frequency: data.frequency || 'ONCE_PER_SESSION',
          priority: data.priority || 1,
          isActive: data.isActive ?? true,
          startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
          endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
          targetPages: data.targetPages || [],
          targetNewVisitors: data.targetNewVisitors ?? true,
          targetReturning: data.targetReturning ?? true,
          variants
        })
      } catch (err) {
        console.error('Error fetching popup:', err)
        setError('Failed to load popup')
      } finally {
        setLoading(false)
      }
    }
    
    fetchPopup()
  }, [resolvedParams.id])
  
  // Update position when template changes
  useEffect(() => {
    const positions = positionOptions[formData.template]
    if (!positions.find(p => p.value === formData.position)) {
      setFormData(prev => ({ ...prev, position: positions[0].value }))
    }
  }, [formData.template, formData.position])
  
  const addVariant = () => {
    const newVariant: Variant = {
      name: `Variant ${String.fromCharCode(65 + formData.variants.length)}`,
      weight: 0,
      content: { ...formData.variants[0].content }
    }
    
    const newVariants = [...formData.variants, newVariant]
    const evenWeight = Math.floor(100 / newVariants.length)
    const remainder = 100 - (evenWeight * newVariants.length)
    
    setFormData(prev => ({
      ...prev,
      variants: newVariants.map((v, i) => ({
        ...v,
        weight: evenWeight + (i === 0 ? remainder : 0)
      }))
    }))
    setActiveVariant(newVariants.length - 1)
  }
  
  const removeVariant = (index: number) => {
    if (formData.variants.length <= 1) return
    
    const newVariants = formData.variants.filter((_, i) => i !== index)
    const evenWeight = Math.floor(100 / newVariants.length)
    const remainder = 100 - (evenWeight * newVariants.length)
    
    setFormData(prev => ({
      ...prev,
      variants: newVariants.map((v, i) => ({
        ...v,
        weight: evenWeight + (i === 0 ? remainder : 0)
      }))
    }))
    setActiveVariant(Math.min(activeVariant, newVariants.length - 1))
  }
  
  const updateVariantContent = (key: keyof PopupContent, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => 
        i === activeVariant 
          ? { ...v, content: { ...v.content, [key]: value } }
          : v
      )
    }))
  }
  
  const updateVariantWeight = (index: number, weight: number) => {
    const others = formData.variants.filter((_, i) => i !== index)
    const totalOthers = others.reduce((sum, v) => sum + v.weight, 0)
    const maxWeight = 100 - (formData.variants.length - 1)
    const clampedWeight = Math.min(Math.max(0, weight), maxWeight)
    
    const remaining = 100 - clampedWeight
    const scale = totalOthers > 0 ? remaining / totalOthers : 1
    
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => {
        if (i === index) return { ...v, weight: clampedWeight }
        return { ...v, weight: Math.round(v.weight * scale) }
      })
    }))
  }
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const formDataUpload = new FormData()
    formDataUpload.append('file', file)
    
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload
      })
      const data = await res.json()
      if (data.url) {
        updateVariantContent('image', data.url)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/popups/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null
        })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update popup')
      }
      
      toast.success('Popup updated!', `${formData.name} has been saved`)
      router.push('/admin/popups')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setError(message)
      toast.error('Failed to update popup', message)
    } finally {
      setSaving(false)
    }
  }
  
  const currentContent = formData.variants[activeVariant]?.content || defaultContent
  
  const renderPreview = () => {
    const props = {
      content: currentContent,
      onClose: () => {},
      onAction: () => {},
      previewMode: true
    }
    
    switch (formData.template) {
      case 'EMAIL_CAPTURE':
        return <EmailCaptureModal {...props} />
      case 'MODAL':
        return <ModalTemplate {...props} />
      case 'BANNER':
        return <BannerTemplate {...props} position={formData.position === 'BOTTOM' ? 'bottom' : 'top'} />
      case 'SLIDE_IN':
        const slidePos = formData.position.toLowerCase().replace('_', '-') as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
        return <SlideInTemplate {...props} position={slidePos} />
      case 'FULL_SCREEN':
        return <FullScreenTemplate {...props} />
      default:
        return <ModalTemplate {...props} />
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-[#FF3131]" />
          <p className="text-white/50">Loading popup...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col lg:flex-row h-screen bg-black">
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden sticky top-0 z-20 bg-black border-b border-white/10">
        <div className="flex">
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'editor' 
                ? 'text-white bg-white/10 border-b-2 border-[#FF3131]' 
                : 'text-white/50'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mobileTab === 'preview' 
                ? 'text-white bg-white/10 border-b-2 border-[#FF3131]' 
                : 'text-white/50'
            }`}
          >
            <Eye size={16} className="inline mr-1.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Editor Panel */}
      <div className={`flex-1 lg:w-1/2 overflow-y-auto lg:border-r border-white/10 ${mobileTab !== 'editor' ? 'hidden lg:block' : ''}`}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10">
          <div className="px-4 md:px-8 py-4 md:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-4">
                <Link
                  href="/admin/popups"
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} />
                </Link>
                <div>
                  <div className="flex items-center gap-2 md:gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-[#FF3131] to-[#FF3131]/60 flex items-center justify-center">
                      <Sparkle size={16} className="md:hidden text-white" />
                      <Sparkle size={20} className="hidden md:block text-white" />
                    </div>
                    <div>
                      <h1 className="text-base md:text-xl font-semibold text-white">Edit Popup</h1>
                      <p className="text-white/40 text-xs md:text-sm hidden sm:block">Modify your popup campaign</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <Link
                  href="/admin/popups"
                  className="hidden sm:block px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </Link>
                <Button
                  type="submit"
                  form="popup-form"
                  disabled={saving}
                  className="bg-[#FF3131] hover:bg-[#FF3131]/90 text-white px-3 md:px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  <FloppyDisk size={18} />
                  <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Changes'}</span>
                  <span className="sm:hidden">{saving ? '...' : 'Save'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 md:p-8">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 flex items-center gap-3"
            >
              <X size={18} />
              {error}
            </motion.div>
          )}
        
          <form id="popup-form" onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            {/* Name */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                Popup Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Summer Sale Banner"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors text-sm md:text-base"
              />
            </div>
          
            {/* Template Selection */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-3">
                Template
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3">
                {templateOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, template: opt.value }))}
                    className={`p-4 text-left rounded-xl border transition-all ${
                      formData.template === opt.value
                        ? 'bg-[#FF3131]/10 border-[#FF3131] text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <p className="font-medium text-sm mt-2">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
          
            {/* Position (if applicable) */}
            {positionOptions[formData.template].length > 1 && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
                <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-3">
                  Position
                </label>
                <div className="flex flex-wrap gap-2">
                  {positionOptions[formData.template].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, position: opt.value }))}
                      className={`px-4 py-2.5 text-sm rounded-lg border transition-all ${
                        formData.position === opt.value
                          ? 'bg-[#FF3131]/10 border-[#FF3131] text-white'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          
            {/* A/B Variants */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('ab-testing')}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-[#FF3131]" />
                  <h3 className="font-medium text-white text-sm md:text-base">A/B Testing</h3>
                  <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">
                    {formData.variants.length} variant{formData.variants.length > 1 ? 's' : ''}
                  </span>
                </div>
                {collapsedSections.has('ab-testing') ? (
                  <CaretDown size={18} className="text-white/40" />
                ) : (
                  <CaretUp size={18} className="text-white/40" />
                )}
              </button>
              
              <AnimatePresence>
                {!collapsedSections.has('ab-testing') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-white/10 pt-4">
                      {formData.variants.length < 4 && (
                        <button
                          type="button"
                          onClick={addVariant}
                          className="flex items-center gap-1 text-sm text-[#FF3131] hover:text-[#FF3131]/80 mb-4"
                        >
                          <Plus size={16} />
                          Add Variant
                        </button>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {formData.variants.map((v, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveVariant(i)}
                            className={`flex-1 min-w-[100px] py-2.5 px-3 md:px-4 text-sm rounded-lg border transition-all ${
                              activeVariant === i
                                ? 'bg-[#FF3131]/10 border-[#FF3131] text-white'
                                : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{v.name}</span>
                              <span className="text-xs opacity-70 ml-1">{v.weight}%</span>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {formData.variants.length > 1 && (
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                            Traffic Split for {formData.variants[activeVariant].name}
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={formData.variants[activeVariant].weight}
                              onChange={(e) => updateVariantWeight(activeVariant, Number(e.target.value))}
                              className="flex-1 accent-[#FF3131]"
                            />
                            <span className="text-white w-12 text-right font-mono">
                              {formData.variants[activeVariant].weight}%
                            </span>
                            {formData.variants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeVariant(activeVariant)}
                                className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          
            {/* Content Editor */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('content')}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Palette size={18} className="text-[#FF3131]" />
                  <h3 className="font-medium text-white text-sm md:text-base">Content & Design</h3>
                </div>
                {collapsedSections.has('content') ? (
                  <CaretDown size={18} className="text-white/40" />
                ) : (
                  <CaretUp size={18} className="text-white/40" />
                )}
              </button>
              
              <AnimatePresence>
                {!collapsedSections.has('content') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-white/10 pt-4 space-y-4">
                      <div>
                        <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Heading</label>
                        <input
                          type="text"
                          value={currentContent.heading || ''}
                          onChange={(e) => updateVariantContent('heading', e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Body Text</label>
                        <textarea
                          value={currentContent.body || ''}
                          onChange={(e) => updateVariantContent('body', e.target.value)}
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors resize-none"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Button Text</label>
                          <input
                            type="text"
                            value={currentContent.buttonText || ''}
                            onChange={(e) => updateVariantContent('buttonText', e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Button URL</label>
                          <input
                            type="text"
                            value={currentContent.buttonUrl || ''}
                            onChange={(e) => updateVariantContent('buttonUrl', e.target.value)}
                            placeholder="/products"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base placeholder:text-white/30 focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                          />
                        </div>
                      </div>
                      
                      {/* Colors */}
                      <div className="grid grid-cols-3 gap-2 md:gap-4">
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Background</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentContent.backgroundColor || '#18181B'}
                              onChange={(e) => updateVariantContent('backgroundColor', e.target.value)}
                              className="w-10 h-10 bg-transparent border border-white/10 rounded-lg cursor-pointer"
                            />
                            <input
                              type="text"
                              value={currentContent.backgroundColor || '#18181B'}
                              onChange={(e) => updateVariantContent('backgroundColor', e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#FF3131]/50 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Text</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentContent.textColor || '#ffffff'}
                              onChange={(e) => updateVariantContent('textColor', e.target.value)}
                              className="w-10 h-10 bg-transparent border border-white/10 rounded-lg cursor-pointer"
                            />
                            <input
                              type="text"
                              value={currentContent.textColor || '#ffffff'}
                              onChange={(e) => updateVariantContent('textColor', e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#FF3131]/50 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Button</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={currentContent.buttonColor || '#FF3131'}
                              onChange={(e) => updateVariantContent('buttonColor', e.target.value)}
                              className="w-10 h-10 bg-transparent border border-white/10 rounded-lg cursor-pointer"
                            />
                            <input
                              type="text"
                              value={currentContent.buttonColor || '#FF3131'}
                              onChange={(e) => updateVariantContent('buttonColor', e.target.value)}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-[#FF3131]/50 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Image Upload */}
                      <div>
                        <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Image (Optional)</label>
                        <div className="flex gap-4">
                          {currentContent.image && (
                            <div className="relative w-24 h-24 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                              <Image
                                src={currentContent.image}
                                alt=""
                                fill
                                className="object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => updateVariantContent('image', '')}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          )}
                          <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/20 rounded-lg p-4 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-colors">
                            <Upload size={24} className="text-white/40 mb-2" />
                            <span className="text-sm text-white/40">Click to upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          
            {/* Trigger Settings */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('trigger')}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontal size={18} className="text-[#FF3131]" />
                  <h3 className="font-medium text-white text-sm md:text-base">Trigger Settings</h3>
                </div>
                {collapsedSections.has('trigger') ? (
                  <CaretDown size={18} className="text-white/40" />
                ) : (
                  <CaretUp size={18} className="text-white/40" />
                )}
              </button>
              
              <AnimatePresence>
                {!collapsedSections.has('trigger') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 mb-4">
                        {triggerOptions.map(opt => {
                          const Icon = opt.icon
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, triggerType: opt.value }))}
                              className={`p-3 md:p-4 text-left rounded-xl border transition-all ${
                                formData.triggerType === opt.value
                                  ? 'bg-[#FF3131]/10 border-[#FF3131] text-white'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-center gap-2 md:gap-3">
                                <Icon size={18} />
                                <div>
                                  <p className="font-medium text-sm">{opt.label}</p>
                                  <p className="text-xs opacity-70 hidden sm:block">{opt.description}</p>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      
                      {(formData.triggerType === 'DELAY' || formData.triggerType === 'SCROLL') && (
                        <div>
                          <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">
                            {formData.triggerType === 'DELAY' ? 'Delay (seconds)' : 'Scroll percentage'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={formData.triggerType === 'SCROLL' ? 100 : 60}
                            value={formData.triggerValue}
                            onChange={(e) => setFormData(prev => ({ ...prev, triggerValue: Number(e.target.value) }))}
                            className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          
            {/* Frequency */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as PopupFrequency }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors"
              >
                {frequencyOptions.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
                ))}
              </select>
            </div>
          
            {/* Schedule */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={18} className="text-[#FF3131]" />
                <h3 className="font-medium text-white text-sm md:text-base">Schedule</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-white/40 uppercase tracking-[0.15em] mb-2">End Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    min={formData.startDate}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 md:px-4 py-2.5 md:py-3 text-white text-sm md:text-base focus:outline-none focus:border-[#FF3131]/50 focus:ring-1 focus:ring-[#FF3131]/20 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          
            {/* Active Toggle */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 md:p-6">
              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-6 h-6 border-2 border-white/20 rounded-lg bg-white/5 peer-checked:border-[#FF3131] peer-checked:bg-[#FF3131] transition-all flex items-center justify-center">
                    {formData.isActive && <Check size={14} className="text-white" />}
                  </div>
                </div>
                <div>
                  <p className="text-white text-sm md:text-base group-hover:text-white/90 transition-colors">Popup is active</p>
                  <p className="text-xs text-white/40">Uncheck to save as draft</p>
                </div>
              </label>
            </div>
          </form>
        </div>
      </div>
      
      {/* Preview Panel */}
      <div className={`flex-1 lg:w-1/2 bg-zinc-950 flex flex-col ${mobileTab !== 'preview' ? 'hidden lg:flex' : ''}`}>
        {/* Preview Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-medium text-white flex items-center gap-2 text-sm md:text-base">
            <Eye size={18} className="text-[#FF3131]" />
            Live Preview
          </h2>
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`p-2 rounded-md transition-colors ${previewDevice === 'desktop' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/60'}`}
            >
              <Desktop size={18} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`p-2 rounded-md transition-colors ${previewDevice === 'mobile' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/60'}`}
            >
              <DeviceMobile size={18} />
            </button>
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950">
          <div 
            className={`relative bg-zinc-900 border border-white/10 rounded-xl transition-all overflow-hidden shadow-2xl ${
              previewDevice === 'mobile' ? 'w-[375px] h-[667px]' : 'w-full h-full max-w-4xl'
            }`}
          >
            {/* Fake page content */}
            <div className="absolute inset-0 p-4 opacity-20">
              <div className="h-12 bg-white/10 rounded-lg mb-4" />
              <div className="grid grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="aspect-square bg-white/10 rounded-lg" />
                ))}
              </div>
            </div>
            
            {/* Popup Preview */}
            <AnimatePresence>
              {renderPreview()}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
