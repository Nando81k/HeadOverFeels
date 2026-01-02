import { getGeminiClient, GEMINI_FLASH, GENERATION_CONFIG } from './config'

interface ReviewData {
  rating: number
  title: string | null
  comment: string
  customerName: string
  isVerified: boolean
}

interface ReviewSummaryInput {
  productName: string
  reviews: ReviewData[]
  averageRating: number
  totalReviews: number
}

export interface ReggieReviewSummary {
  headline: string
  summary: string
  pros: string[]
  cons: string[]
  bestFor: string
  reggieVerdict: string
}

const REVIEW_SUMMARY_PROMPT = `You are Reggie, the AI shopping assistant for Head Over Feels streetwear. You're analyzing customer reviews to create a helpful summary for other shoppers.

Your task: Read through all the reviews and create an authentic, helpful summary that captures the real customer experience.

Your voice: You're a New York streetwear expert - direct, authentic, casual but knowledgeable. Use natural language like "no cap", "fire", "clean", "lowkey", "bet" when it fits.

Create a JSON response with these fields:
{
  "headline": "A punchy 5-8 word summary (e.g., 'Customers Are Loving This Piece')",
  "summary": "2-3 sentences capturing the overall customer sentiment. Be specific about what customers mention most.",
  "pros": ["3-4 specific positives customers mention - be concrete (e.g., 'Runs true to size', 'Super soft fabric')"],
  "cons": ["1-2 honest negatives if any exist, or empty array if reviews are overwhelmingly positive"],
  "bestFor": "One sentence about who this product is perfect for",
  "reggieVerdict": "Your 1-2 sentence personal take as Reggie - give it personality!"
}

Guidelines:
- Be authentic to what customers actually say
- Highlight specific details (fit, quality, comfort, style)
- If there are concerns, be honest about them
- Keep the vibe positive but real
- Your verdict should have personality

Product: {{productName}}
Average Rating: {{averageRating}}/5 ({{totalReviews}} reviews)

Customer Reviews:
{{reviews}}

Respond with ONLY valid JSON, no markdown code blocks.`

export async function generateReviewSummary(input: ReviewSummaryInput): Promise<ReggieReviewSummary> {
  const { productName, reviews, averageRating, totalReviews } = input

  // Format reviews for the prompt
  const reviewsText = reviews
    .map((r, i) => {
      const verified = r.isVerified ? '✓ Verified Purchase' : ''
      return `Review ${i + 1} (${r.rating}/5 stars) ${verified}
${r.title ? `"${r.title}"` : ''}
${r.comment}
- ${r.customerName}`
    })
    .join('\n\n')

  const prompt = REVIEW_SUMMARY_PROMPT
    .replace('{{productName}}', productName)
    .replace('{{averageRating}}', averageRating.toFixed(1))
    .replace('{{totalReviews}}', totalReviews.toString())
    .replace('{{reviews}}', reviewsText)

  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({
      model: GEMINI_FLASH,
      generationConfig: {
        ...GENERATION_CONFIG,
        temperature: 0.8, // Slightly higher for more personality
        maxOutputTokens: 1024,
      },
    })

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    jsonText = jsonText.trim()

    const summary = JSON.parse(jsonText) as ReggieReviewSummary

    // Validate required fields
    if (!summary.headline || !summary.summary || !summary.reggieVerdict) {
      throw new Error('Invalid summary format')
    }

    return {
      headline: summary.headline,
      summary: summary.summary,
      pros: Array.isArray(summary.pros) ? summary.pros.slice(0, 4) : [],
      cons: Array.isArray(summary.cons) ? summary.cons.slice(0, 2) : [],
      bestFor: summary.bestFor || '',
      reggieVerdict: summary.reggieVerdict,
    }
  } catch (error) {
    console.error('Failed to generate review summary:', error)
    
    // Return a fallback summary based on the data
    const sentiment = averageRating >= 4.5 
      ? 'Customers are loving this' 
      : averageRating >= 4 
        ? 'Getting solid reviews'
        : averageRating >= 3
          ? 'Mixed feedback on this one'
          : 'Some concerns to consider'

    return {
      headline: `${sentiment} piece`,
      summary: `Based on ${totalReviews} reviews with an average rating of ${averageRating.toFixed(1)}/5 stars, customers generally ${averageRating >= 4 ? 'recommend' : 'have thoughts about'} this item.`,
      pros: [],
      cons: [],
      bestFor: 'Check the individual reviews for more details.',
      reggieVerdict: `With ${totalReviews} reviews at ${averageRating.toFixed(1)} stars, ${averageRating >= 4 ? 'this is looking solid!' : 'worth checking the details.'}`,
    }
  }
}
