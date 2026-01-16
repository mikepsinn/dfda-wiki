/**
 * Google Gemini AI Image Generation Utility
 *
 * Uses the @google/genai SDK to generate images via Gemini API
 * Documentation: https://ai.google.dev/gemini-api/docs/libraries
 * npm: https://www.npmjs.com/package/@google/genai
 */

import { GoogleGenAI } from '@google/genai'

// Simple logger to avoid env validation issues in standalone scripts
const log = {
  info: (...args: any[]) => console.log('[genai-image]', ...args),
  error: (...args: any[]) => console.error('[genai-image]', ...args),
}

/**
 * Initialize the Google Gen AI client
 */
function getClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set')
  }

  return new GoogleGenAI({ apiKey })
}

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  /** The text prompt describing the image to generate */
  prompt: string

  /** Number of images to generate (1-8, default: 1) */
  count?: number

  /** Image aspect ratio (default: '1:1') */
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'

  /** Model to use (default: 'gemini-3-pro-image-preview' - Nano Banana Pro) */
  model?: string

  /** Negative prompt - what to avoid in the image */
  negativePrompt?: string

  /** Safety filter level */
  safetyFilterLevel?: 'block_none' | 'block_some' | 'block_most'

  /** Person generation setting */
  personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all'
}

/**
 * Generated image result
 */
export interface GeneratedImage {
  /** Base64-encoded image data */
  imageBytes: string

  /** RAI (Responsible AI) filter reason if filtered */
  raiFilteredReason?: string

  /** Enhanced/rewritten prompt if prompt enhancer was enabled */
  enhancedPrompt?: string
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  /** Array of generated images */
  images: GeneratedImage[]

  /** Model used for generation */
  model: string

  /** Original prompt */
  prompt: string
}

/**
 * Generate images using Google Gemini Imagen API
 *
 * @example
 * ```typescript
 * const result = await generateImages({
 *   prompt: 'A neobrutalist propaganda poster for medical research',
 *   count: 2,
 *   aspectRatio: '16:9'
 * })
 *
 * // Save the first image
 * const imageBuffer = Buffer.from(result.images[0].data, 'base64')
 * await fs.writeFile('output.png', imageBuffer)
 * ```
 */
export async function generateImages(
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  const {
    prompt,
    count = 1,
    aspectRatio = '1:1',
    model = 'gemini-3-pro-image-preview',
    negativePrompt,
  } = options

  log.info('Generating images', {
    prompt: prompt.substring(0, 100),
    count,
    aspectRatio,
    model,
  })

  try {
    const client = getClient()
    const images: GeneratedImage[] = []

    // Build the full prompt with aspect ratio and negative prompt
    let fullPrompt = prompt
    fullPrompt += `\n\nIMPORTANT: Generate image with aspect ratio ${aspectRatio}.`
    if (negativePrompt) {
      fullPrompt += `\n\nDO NOT include: ${negativePrompt}`
    }

    // Generate images one at a time (Gemini doesn't support batch generation in one call)
    for (let i = 0; i < count; i++) {
      const response = await client.models.generateContent({
        model,
        contents: fullPrompt,
      })

      // Extract image from response
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0]
        const parts = candidate.content?.parts || []

        for (const part of parts) {
          if (part.inlineData?.data) {
            images.push({
              imageBytes: part.inlineData.data,
              raiFilteredReason: undefined,
              enhancedPrompt: undefined,
            })
          }
        }
      }
    }

    if (images.length === 0) {
      throw new Error('No images were generated')
    }

    log.info('Images generated successfully', {
      count: images.length,
      model,
    })

    return {
      images,
      model,
      prompt,
    }
  } catch (error: any) {
    log.error('Failed to generate images', {
      error: error.message || String(error),
      prompt: prompt.substring(0, 100),
    })
    throw new Error(`Image generation failed: ${error.message || String(error)}`)
  }
}

/**
 * Image metadata for embedding in files
 */
export interface ImageMetadata {
  title?: string
  description?: string
  author?: string
  copyright?: string
  keywords?: string[]
}

/**
 * Add text watermark and metadata to an image buffer
 *
 * @param imageBuffer - The image buffer to watermark
 * @param metadata - Image metadata to embed
 * @returns Buffer with watermark and metadata applied
 */
export async function addWatermark(
  imageBuffer: Buffer,
  metadata?: ImageMetadata
): Promise<Buffer> {
  const sharp = (await import('sharp')).default

  const image = sharp(imageBuffer)
  const imgMetadata = await image.metadata()
  const imageWidth = imgMetadata.width || 1200
  const imageHeight = imgMetadata.height || 630

  // Calculate font size based on image width (1.5% of width - smaller)
  const fontSize = Math.floor(imageWidth * 0.015)
  const padding = 3

  // Create text SVG with transparent background
  const text = 'dfda.earth'
  const textWidth = text.length * fontSize * 0.6 // Approximate width
  const textHeight = fontSize * 1.4

  const svgText = `
    <svg width="${textWidth}" height="${textHeight}">
      <text x="0" y="${fontSize}"
            font-family="Courier New, monospace"
            font-size="${fontSize}px"
            font-weight="600"
            fill="rgba(0, 0, 0, 0.8)">${text}</text>
    </svg>
  `

  const textBuffer = Buffer.from(svgText)

  // Position text in lower right corner
  const left = imageWidth - textWidth - padding
  const top = imageHeight - textHeight - padding

  // Prepare EXIF metadata in proper IFD0 structure
  const exifData: any = {}

  if (metadata?.description || metadata?.author || metadata?.copyright) {
    exifData.IFD0 = {}
    if (metadata?.description) exifData.IFD0.ImageDescription = metadata.description
    if (metadata?.author) exifData.IFD0.Artist = metadata.author
    if (metadata?.copyright) exifData.IFD0.Copyright = metadata.copyright
  }

  // Composite text onto image and add metadata
  let processedImage = image.composite([
    {
      input: textBuffer,
      left: Math.floor(left),
      top: Math.floor(top),
    },
  ])

  // Add EXIF metadata if we have any
  if (Object.keys(exifData).length > 0) {
    processedImage = processedImage.withExif(exifData)
  }

  const result = await processedImage.toBuffer()

  log.info('Watermark and metadata applied', {
    text,
    imageWidth,
    imageHeight,
    fontSize,
    hasMetadata: Object.keys(exifData).length > 0
  })
  return result
}

/**
 * Save a generated image to a file
 *
 * @example
 * ```typescript
 * const result = await generateImages({ prompt: 'A cat' })
 * await saveImage(result.images[0], 'output/cat.png', {
 *   metadata: { title: 'Cat Photo', author: 'AI Generator' }
 * })
 * ```
 */
export async function saveImage(
  image: GeneratedImage,
  filePath: string,
  options?: { addWatermark?: boolean; metadata?: ImageMetadata }
): Promise<void> {
  const fs = await import('fs/promises')
  const path = await import('path')

  // Check if image was filtered
  if (image.raiFilteredReason) {
    throw new Error(`Image was filtered: ${image.raiFilteredReason}`)
  }

  if (!image.imageBytes) {
    throw new Error('No image data available')
  }

  // Ensure directory exists
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })

  // Decode base64
  let buffer: Buffer = Buffer.from(image.imageBytes, 'base64')

  // Add watermark if enabled (default: true)
  if (options?.addWatermark !== false) {
    buffer = await addWatermark(buffer, options?.metadata)
  }

  // Write to file
  await fs.writeFile(filePath, buffer)

  log.info('Image saved', { filePath, size: buffer.length })
}

/**
 * Generate and save images in one step
 *
 * @example
 * ```typescript
 * await generateAndSaveImages({
 *   prompt: 'Neobrutalist medical research poster',
 *   count: 3,
 *   outputDir: 'public/assets/generated',
 *   filePrefix: 'poster',
 *   metadata: {
 *     title: 'Medical Research Poster',
 *     author: 'dFDA',
 *     copyright: '2025 dfda.earth'
 *   }
 * })
 * // Creates: poster-1.png, poster-2.png, poster-3.png (with watermark and metadata)
 * ```
 */
export async function generateAndSaveImages(options: {
  prompt: string
  count?: number
  aspectRatio?: ImageGenerationOptions['aspectRatio']
  outputDir: string
  filePrefix: string
  format?: 'png' | 'jpg'
  addWatermark?: boolean
  metadata?: ImageMetadata
}): Promise<string[]> {
  const {
    prompt,
    count = 1,
    aspectRatio,
    outputDir,
    filePrefix,
    format = 'png',
    addWatermark = true,
    metadata,
  } = options

  const result = await generateImages({
    prompt,
    count,
    aspectRatio,
  })

  const filePaths: string[] = []

  for (let i = 0; i < result.images.length; i++) {
    const fileName = count === 1
      ? `${filePrefix}.${format}`
      : `${filePrefix}-${i + 1}.${format}`

    const filePath = `${outputDir}/${fileName}`
    await saveImage(result.images[i], filePath, { addWatermark, metadata })
    filePaths.push(filePath)
  }

  log.info('Generated and saved images', {
    count: filePaths.length,
    outputDir,
  })

  return filePaths
}
