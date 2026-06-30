'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SendIcon from '@mui/icons-material/Send'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DraftsIcon from '@mui/icons-material/Drafts'
import { DiffViewer } from '@/components/DiffViewer'
import { useArticleEditor } from '@/hooks/useArticleEditor'
import { useCurrentUser } from '@/lib/user-context'

const MarkdownEditor = dynamic(
  () => import('@/components/MarkdownEditor').then((m) => m.MarkdownEditor),
  {
    ssr: false,
    loading: () => <div className="border border-gray-200 rounded-xl bg-white h-[360px]" />,
  },
)

type InitialTag = {
  name: string
  source: string
}

interface Props {
  id: string
  authorId: string
  initialTitle: string
  initialBodyRaw: string
  initialBodyFormatted: string | null
  initialTags: InitialTag[]
  initialStatus: 'published' | 'draft'
}

export function ArticleEditForm({
  id,
  authorId,
  initialTitle,
  initialBodyRaw,
  initialBodyFormatted,
  initialTags,
  initialStatus,
}: Props) {
  const router = useRouter()
  const { currentUser } = useCurrentUser()

  const [rawText, setRawText] = useState(initialBodyRaw)
  const [title, setTitle] = useState(initialTitle)
  const [isSaving, setIsSaving] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const {
    tagInput,
    setTagInput,
    userTags,
    aiKeptTags,
    aiTagsAccepted,
    allTags,
    tagSuggestions,
    setTagSuggestionsOpen,
    formatResult,
    showFormatPanel,
    useFormatted,
    setUseFormatted,
    isFormatting,
    suggestedTags,
    isSuggestingTags,
    instruction,
    setInstruction,
    diffResult,
    isEditing,
    error,
    setError,
    handleFormat,
    handleSuggestTags,
    handleAIEdit,
    acceptDiff,
    rejectDiff,
    addTag,
    removeUserTag,
    removeAiKeptTag,
    toggleAiTag,
  } = useArticleEditor({ id, initialTags })

  async function onFormat() {
    const suggestedTitle = await handleFormat(rawText)
    if (suggestedTitle && title === initialTitle) setTitle(suggestedTitle)
  }

  function onAcceptDiff() {
    const newText = acceptDiff()
    if (newText !== null) {
      setRawText(newText)
      setEditorKey((k) => k + 1)
    }
  }

  function onAcceptFormat() {
    if (!formatResult) return
    // rawText（bodyRaw）は上書きしない。bodyFormatted として保存するフラグだけ立てる
    setUseFormatted((prev) => !prev)
  }

  if (currentUser !== null && currentUser.id !== authorId) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">この記事を編集する権限がありません。</p>
        <button
          onClick={() => router.push(`/articles/${id}`)}
          className="text-sm text-indigo-600 hover:underline"
        >
          記事に戻る
        </button>
      </div>
    )
  }

  async function handleSave(status?: 'published' | 'draft') {
    if (!currentUser) {
      setError('ユーザーが選択されていません')
      return
    }
    if (!title.trim() || !rawText.trim()) {
      setError('タイトルと本文は必須です')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const tagSources: Record<string, 'user' | 'ai_suggested'> = {}
      allTags.forEach(({ name, source }) => {
        tagSources[name] = source
      })

      const bodyFormatted =
        useFormatted && formatResult
          ? formatResult.body
          : rawText === initialBodyRaw
            ? (initialBodyFormatted ?? null)
            : null

      const res = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser.id },
        body: JSON.stringify({
          title: title.trim(),
          bodyRaw: rawText,
          bodyFormatted,
          ...(status ? { status } : {}),
          tags: allTags.map((t) => t.name),
          tagSources,
        }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      toast.success('記事を更新しました')
      router.push(`/articles/${id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'エラーが発生しました'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push(`/articles/${id}`)}
          className="text-sm text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
        >
          <ArrowBackIcon style={{ fontSize: 14 }} />
          記事に戻る
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">記事を編集</h1>

      <div className="space-y-4">
        {/* タイトル */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="記事のタイトル"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          />
        </div>

        {/* ドキュメント + 差分（横並び） */}
        <div className={`grid gap-4 ${diffResult ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-1">ドキュメント</label>
            <div className="flex-1">
              <MarkdownEditor
                key={editorKey}
                value={rawText}
                onChange={setRawText}
                placeholder="本文を入力..."
                minHeight={360}
              />
            </div>
          </div>

          {diffResult && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-indigo-700 flex items-center gap-1">
                  <SmartToyIcon style={{ fontSize: 15 }} />
                  AI編集の差分
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={rejectDiff}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    <CancelIcon style={{ fontSize: 13 }} />
                    却下
                  </button>
                  <button
                    onClick={onAcceptDiff}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <CheckCircleIcon style={{ fontSize: 13 }} />
                    採用する
                  </button>
                </div>
              </div>
              <div className="flex-1 border border-indigo-200 rounded-xl overflow-hidden">
                <DiffViewer oldText={diffResult.old} newText={diffResult.new} />
              </div>
            </div>
          )}
        </div>

        {/* AI支援 */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
            <SmartToyIcon style={{ fontSize: 16 }} />
            AI支援
          </p>
          {showFormatPanel && formatResult && (
            <div
              className={`border rounded-xl p-3 space-y-2 ${useFormatted ? 'bg-purple-100 border-purple-400' : 'bg-purple-50 border-purple-200'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-purple-700 flex items-center gap-1">
                  <AutoAwesomeIcon style={{ fontSize: 12 }} />
                  AI整形版の本文
                  {useFormatted && (
                    <span className="ml-1 text-purple-600 font-semibold">
                      （採用中 — 保存時に使用）
                    </span>
                  )}
                </p>
                <button
                  onClick={onAcceptFormat}
                  className={`flex items-center gap-1 text-xs px-3 py-1 rounded-full transition-colors ${useFormatted ? 'bg-white text-purple-700 border border-purple-400 hover:bg-purple-50' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                >
                  <CheckIcon style={{ fontSize: 12 }} />
                  {useFormatted ? '採用を取り消す' : 'AI整形版を採用する'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto bg-white rounded-lg p-2.5 text-xs text-gray-600 whitespace-pre-wrap border border-purple-100 leading-relaxed">
                {formatResult.body}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAIEdit(rawText)
                }
              }}
              placeholder="例: 箇条書きに整理して / 見出しを追加して / もっと簡潔にして（Cmd+Enter で送信）"
              rows={2}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onFormat}
                disabled={isFormatting || !rawText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isFormatting ? (
                  <>
                    <AutorenewIcon className="animate-spin" style={{ fontSize: 14 }} /> 整形中...
                  </>
                ) : (
                  <>
                    <AutoAwesomeIcon style={{ fontSize: 14 }} /> 記事の整形
                  </>
                )}
              </button>
              <button
                onClick={() => handleAIEdit(rawText)}
                disabled={isEditing || !rawText.trim() || !instruction.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isEditing ? (
                  <>
                    <AutorenewIcon className="animate-spin" style={{ fontSize: 14 }} /> 編集中...
                  </>
                ) : (
                  <>
                    <SendIcon style={{ fontSize: 14 }} /> 編集依頼
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* タグ */}
        <div>
          <div className="flex items-center mb-1">
            <label className="text-sm font-medium text-gray-700">タグ</label>
          </div>

          {suggestedTags.length > 0 && (
            <div className="mb-3 bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
              <p className="text-xs text-teal-600">タグをクリックして追加</p>
              <div className="flex flex-wrap gap-2">
                {suggestedTags.map((tag) => {
                  const accepted = aiTagsAccepted.has(tag)
                  const isExisting = userTags.includes(tag) || aiKeptTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => !isExisting && toggleAiTag(tag)}
                      disabled={isExisting}
                      className={`text-sm px-3 py-1 rounded-full border transition-all ${
                        isExisting
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                          : accepted
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-100'
                      }`}
                    >
                      {accepted && <CheckIcon style={{ fontSize: 12, marginRight: 2 }} />}
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onFocus={() => setTagSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setTagSuggestionsOpen(false), 100)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  addTag()
                }}
                placeholder="タグ名を入力してEnter"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm"
              />
              {tagSuggestions.length > 0 && (
                <div className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(tag.name, tag.source)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <span className="truncate">{tag.name}</span>
                      {tag.count !== undefined && (
                        <span className="ml-3 text-xs text-gray-400">{tag.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => addTag()}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              追加
            </button>
            <button
              onClick={() => handleSuggestTags(rawText)}
              disabled={isSuggestingTags || !rawText.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
            >
              {isSuggestingTags ? (
                <>
                  <AutorenewIcon className="animate-spin" style={{ fontSize: 14 }} /> 提案中...
                </>
              ) : (
                <>
                  <AutoAwesomeIcon style={{ fontSize: 14 }} /> AIタグ提案
                </>
              )}
            </button>
          </div>
          {allTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allTags.map(({ name, source }) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700"
                >
                  {name}
                  <button
                    onClick={() =>
                      source === 'user' ? removeUserTag(name) : removeAiKeptTag(name)
                    }
                    className="ml-0.5 text-indigo-400 hover:text-indigo-700 leading-none flex items-center"
                  >
                    <CloseIcon style={{ fontSize: 12 }} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => router.push(`/articles/${id}`)}
            className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={isSaving || !title.trim() || !rawText.trim()}
            className="flex items-center gap-1.5 px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <DraftsIcon style={{ fontSize: 16 }} />
            {isSaving ? '保存中...' : '下書き保存'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={isSaving || !title.trim() || !rawText.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '更新中...' : initialStatus === 'draft' ? '公開する' : '更新する'}
          </button>
        </div>
      </div>
    </div>
  )
}
