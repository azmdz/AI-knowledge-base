export interface FormatResult {
  title: string
  body: string
}

export interface SearchResult {
  answer: string
  citedIds: string[]
}

export interface ArticleContext {
  id: string
  title: string
  bodyRaw: string
  bodyFormatted: string | null
}

export interface AIProvider {
  format(raw: string): Promise<FormatResult>
  suggestTags(body: string): Promise<string[]>
  edit(body: string, instruction: string): Promise<string>
  embed(text: string): Promise<number[]>
  answer(query: string, context: ArticleContext[]): Promise<SearchResult>
}
