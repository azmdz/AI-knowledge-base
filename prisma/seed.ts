import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import seedData from './seed-data.json'

const url = process.env.DATABASE_URL ?? 'file:./dev.db'
const authToken = process.env.TURSO_AUTH_TOKEN
const adapter = new PrismaLibSql({ url, authToken })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding users...')
  for (const user of seedData.users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    })
  }

  console.log('Seeding articles...')
  for (const article of seedData.articles) {
    const existing = await prisma.article.findFirst({
      where: { title: article.title },
    })
    if (existing) {
      console.log('  Skipping:', article.title)
      continue
    }

    const embedding = buildSimpleEmbedding(article.title + '\n' + article.body)

    const created = await prisma.article.create({
      data: {
        title: article.title,
        bodyRaw: article.body,
        bodyFormatted: article.body,
        authorId: article.authorId,
        viewCount: article.viewCount,
        embedding: JSON.stringify(embedding),
        embeddingModel: 'tfidf-seed',
        tags: {
          create: await Promise.all(
            article.tags.map(async (name: string) => {
              const tag = await prisma.tag.upsert({
                where: { name },
                update: {},
                create: { name },
              })
              return { tagId: tag.id, source: 'user' }
            }),
          ),
        },
      },
    })
    console.log('  Created:', created.title)
  }

  console.log('Done!')
}

function buildSimpleEmbedding(text: string): number[] {
  const dim = 256
  const vec = new Array<number>(dim).fill(0)
  const normalized = text.toLowerCase()

  const asciiWords = normalized.match(/[a-z0-9][a-z0-9]*/g) ?? []
  const cjkChars = normalized.replace(/[^぀-鿿]/g, '')
  const bigrams: string[] = []
  for (let i = 0; i < cjkChars.length - 1; i++) {
    bigrams.push(cjkChars.slice(i, i + 2))
  }

  const tokens = [...asciiWords, ...bigrams]
  if (tokens.length === 0) return vec

  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)

  for (const [t, f] of freq) {
    let h = 0
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
    vec[h % dim] += f / tokens.length
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
