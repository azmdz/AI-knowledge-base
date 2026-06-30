import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAIProvider } from '@/lib/ai'

const UpdateSchema = z.object({
  title: z.string().min(1).max(200),
  bodyRaw: z.string().min(1),
  bodyFormatted: z.string().nullable().optional(),
  status: z.enum(['published', 'draft']).optional(),
  tags: z.array(z.string()).optional().default([]),
  tagSources: z
    .record(z.string(), z.enum(['user', 'ai_suggested']))
    .optional()
    .default({}),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
    })

    if (!article) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (article.status === 'published') {
      const updated = await prisma.article.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      return NextResponse.json({ ...article, viewCount: updated.viewCount })
    }

    return NextResponse.json(article)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const requesterId = req.headers.get('x-user-id')
  if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, bodyRaw, bodyFormatted, status, tags, tagSources } = parsed.data

  try {
    const existing = await prisma.article.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.authorId !== requesterId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const ai = getAIProvider()
    const embedding = await ai.embed(title + '\n' + bodyRaw)

    const article = await prisma.article.update({
      where: { id },
      data: {
        title,
        bodyRaw,
        bodyFormatted: bodyFormatted ?? null,
        ...(status ? { status } : {}),
        embedding: JSON.stringify(embedding),
        embeddingModel: 'tfidf-updated',
      },
    })

    await prisma.articleTag.deleteMany({ where: { articleId: id } })
    for (const name of tags) {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      })
      await prisma.articleTag.create({
        data: { articleId: id, tagId: tag.id, source: tagSources[name] ?? 'user' },
      })
    }

    return NextResponse.json(article)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const requesterId = req.headers.get('x-user-id')
  if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const existing = await prisma.article.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.authorId !== requesterId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await prisma.article.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
