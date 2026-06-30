import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAIProvider } from '@/lib/ai'
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit'

const TagsSchema = z.object({
  body: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`tags:${ip}`, 10, 60_000)
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

  const parsed = TagsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ai = getAIProvider()
    const tags = await ai.suggestTags(parsed.data.body)
    return NextResponse.json({ tags })
  } catch (err) {
    console.error('AI tags error:', err)
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}
