import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const authorId = req.headers.get('x-user-id')
  if (!authorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const drafts = await prisma.article.findMany({
      where: { status: 'draft', authorId },
      include: { author: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(drafts)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
