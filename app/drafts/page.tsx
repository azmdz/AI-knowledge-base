'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EditIcon from '@mui/icons-material/Edit'
import DraftsIcon from '@mui/icons-material/Drafts'
import InboxIcon from '@mui/icons-material/Inbox'
import { useCurrentUser } from '@/lib/user-context'

type Draft = {
  id: string
  title: string
  bodyRaw: string
  updatedAt: string
  author: { name: string }
}

export default function DraftsPage() {
  const { currentUser } = useCurrentUser()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  // currentUser が変わった直後は別ユーザーのデータになるのでローディング扱いにする
  const loading = !currentUser || fetchedFor !== currentUser.id

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    fetch('/api/drafts', { headers: { 'X-User-Id': currentUser.id } })
      .then((r) => r.json())
      .then((data: Draft[]) => {
        if (!cancelled) {
          setDrafts(data)
          setFetchedFor(currentUser.id)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDrafts([])
          setFetchedFor(currentUser.id)
        }
      })
    return () => {
      cancelled = true
    }
  }, [currentUser])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <DraftsIcon style={{ fontSize: 24 }} className="text-gray-400" />
        <h1 className="text-2xl font-bold text-gray-900">下書き一覧</h1>
        {!loading && <span className="text-sm text-gray-400">{drafts.length} 件</span>}
      </div>

      {loading || !currentUser ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <InboxIcon style={{ fontSize: 48, display: 'block', margin: '0 auto 12px' }} />
          <p>下書きはありません。</p>
          <Link
            href="/new"
            className="mt-4 inline-flex items-center gap-1 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 transition-colors"
          >
            記事を書く
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4 hover:border-indigo-200 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{draft.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {draft.author.name} · 最終更新:{' '}
                  {new Date(draft.updatedAt).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
                  {draft.bodyRaw.slice(0, 100)}
                  {draft.bodyRaw.length > 100 && '…'}
                </p>
              </div>
              <Link
                href={`/articles/${draft.id}/edit`}
                className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <EditIcon style={{ fontSize: 14 }} />
                編集
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
