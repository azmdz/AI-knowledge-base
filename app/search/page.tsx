'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import SearchIcon from '@mui/icons-material/Search'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArticleIcon from '@mui/icons-material/Article'

type SearchMode = 'ai' | 'regular'

type CitedArticle = {
  id: string
  title: string
  tags: string[]
}

type AIResult = {
  mode: 'ai'
  logId: string
  answer: string
  citedArticles: CitedArticle[]
}

type RegularArticle = {
  id: string
  title: string
  excerpt: string
  tags: string[]
  author: string
  createdAt: string
}

type RegularResult = {
  mode: 'regular'
  articles: RegularArticle[]
}

type SearchResult = AIResult | RegularResult

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('ai')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [searchProgress, setSearchProgress] = useState(0)

  useEffect(() => {
    if (!isSearching) return

    const interval = window.setInterval(
      () => {
        setSearchProgress((current) => {
          if (current >= 92) return current
          const step = mode === 'ai' ? 7 : 14
          return Math.min(92, current + step)
        })
      },
      mode === 'ai' ? 550 : 280,
    )

    return () => window.clearInterval(interval)
  }, [isSearching, mode])

  function switchMode(next: SearchMode) {
    setMode(next)
    setResult(null)
    setError(null)
    setFeedback(null)
    setSearchedQuery('')
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setIsSearching(true)
    setSearchProgress(8)
    setError(null)
    setResult(null)
    setFeedback(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode }),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        throw new Error(
          retryAfter
            ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`
            : 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        )
      }
      if (!res.ok) throw new Error('検索に失敗しました')
      const data: SearchResult = await res.json()
      setResult(data)
      setSearchedQuery(query.trim())
      setSearchProgress(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
      setSearchProgress(0)
    } finally {
      setIsSearching(false)
    }
  }

  async function sendFeedback(wasHelpful: boolean) {
    if (!result || result.mode !== 'ai') return
    setFeedback(wasHelpful ? 'helpful' : 'not_helpful')
    await fetch(`/api/search/${result.logId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wasHelpful }),
    }).catch(() => {})
  }

  const AI_EXAMPLE_QUERIES = [
    'VPNに接続できない場合どうすればいいですか？',
    '経費精算の締め切りはいつですか？',
    'GitのPRレビューで何名のApprovalが必要ですか？',
    '本番環境へのデプロイ手順を教えてください',
  ]

  const REGULAR_EXAMPLE_QUERIES = ['VPN', '経費精算', 'デプロイ', 'セキュリティ']

  const exampleQueries = mode === 'ai' ? AI_EXAMPLE_QUERIES : REGULAR_EXAMPLE_QUERIES

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">検索</h1>
        <p className="text-sm text-gray-500 mt-1">社内ナレッジベースを検索します。</p>
      </div>

      {/* モード切り替えトグル */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-6">
        <button
          onClick={() => switchMode('ai')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'ai'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <SmartToyIcon style={{ fontSize: 16 }} />
          AI検索
        </button>
        <button
          onClick={() => switchMode('regular')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'regular'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <SearchIcon style={{ fontSize: 16 }} />
          通常検索
        </button>
      </div>

      {/* モード説明 */}
      <p className="text-xs text-gray-400 mb-4">
        {mode === 'ai'
          ? '自然言語で質問できます。AIが関連記事を参照して回答を生成します。'
          : 'キーワードでタイトル・本文を全文検索します。'}
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === 'ai' ? '質問を入力...' : 'キーワードを入力...'}
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSearching ? (
            <span className="flex items-center gap-2">
              <AutorenewIcon className="animate-spin" style={{ fontSize: 16 }} /> 検索中
            </span>
          ) : (
            '検索'
          )}
        </button>
      </form>

      {!result && !isSearching && !error && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">
            {mode === 'ai'
              ? '例えばこんな質問ができます：'
              : '例えばこんなキーワードで検索できます：'}
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="text-sm px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {isSearching && (
        <div className="py-12">
          <div className="mx-auto max-w-md rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                {mode === 'ai' ? (
                  <SmartToyIcon style={{ fontSize: 24 }} />
                ) : (
                  <SearchIcon style={{ fontSize: 24 }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {mode === 'ai' ? progressLabel(searchProgress) : 'ナレッジベースを検索しています'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {mode === 'ai'
                    ? '関連記事の抽出から回答生成まで順番に処理しています。'
                    : '一致する記事を抽出しています。'}
                </p>
              </div>
              <AutorenewIcon className="animate-spin text-indigo-500" style={{ fontSize: 20 }} />
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${searchProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>{mode === 'ai' ? progressStep(searchProgress) : '検索中'}</span>
              <span>{searchProgress}%</span>
            </div>
          </div>
        </div>
      )}

      {/* AI検索結果 */}
      {result?.mode === 'ai' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <SmartToyIcon style={{ fontSize: 28, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  AI の回答
                </p>
                <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-indigo-600 prose-code:bg-transparent prose-code:text-gray-900 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-900 prose-pre:text-gray-100 [&_pre_code]:bg-transparent [&_pre_code]:text-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answer}</ReactMarkdown>
                </div>
              </div>
            </div>

            {result.citedArticles.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  参照した記事
                </p>
                <ul className="space-y-2">
                  {result.citedArticles.map((article) => (
                    <li key={article.id} className="flex items-start gap-2">
                      <ArrowForwardIcon
                        style={{ fontSize: 14, color: '#d1d5db', marginTop: 2, flexShrink: 0 }}
                      />
                      <div>
                        <Link
                          href={`/articles/${article.id}`}
                          className="text-sm font-medium text-indigo-600 hover:underline"
                        >
                          <Highlight text={article.title} query={searchedQuery} />
                        </Link>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {article.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>この回答は役に立ちましたか？</span>
            {feedback ? (
              <span className="text-indigo-600 font-medium flex items-center gap-1">
                {feedback === 'helpful' ? (
                  <>
                    <ThumbUpIcon style={{ fontSize: 14 }} /> フィードバックありがとうございます！
                  </>
                ) : (
                  <>
                    <ThumbDownIcon style={{ fontSize: 14 }} /> フィードバックありがとうございます！
                  </>
                )}
              </span>
            ) : (
              <>
                <button
                  onClick={() => sendFeedback(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full hover:border-green-300 hover:text-green-600 transition-colors"
                >
                  <ThumbUpIcon style={{ fontSize: 14 }} /> 役に立った
                </button>
                <button
                  onClick={() => sendFeedback(false)}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  <ThumbDownIcon style={{ fontSize: 14 }} /> 役に立たなかった
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 通常検索結果 */}
      {result?.mode === 'regular' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {result.articles.length > 0
              ? `${result.articles.length} 件見つかりました`
              : '一致する記事が見つかりませんでした。'}
          </p>
          {result.articles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <SearchIcon style={{ fontSize: 40, display: 'block', margin: '0 auto 8px' }} />
              <p className="text-sm">別のキーワードで試してみてください。</p>
            </div>
          ) : (
            result.articles.map((article) => (
              <div
                key={article.id}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <Link href={`/articles/${article.id}`} className="group flex items-start gap-3">
                  <ArticleIcon
                    style={{ fontSize: 20, color: '#6366f1', marginTop: 2, flexShrink: 0 }}
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      <Highlight text={article.title} query={searchedQuery} />
                    </h2>
                    {article.excerpt && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        <Highlight text={article.excerpt} query={searchedQuery} />
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {article.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {article.author} · {new Date(article.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function progressLabel(progress: number): string {
  if (progress < 30) return 'ナレッジベースを検索しています'
  if (progress < 60) return '関連する記事を読み込んでいます'
  if (progress < 88) return '回答を生成しています'
  return '回答を整えています'
}

function progressStep(progress: number): string {
  if (progress < 30) return '検索'
  if (progress < 60) return '記事抽出'
  if (progress < 88) return '回答生成'
  return '仕上げ'
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
