import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default cloudinary

// Helper function to upload image
export async function uploadImage(
  file: string,
  options: {
    folder?: string
    public_id?: string
    transformation?: Record<string, string | number>
  } = {}
) {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: options.folder || 'head-over-feels/products',
      public_id: options.public_id,
      transformation: options.transformation,
      quality: 'auto',
      fetch_format: 'auto',
    })

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

// Helper function to delete image
export async function deleteImage(public_id: string) {
  try {
    const result = await cloudinary.uploader.destroy(public_id)
    return {
      success: result.result === 'ok',
      result: result.result,
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    }
  }
}

// Helper function to get optimized image URL
export function getOptimizedImageUrl(
  public_id: string,
  options: {
    width?: number
    height?: number
    crop?: string
    quality?: string | number
    format?: string
  } = {}
) {
  return cloudinary.url(public_id, {
    width: options.width,
    height: options.height,
    crop: options.crop || 'fill',
    quality: options.quality || 'auto',
    fetch_format: options.format || 'auto',
  })
}