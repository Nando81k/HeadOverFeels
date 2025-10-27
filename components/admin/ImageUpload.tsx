'use client'

import { useState, useCallback, useMemo } from 'react'
import Image from 'next/image'

interface ImageUploadProps {
  images: string[]
  onImagesChange?: (images: string[]) => void
  onChange?: (images: string[]) => void
  maxImages?: number
}

export function ImageUpload({ images, onImagesChange, onChange, maxImages = 5 }: ImageUploadProps) {
  const handleChange = useMemo(
    () => onImagesChange || onChange || (() => {}),
    [onImagesChange, onChange]
  )
  const [uploading, setUploading] = useState(false)

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // Check if adding these files would exceed max
    if (images.length + files.length > maxImages) {
      alert(`You can only upload up to ${maxImages} images`)
      return
    }

    setUploading(true)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Upload failed')
        }

        const data = await response.json()
        return data.url
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      handleChange([...images, ...uploadedUrls])
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload images. Please try again.')
    } finally {
      setUploading(false)
      // Reset the input
      e.target.value = ''
    }
  }, [images, handleChange, maxImages])

  const handleRemoveImage = useCallback((index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    handleChange(newImages)
  }, [images, handleChange])

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = parseInt(e.dataTransfer.getData('text/html'))
    
    if (dragIndex === dropIndex) return

    const newImages = [...images]
    const [draggedImage] = newImages.splice(dragIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)
    
    handleChange(newImages)
  }, [images, handleChange])

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div className="flex items-center gap-4">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading || images.length >= maxImages}
            className="hidden"
          />
          <div className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors inline-block">
            {uploading ? 'Uploading...' : 'Upload Images'}
          </div>
        </label>
        <span className="text-sm text-gray-500">
          {images.length} / {maxImages} images
        </span>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {images.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-black transition-colors cursor-move"
            >
              <Image
                src={url}
                alt={`Product ${index + 1}`}
                fill
                className="object-cover"
              />
              
              {/* Primary Badge */}
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-1 rounded">
                  Primary
                </div>
              )}

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Drag Handle Indicator */}
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      {images.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            Drag and drop images here, or click to upload
          </p>
          <p className="mt-1 text-xs text-gray-500">
            PNG, JPG, GIF up to 10MB
          </p>
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        The first image will be the primary product image. Drag to reorder images.
      </p>
    </div>
  )
}