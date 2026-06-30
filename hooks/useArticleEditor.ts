'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export type FormatResult = {
  title: string
  body: string
}

export type ArticleTag = {
  name: string
  source: 'user' | 'ai_suggested'
}

export type ExistingTag = {
  name: string
  count: number
}

export type TagSuggestion = {
  name: string
  count?: number
  source: 'user' | 'ai_suggested'
}

type InitialTag = {
  name: string
  source: string
}

interface Options {
  id?: string
  initialTags?: InitialTag[]
}

export function useArticleEditor({ id, initialTags = [] }: Options = {}) {
  // --- tag state ---
  const [tagInput, setTagInput] = useState('')
  const [userTags, setUserTags] = useState<string[]>(
    initialTags.filter((t) => t.source === 'user').map((t) => t.name),
  )
  const [aiKeptTags, setAiKeptTags] = useState<string[]>(
    initialTags.filter((t) => t.source === 'ai_suggested').map((t) => t.name),
  )
  const [aiTagsAccepted, setAiTagsAccepted] = useState<Set<string>>(new Set())
  const [existingTags, setExistingTags] = useState<ExistingTag[]>([])
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false)

  // --- format state ---
  const [formatResult, setFormatResult] = useState<FormatResult | null>(null)
  const [showFormatPanel, setShowFormatPanel] = useState(false)
  const [useFormatted, setUseFormatted] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)

  // --- tag suggestion state ---
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [isSuggestingTags, setIsSuggestingTags] = useState(false)

  // --- edit diff state ---
  const [instruction, setInstruction] = useState('')
  const [diffResult, setDiffResult] = useState<{ old: string; new: string } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // --- shared error ---
  const [error, setError] = useState<string | null>(null)

  // --- computed tags ---
  const newAiTags = suggestedTags
    .filter((t) => !userTags.includes(t) && !aiKeptTags.includes(t) && aiTagsAccepted.has(t))
    .map((t) => ({ name: t, source: 'ai_suggested' as const }))

  const allTags: ArticleTag[] = [
    ...userTags.map((t) => ({ name: t, source: 'user' as const })),
    ...aiKeptTags.map((t) => ({ name: t, source: 'ai_suggested' as const })),
    ...newAiTags,
  ]

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase()
    if (!tagSuggestionsOpen) return []

    const aiAccepted = suggestedTags.filter((t) => aiTagsAccepted.has(t))
    const selected = new Set(
      [...userTags, ...aiKeptTags, ...aiAccepted].map((t) => t.toLowerCase()),
    )
    const existingByName = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]))
    const suggestions: TagSuggestion[] = []
    const seen = new Set<string>()

    for (const name of suggestedTags) {
      const key = name.toLowerCase()
      if (selected.has(key) || seen.has(key)) continue
      if (query && !key.includes(query)) continue
      suggestions.push({
        name,
        count: existingByName.get(key)?.count,
        source: 'ai_suggested',
      })
      seen.add(key)
    }

    for (const tag of existingTags) {
      const key = tag.name.toLowerCase()
      if (selected.has(key) || seen.has(key)) continue
      if (query && !key.includes(query)) continue
      suggestions.push({ ...tag, source: 'user' })
      seen.add(key)
    }

    return suggestions.slice(0, 8)
  }, [
    userTags,
    aiKeptTags,
    aiTagsAccepted,
    existingTags,
    suggestedTags,
    tagInput,
    tagSuggestionsOpen,
  ])

  useEffect(() => {
    let cancelled = false

    fetch('/api/tags')
      .then((res) => (res.ok ? res.json() : []))
      .then((tags: ExistingTag[]) => {
        if (!cancelled) setExistingTags(tags)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // --- AI format ---
  async function handleFormat(rawText: string): Promise<string | null> {
    if (!rawText.trim()) return null
    setIsFormatting(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawText }),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        throw new Error(
          retryAfter
            ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`
            : 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        )
      }
      if (!res.ok) throw new Error('整形に失敗しました')
      const result: FormatResult = await res.json()
      setFormatResult(result)
      setUseFormatted(false)
      setShowFormatPanel(true)
      toast.success('AI整形が完了しました')
      return result.title
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'エラーが発生しました'
      setError(msg)
      toast.error(msg)
      return null
    } finally {
      setIsFormatting(false)
    }
  }

  // --- AI tag suggestion ---
  async function handleSuggestTags(body: string): Promise<void> {
    if (!body.trim()) return
    setIsSuggestingTags(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        throw new Error(
          retryAfter
            ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`
            : 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        )
      }
      if (!res.ok) throw new Error('タグ提案に失敗しました')
      const { tags } = await res.json()
      setSuggestedTags(tags as string[])
      setAiTagsAccepted(new Set())
      toast.success('タグ候補を提案しました')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'エラーが発生しました'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSuggestingTags(false)
    }
  }

  // --- AI edit ---
  async function handleAIEdit(rawText: string): Promise<void> {
    if (!rawText.trim() || !instruction.trim()) return
    setIsEditing(true)
    setError(null)
    setDiffResult(null)
    try {
      const res = await fetch('/api/ai/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: rawText, instruction }),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After')
        throw new Error(
          retryAfter
            ? `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`
            : 'リクエストが多すぎます。しばらく待ってから再試行してください。',
        )
      }
      if (!res.ok) throw new Error('AI編集に失敗しました')
      const { body: edited } = await res.json()
      setDiffResult({ old: rawText, new: edited })
      toast.success('AI編集の差分を表示しました')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'エラーが発生しました'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsEditing(false)
    }
  }

  function logEditResult(accepted: boolean): void {
    fetch('/api/ai/edit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instruction, accepted, ...(id ? { articleId: id } : {}) }),
    }).catch(() => {})
  }

  // rawText はフォームコンポーネントが所有しているため、フック内から直接更新できない。
  // 採用テキストを返して呼び出し側に setRawText させる設計にしている。
  function acceptDiff(): string | null {
    if (!diffResult) return null
    const newText = diffResult.new
    logEditResult(true)
    setDiffResult(null)
    setInstruction('')
    return newText
  }

  function rejectDiff(): void {
    logEditResult(false)
    setDiffResult(null)
  }

  // --- tag actions ---
  function addTag(tagName?: string, source: 'user' | 'ai_suggested' = 'user'): void {
    const name = (tagName ?? tagInput).trim()
    if (
      name &&
      source === 'ai_suggested' &&
      !userTags.includes(name) &&
      !aiKeptTags.includes(name)
    ) {
      setAiTagsAccepted((prev) => new Set(prev).add(name))
    } else if (name && !userTags.includes(name) && !aiKeptTags.includes(name)) {
      setUserTags((prev) => [...prev, name])
    }
    setTagInput('')
    setTagSuggestionsOpen(false)
  }

  function removeUserTag(name: string): void {
    setUserTags((prev) => prev.filter((t) => t !== name))
  }

  function removeAiKeptTag(name: string): void {
    setAiKeptTags((prev) => prev.filter((t) => t !== name))
  }

  function toggleAiTag(name: string): void {
    setAiTagsAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
    setTagInput('')
    setTagSuggestionsOpen(false)
  }

  return {
    // tag
    tagInput,
    setTagInput,
    userTags,
    setUserTags,
    aiKeptTags,
    setAiKeptTags,
    aiTagsAccepted,
    allTags,
    tagSuggestions,
    setTagSuggestionsOpen,
    // format
    formatResult,
    showFormatPanel,
    useFormatted,
    setUseFormatted,
    isFormatting,
    // tag suggestion
    suggestedTags,
    isSuggestingTags,
    // edit
    instruction,
    setInstruction,
    diffResult,
    isEditing,
    // error
    error,
    setError,
    // actions
    handleFormat,
    handleSuggestTags,
    handleAIEdit,
    acceptDiff,
    rejectDiff,
    addTag,
    removeUserTag,
    removeAiKeptTag,
    toggleAiTag,
  }
}
