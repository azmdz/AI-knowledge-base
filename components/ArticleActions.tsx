'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useCurrentUser } from '@/lib/user-context'
import { toast } from 'sonner'

interface Props {
  articleId: string
  authorId: string
}

export function ArticleActions({ articleId, authorId }: Props) {
  const { currentUser } = useCurrentUser()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  if (!currentUser || currentUser.id !== authorId) return null

  async function handleDelete() {
    if (!confirm('この記事を削除しますか？この操作は元に戻せません。')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': currentUser!.id },
      })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('記事を削除しました')
      router.push('/')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '削除に失敗しました')
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-red-200 rounded-full text-red-500 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
      >
        <DeleteIcon style={{ fontSize: 14 }} />
        {isDeleting ? '削除中...' : '削除'}
      </button>
      <Link
        href={`/articles/${articleId}/edit`}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
      >
        <EditIcon style={{ fontSize: 14 }} />
        編集
      </Link>
    </div>
  )
}
