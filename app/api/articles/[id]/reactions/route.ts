import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const ReactionSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(['like', 'helpful']),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const userId = req.nextUrl.searchParams.get('userId')

  try {
    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { articleId: id },
      _count: { type: true },
    })

    const counts = { like: 0, helpful: 0 }
    for (const r of reactions) {
      if (r.type === 'like' || r.type === 'helpful') counts[r.type] = r._count.type
    }

    let userReacted: string[] = []
    if (userId) {
      const userReactions = await prisma.reaction.findMany({
        where: { articleId: id, userId },
        select: { type: true },
      })
      userReacted = userReactions.map((r) => r.type)
    }

    return NextResponse.json({ counts, userReacted })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// トグル動作: 既にリアクション済みなら削除、未リアクションなら追加
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ReactionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { userId, type } = parsed.data

  try {
    const article = await prisma.article.findUnique({ where: { id } })
    if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

    const existing = await prisma.reaction.findUnique({
      where: { articleId_userId_type: { articleId: id, userId, type } },
    })

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } })
    } else {
      await prisma.reaction.create({ data: { articleId: id, userId, type } })
    }

    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { articleId: id },
      _count: { type: true },
    })

    const userReactions = await prisma.reaction.findMany({
      where: { articleId: id, userId },
      select: { type: true },
    })

    const counts = { like: 0, helpful: 0 }
    for (const r of reactions) {
      if (r.type === 'like' || r.type === 'helpful') counts[r.type] = r._count.type
    }

    return NextResponse.json({
      counts,
      userReacted: userReactions.map((r) => r.type),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
