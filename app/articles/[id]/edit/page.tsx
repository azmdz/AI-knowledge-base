import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ArticleEditForm } from '@/components/ArticleEditForm'

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const article = await prisma.article.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  })

  if (!article) notFound()

  return (
    <ArticleEditForm
      id={article.id}
      authorId={article.authorId}
      initialTitle={article.title}
      initialBodyRaw={article.bodyRaw}
      initialBodyFormatted={article.bodyFormatted}
      initialStatus={article.status as 'published' | 'draft'}
      initialTags={article.tags.map(({ tag, source }) => ({
        name: tag.name,
        source,
      }))}
    />
  )
}
