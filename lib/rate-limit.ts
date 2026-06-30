import { NextRequest } from 'next/server'

// In-memory rate limiter. Works for single-process (local dev / single instance).
// Replace with Redis/Upstash for multi-instance production deployments.
type Entry = { count: number; resetAt: number }
const store = new Map<string, Entry>()

let cleanupCounter = 0

function maybeCleanup() {
  if (++cleanupCounter < 100) return
  cleanupCounter = 0
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

export type RateLimitResult = { allowed: true } | { allowed: false; resetAt: number }

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    maybeCleanup()
    return { allowed: true }
  }
  if (entry.count >= limit) {
    return { allowed: false, resetAt: entry.resetAt }
  }
  entry.count++
  return { allowed: true }
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local'
}

export function retryAfterSeconds(resetAt: number): string {
  return String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)))
}
