import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, ArticleContext, FormatResult, SearchResult } from './provider'
import { tfidfEmbed } from './tfidf'
import { PROMPTS } from './prompts'
import { parseAnswerResponse } from './parse-answer'

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8'

function textFromMessage(response: { content?: Array<{ type: string; text?: string }> }): string {
  return (response.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n')
    .trim()
}

export class RealProvider implements AIProvider {
  private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  async format(raw: string): Promise<FormatResult> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: PROMPTS.format.system,
      messages: [{ role: 'user', content: PROMPTS.format.user(raw) }],
    })

    const text = textFromMessage(response)
    const mdMatch = text.match(/```markdown\n([\s\S]*?)```/)

    const body = mdMatch ? mdMatch[1].trim() : raw
    const titleMatch = body.match(/^#\s+(.+)/m)
    const title = titleMatch ? titleMatch[1].trim() : '無題'

    return { title, body }
  }

  async suggestTags(body: string): Promise<string[]> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: PROMPTS.tags.system,
      messages: [{ role: 'user', content: PROMPTS.tags.user(body) }],
    })

    const text = textFromMessage(response)
    const yamlMatch = text.match(/```yaml\n([\s\S]*?)```/)
    if (!yamlMatch) return []
    const tagLines = yamlMatch[1].match(/- (.+)/g)
    if (!tagLines) return []
    return tagLines.map((line) => line.replace(/^- /, '').trim())
  }

  async edit(body: string, instruction: string): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: PROMPTS.edit.system,
      messages: [{ role: 'user', content: PROMPTS.edit.user(body, instruction) }],
    })

    return textFromMessage(response) || body
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
        (article, index) =>
          `[記事${index + 1}] ID:${article.id}\nタイトル: ${article.title}\n${
            article.bodyFormatted ?? article.bodyRaw
          }`,
      )
      .join('\n\n---\n\n')

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: PROMPTS.answer.system,
      messages: [{ role: 'user', content: PROMPTS.answer.user(contextText, query) }],
    })

    const text = textFromMessage(response)
    return parseAnswerResponse(text, context)
  }
}
