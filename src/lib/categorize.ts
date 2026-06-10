import Anthropic from '@anthropic-ai/sdk'
import { getDb } from './db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CategoryOption {
  id: number
  name: string
}

interface CategorizationResult {
  business_name_normalized: string
  category_id: number | null
  confidence: 'high' | 'low'
}

// Max's built-in categories → our category name mapping
const MAX_CATEGORY_MAP: Record<string, string> = {
  'מזון וצריכה': 'מזון וצריכה',
  'מסעדות, קפה וברים': 'מסעדות, קפה וברים',
  'אופנה': 'אופנה',
  'חשמל ומחשבים': 'חשמל ומחשבים',
  'פנאי, בידור וספורט': 'פנאי, בידור וספורט',
  'שירותי תקשורת': 'שירותי תקשורת',
  'ביטוח': 'ביטוח',
  'דלק, חשמל וגז': 'דלק, חשמל וגז',
  'עירייה וממשלה': 'עירייה וממשלה',
  'העברת כספים': 'העברת כספים',
  'בריאות': 'בריאות',
  'שונות': 'שונות',
}

export async function categorizeBusinessNames(
  businessNames: Array<{ normalized: string; original: string; max_hint: string | null }>
): Promise<CategorizationResult[]> {
  const db = getDb()
  const categories = db.prepare('SELECT id, name FROM categories ORDER BY name').all() as CategoryOption[]
  const categoryByName = new Map(categories.map(c => [c.name, c.id]))

  // First pass: apply Max's own category hints directly (high confidence, no Claude needed)
  const results: CategorizationResult[] = []
  const needsClaude: typeof businessNames = []

  for (const item of businessNames) {
    if (item.max_hint && MAX_CATEGORY_MAP[item.max_hint]) {
      const ourCategoryName = MAX_CATEGORY_MAP[item.max_hint]
      const catId = categoryByName.get(ourCategoryName) ?? null
      if (catId) {
        results.push({ business_name_normalized: item.normalized, category_id: catId, confidence: 'high' })
        continue
      }
    }
    needsClaude.push(item)
  }

  // Second pass: Claude for anything not covered by Max's hints
  if (needsClaude.length > 0) {
    const chunks = chunkArray(needsClaude, 20)
    for (const chunk of chunks) {
      const chunkResults = await categorizeBatch(chunk, categories, categoryByName)
      results.push(...chunkResults)
    }
  }

  return results
}

async function categorizeBatch(
  items: Array<{ normalized: string; original: string; max_hint: string | null }>,
  categories: CategoryOption[],
  categoryByName: Map<string, number>
): Promise<CategorizationResult[]> {
  const categoryList = categories.map(c => `"${c.name}"`).join(', ')

  const businessList = items.map((item, i) =>
    `${i + 1}. "${item.original}"`
  ).join('\n')

  const prompt = `Categorize these Israeli business/merchant names for a family budget tracker.

Categories (use EXACT spelling): ${categoryList}

For each item return JSON with index, category_name (exact match from list), and confidence ("high" or "low").
Use "low" only if you genuinely cannot tell what kind of business it is.
Always provide a best-guess category even at low confidence.

Businesses:
${businessList}

Return a JSON array only, no markdown, no extra text:
[{"index":1,"category_name":"...","confidence":"high"},...]`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'

    // Strip markdown code blocks if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const parsed = JSON.parse(cleaned) as Array<{
      index: number
      category_name: string
      confidence: 'high' | 'low'
    }>

    return parsed.map(result => {
      const item = items[result.index - 1]
      if (!item) return null

      // Try exact match first, then case-insensitive
      let catId = categoryByName.get(result.category_name)
      if (!catId) {
        for (const [name, id] of categoryByName.entries()) {
          if (name.toLowerCase() === result.category_name.toLowerCase()) {
            catId = id
            break
          }
        }
      }

      return {
        business_name_normalized: item.normalized,
        category_id: catId ?? null,
        confidence: result.confidence,
      }
    }).filter((r): r is CategorizationResult => r !== null)

  } catch (err) {
    console.error('Categorization error:', err)
    // Fallback: return שונות (misc) category for all, low confidence
    const miscId = categoryByName.get('שונות') ?? null
    return items.map(item => ({
      business_name_normalized: item.normalized,
      category_id: miscId,
      confidence: 'low' as const,
    }))
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}
