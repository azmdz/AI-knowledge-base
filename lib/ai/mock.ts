import type { AIProvider, ArticleContext, FormatResult, SearchResult } from './provider'
import { tfidfEmbed } from './tfidf'

export class MockProvider implements AIProvider {
  async format(raw: string): Promise<FormatResult> {
    const lines = raw.trim().split('\n').filter(Boolean)
    const title = lines[0]?.replace(/^[#\-*\s]+/, '').trim() ?? '無題'
    const body = `# ${title}\n\n${raw.trim()}`
    return { title, body }
  }

  async suggestTags(body: string): Promise<string[]> {
    return extractKeywords(body)
  }

  async edit(body: string, instruction: string): Promise<string> {
    if (/箇条書き|リスト/.test(instruction)) {
      return body.replace(/。\s*/g, '\n- ').replace(/^/, '- ')
    }
    if (/見出し|タイトル/.test(instruction)) {
      const lines = body.split('\n')
      return `## ${lines[0]}\n\n${lines.slice(1).join('\n')}`
    }
    return `${body}\n\n> **モック編集**: 「${instruction}」の指示を受け付けました。実際のAIプロバイダーを設定すると本格的な編集が可能です。`
  }

  async embed(text: string): Promise<number[]> {
    return tfidfEmbed(text)
  }

  async answer(query: string, context: ArticleContext[]): Promise<SearchResult> {
    if (context.length === 0) {
      return { answer: '関連する記事が見つかりませんでした。', citedIds: [] }
    }
    const top = context.slice(0, 3)
    const titles = top.map((a) => `「${a.title}」`).join('、')
    const answer = `（モック回答）「${query}」に関連する記事として ${titles} などが見つかりました。詳細は各記事を参照してください。`
    return { answer, citedIds: top.map((a) => a.id) }
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'の',
    'に',
    'は',
    'を',
    'が',
    'で',
    'と',
    'た',
    'し',
    'て',
    'も',
    'な',
    'い',
    'こと',
    'する',
  ])
  const words = text
    .replace(/[#\-*`>]/g, ' ')
    .split(/[\s、。！？\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !stopWords.has(w))

  const freq = new Map<string, number>()
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w)
}
