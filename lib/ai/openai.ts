import OpenAI from 'openai'
import type { AIProvider, ArticleContext, FormatResult, SearchResult } from './provider'
import { tfidfEmbed } from './tfidf'
import { PROMPTS } from './prompts'
import { parseAnswerResponse } from './parse-answer'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export class OpenAIProvider implements AIProvider {
  async format(raw: string): Promise<FormatResult> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.format.system },
        { role: 'user', content: PROMPTS.format.user(raw) },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    const mdMatch = text.match(/```markdown\n([\s\S]*?)```/)

    const body = mdMatch ? mdMatch[1].trim() : raw
    const titleMatch = body.match(/^#\s+(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : '無題'

    return { title, body }
  }

  async suggestTags(body: string): Promise<string[]> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.tags.system },
        { role: 'user', content: PROMPTS.tags.user(body) },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    const yamlMatch = text.match(/```yaml\n([\s\S]*?)```/)
    if (!yamlMatch) return []
    const tagLines = yamlMatch[1].match(/- (.+)/g)
    if (!tagLines) return []
    return tagLines.map((l) => l.replace(/^- /, '').trim())
  }

  async edit(body: string, instruction: string): Promise<string> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.edit.system },
        { role: 'user', content: PROMPTS.edit.user(body, instruction) },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? body
  }

  async embed(text: string): Promise<number[]> {
    return tfidfEmbed(text)
  }

  async answer(query: string, context: ArticleContext[]): Promise<SearchResult> {
    if (context.length === 0) {
      return {
        answer: '関連する記事が見つかりませんでした。別のキーワードで検索してみてください。',
        citedIds: [],
      }
    }

    const contextText = context
      .map(
        (a, i) =>
          `[記事${i + 1}] ID:${a.id}\nタイトル: ${a.title}\n${a.bodyFormatted ?? a.bodyRaw}`,
      )
      .join('\n\n---\n\n')

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PROMPTS.answer.system },
        { role: 'user', content: PROMPTS.answer.user(contextText, query) },
      ],
    })

    const text = response.choices[0]?.message?.content ?? ''
    return parseAnswerResponse(text, context)
  }
}
