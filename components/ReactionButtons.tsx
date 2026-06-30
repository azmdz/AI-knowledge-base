'use client'

import { useState, useEffect } from 'react'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import { useCurrentUser } from '@/lib/user-context'

interface Props {
  articleId: string
}

export function ReactionButtons({ articleId }: Props) {
  const { currentUser } = useCurrentUser()
  const [counts, setCounts] = useState({ like: 0, helpful: 0 })
  const [userReacted, setUserReacted] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) return
    fetch(`/api/articles/${articleId}/reactions?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCounts(data.counts)
        setUserReacted(data.userReacted ?? [])
      })
      .catch(() => {})
  }, [articleId, currentUser])

  async function toggle(type: 'like' | 'helpful') {
    if (!currentUser) return
    setLoading(type)
    try {
      const res = await fetch(`/api/articles/${articleId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, type }),
      })
      if (!res.ok) return
      const data = await res.json()
      setCounts(data.counts)
      setUserReacted(data.userReacted)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-6 p-4 bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">リアクション：</span>
        <button
          onClick={() => toggle('like')}
          disabled={loading !== null || !currentUser}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            userReacted.includes('like')
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
          } disabled:opacity-50`}
        >
          <ThumbUpIcon style={{ fontSize: 16 }} />
          いいね {counts.like > 0 && counts.like}
        </button>
        <button
          onClick={() => toggle('helpful')}
          disabled={loading !== null || !currentUser}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
            userReacted.includes('helpful')
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600'
          } disabled:opacity-50`}
        >
          <LightbulbIcon style={{ fontSize: 16 }} />
          役に立った {counts.helpful > 0 && counts.helpful}
        </button>
      </div>
    </div>
  )
}
