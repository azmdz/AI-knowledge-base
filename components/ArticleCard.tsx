import Link from 'next/link'
import VisibilityIcon from '@mui/icons-material/Visibility'

type ArticleCardProps = {
  article: {
    id: string
    title: string
    viewCount: number
    createdAt: Date
    author: { name: string }
    tags: { tag: { name: string }; source: string }[]
  }
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <article className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
      {/* カード全体を記事詳細へのリンクにするオーバーレイ */}
      <Link
        href={`/articles/${article.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={article.title}
      />

      <h2 className="relative text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 pointer-events-none">
        {article.title}
      </h2>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {article.tags.map(({ tag }) => (
          <Link
            key={tag.name}
            href={`/?tag=${encodeURIComponent(tag.name)}`}
            className="text-xs px-2 py-0.5 rounded-full transition-colors bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {tag.name}
          </Link>
        ))}
      </div>

      <div className="relative mt-3 flex items-center gap-3 text-xs text-gray-400 pointer-events-none">
        <span>{article.author.name}</span>
        <span>·</span>
        <span>{new Date(article.createdAt).toLocaleDateString('ja-JP')}</span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <VisibilityIcon style={{ fontSize: 12 }} /> {article.viewCount}
        </span>
      </div>
    </article>
  )
}
