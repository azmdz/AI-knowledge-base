import type { ArticleContext, SearchResult } from './provider'

// Shared parser for both RealProvider and OpenAIProvider.
// The AI is asked to append {"cited_ids": ["id1", "id2"]} at the end of its reply.
export function parseAnswerResponse(text: string, fallback: ArticleContext[]): SearchResult {
  const jsonMatch = text.match(/\{"cited_ids":\s*\[[\s\S]*?\]\}/)
  let citedIds: string[] = []

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { cited_ids?: unknown }
      if (Array.isArray(parsed.cited_ids)) {
        citedIds = (parsed.cited_ids as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      }
    } catch {
      // fall through to default
    }
  }

  if (citedIds.length === 0) {
    citedIds = fallback.slice(0, 3).map((a) => a.id)
  }

  const answer = text.replace(/\{"cited_ids":\s*\[[\s\S]*?\]\}/, '').trim()
  return { answer: answer || text.trim(), citedIds }
}
