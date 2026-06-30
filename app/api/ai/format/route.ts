import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAIProvider } from '@/lib/ai'
import { checkRateLimit, getClientIp, retryAfterSeconds } from '@/lib/rate-limit'

const FormatSchema = z.object({
  raw: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit(`format:${ip}`, 10, 60_000)
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

  const parsed = FormatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const ai = getAIProvider()
    const result = await ai.format(parsed.data.raw)
    return NextResponse.json(result)
  } catch (err) {
    console.error('AI format error:', err)
    return NextResponse.json({ error: 'AI processing failed' }, { status: 500 })
  }
}
