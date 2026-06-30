import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'
import { cosineSimilarity } from '@/lib/ai/similarity'
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit'
import type { ArticleContext } from '@/lib/ai/provider'

const SearchSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(['ai', 'regular']).optional().default('ai'),
  topK: z.number().int().min(1).max(10).optional().default(5),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`search:${ip}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': retryAfterSeconds(rl.resetAt) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = SearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { query, mode, topK } = parsed.data

  try {
    // --- 通常検索 ---
    if (mode === 'regular') {
      const articles = await prisma.article.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: query } },
            { bodyRaw: { contains: query } },
            { bodyFormatted: { contains: query } },
          ],
        },
        include: {
          author: { select: { name: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return NextResponse.json({
        mode: 'regular',
        articles: articles.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: makeExcerpt(a.bodyFormatted ?? a.bodyRaw, query),
          tags: a.tags.map((t) => t.tag.name),
          author: a.author.name,
          createdAt: a.createdAt,
        })),
      })
    }

    // --- AI検索 (RAG) ---
    const ai = getAIProvider()
    const queryEmbedding = await ai.embed(query)

    const articles = await prisma.article.findMany({
      where: { status: 'published', embedding: { not: null } },
      select: {
        id: true,
        title: true,
        bodyRaw: true,
        bodyFormatted: true,
        embedding: true,
      },
    })

    const MAX_BODY_CHARS = 1500

    const scored = articles
      .flatMap((a) => {
        try {
          const vec = JSON.parse(a.embedding!) as number[]
          return [{ ...a, score: cosineSimilarity(queryEmbedding, vec) }]
        } catch {
          return []
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    const context: ArticleContext[] = scored.map((a) => ({
      id: a.id,
      title: a.title,
      bodyRaw: a.bodyRaw.slice(0, MAX_BODY_CHARS),
      bodyFormatted: a.bodyFormatted ? a.bodyFormatted.slice(0, MAX_BODY_CHARS) : null,
    }))

    const { answer, citedIds } = await ai.answer(query, context)

    const citedArticles = await prisma.article.findMany({
      where: { id: { in: citedIds } },
      select: {
        id: true,
        title: true,
        tags: { include: { tag: true } },
      },
    })

    const log = await prisma.searchLog.create({
      data: {
        query,
        answer,
        citedArticles: JSON.stringify(citedIds),
      },
    })

    return NextResponse.json({
      mode: 'ai',
      logId: log.id,
      answer,
      citedArticles: citedArticles.map((a) => ({
        id: a.id,
        title: a.title,
        tags: a.tags.map((t) => t.tag.name),
      })),
    })
  } catch (e) {
    console.error('Search error:', e)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

function makeExcerpt(body: string, query: string, maxLen = 160): string {
  const plain = body
    .replace(/[#*`>\-_[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const idx = plain.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return plain.slice(0, maxLen) + (plain.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(plain.length, idx + query.length + 100)
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '')
}
