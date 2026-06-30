import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'

const CreateArticleSchema = z.object({
  title: z.string().min(1).max(200),
  bodyRaw: z.string().min(1),
  bodyFormatted: z.string().optional(),
  status: z.enum(['published', 'draft']).optional().default('published'),
  tags: z.array(z.string()).optional().default([]),
  tagSources: z
    .record(z.string(), z.enum(['user', 'ai_suggested']))
    .optional()
    .default({}),
})

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const tag = searchParams.get('tag')
  const sort = searchParams.get('sort') ?? 'newest'

  try {
    const articles = await prisma.article.findMany({
      where: {
        status: 'published',
        ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: sort === 'popular' ? { viewCount: 'desc' } : { createdAt: 'desc' },
    })

    return NextResponse.json(articles)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authorId = req.headers.get('x-user-id')
  if (!authorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateArticleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { title, bodyRaw, bodyFormatted, status, tags, tagSources } = parsed.data

  try {
    const author = await prisma.user.findUnique({ where: { id: authorId } })
    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 })
    }

    const ai = getAIProvider()
    const textForEmbed = `${title}\n${bodyFormatted ?? bodyRaw}`
    const embedding = await ai.embed(textForEmbed)

    const article = await prisma.article.create({
      data: {
        title,
        bodyRaw,
        bodyFormatted: bodyFormatted ?? null,
        authorId,
        status,
        embedding: JSON.stringify(embedding),
        embeddingModel: process.env.AI_PROVIDER === 'anthropic' ? 'tfidf-real' : 'tfidf-mock',
        tags: {
          create: await Promise.all(
            tags.map(async (name) => {
              const tag = await prisma.tag.upsert({
                where: { name },
                update: {},
                create: { name },
              })
              return {
                tagId: tag.id,
                source: tagSources?.[name] ?? 'user',
              }
            }),
          ),
        },
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    })

    return NextResponse.json(article, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
