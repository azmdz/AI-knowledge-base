import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const FeedbackSchema = z.object({
  wasHelpful: z.boolean(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const existing = await prisma.searchLog.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Search log not found' }, { status: 404 })

    const log = await prisma.searchLog.update({
      where: { id },
      data: { wasHelpful: parsed.data.wasHelpful },
    })
    return NextResponse.json(log)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
