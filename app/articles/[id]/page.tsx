export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import VisibilityIcon from '@mui/icons-material/Visibility'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { prisma } from '@/lib/prisma'
import { ReactionButtons } from '@/components/ReactionButtons'
import { ArticleActions } from '@/components/ArticleActions'

export default async function ArticleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
  })

  if (!article) notFound()

  let viewCount = article.viewCount
  if (article.status === 'published') {
    const updated = await prisma.article.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })
    viewCount = updated.viewCount
  }

  const displayBody = article.bodyFormatted ?? article.bodyRaw
  const hasFormatted = Boolean(article.bodyFormatted)
  const isDraft = article.status === 'draft'

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
        >
          <ArrowBackIcon style={{ fontSize: 14 }} />
          一覧に戻る
        </Link>
        <ArticleActions articleId={id} authorId={article.author.id} />
      </div>

      {isDraft && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="font-medium">下書き</span>
          <span className="text-amber-500">— この記事は公開されていません</span>
        </div>
      )}

      <article className="bg-white border border-gray-200 rounded-2xl p-8">
        <header className="mb-6 pb-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{article.title}</h1>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {article.tags.map(({ tag }) => (
              <Link
                key={tag.name}
                href={`/?tag=${encodeURIComponent(tag.name)}`}
                className="text-xs px-2.5 py-1 rounded-full transition-colors bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {tag.name}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
            <span>{article.author.name}</span>
            <span>·</span>
            <span>{new Date(article.createdAt).toLocaleDateString('ja-JP')}</span>
            <span>·</span>
            <span>最終更新: {new Date(article.updatedAt).toLocaleDateString('ja-JP')}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <VisibilityIcon style={{ fontSize: 14 }} /> {viewCount}
            </span>
          </div>

          {hasFormatted && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg w-fit">
              <AutoAwesomeIcon style={{ fontSize: 14 }} />
              <span>AIが整形した版を表示中</span>
            </div>
          )}
        </header>

        <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-code:bg-transparent prose-code:text-gray-900 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:text-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayBody}</ReactMarkdown>
        </div>
      </article>

      <ReactionButtons articleId={id} />

      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
        <p className="text-indigo-800">
          この記事について質問がありますか？{' '}
          <Link href="/search" className="font-medium underline hover:text-indigo-600">
            AI Q&A で聞いてみる →
          </Link>
        </p>
      </div>
    </div>
  )
}
