import Link from 'next/link'
import InboxIcon from '@mui/icons-material/Inbox'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import { prisma } from '@/lib/prisma'
import { ArticleCard } from '@/components/ArticleCard'
import { TagFilter } from '@/components/TagFilter'

type SearchParams = {
  tag?: string
  sort?: string
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { tag, sort = 'newest' } = await searchParams

  const [articles, allTags] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'published',
        ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      },
      include: {
        author: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: sort === 'popular' ? { viewCount: 'desc' } : { createdAt: 'desc' },
    }),
    prisma.tag.findMany({
      include: { _count: { select: { articles: true } } },
      orderBy: { articles: { _count: 'desc' } },
      take: 20,
    }),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">記事一覧</h1>
          <p className="text-sm text-gray-500 mt-1">{articles.length} 件</p>
        </div>
        <div className="flex gap-2 text-sm">
          <SortLink sort="newest" current={sort} tag={tag}>
            新着順
          </SortLink>
          <SortLink sort="popular" current={sort} tag={tag}>
            人気順
          </SortLink>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="hidden md:block w-48 flex-shrink-0">
          <TagFilter
            tags={allTags.map((t) => ({ name: t.name, count: t._count.articles }))}
            current={tag}
            sort={sort}
          />
        </aside>

        <div className="flex-1 min-w-0">
          {articles.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <InboxIcon
                style={{ fontSize: 48, marginBottom: 12, display: 'block', margin: '0 auto 12px' }}
              />
              <p>記事がありません。</p>
              <Link
                href="/new"
                className="mt-4 inline-block text-indigo-600 hover:underline text-sm"
              >
                最初の記事を書く →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800 flex items-start gap-3">
        <SmartToyIcon style={{ fontSize: 28, flexShrink: 0 }} />
        <div>
          <p className="font-semibold">AI で質問して答えを探す</p>
          <p className="text-indigo-600 mt-0.5">
            キーワード検索だけでなく、自然言語で質問できます。
            <Link href="/search" className="underline ml-1 font-medium">
              AI検索を試す →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function SortLink({
  sort,
  current,
  tag,
  children,
}: {
  sort: string
  current: string
  tag?: string
  children: React.ReactNode
}) {
  const params = new URLSearchParams({ sort })
  if (tag) params.set('tag', tag)
  const isActive = current === sort

  return (
    <Link
      href={`/?${params}`}
      className={`px-3 py-1 rounded-full transition-colors ${
        isActive
          ? 'bg-indigo-600 text-white'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
      }`}
    >
      {children}
    </Link>
  )
}
