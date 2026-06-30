import type { AIProvider } from './provider'

// Next.js はリクエスト間でモジュールを使い回すため、_provider はプロセス存続中シングルトンになる。
let _provider: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (_provider) return _provider

  const providerName = process.env.AI_PROVIDER ?? 'mock'

  // top-level import ではなく require() で遅延ロードする。
  // 使われないプロバイダーの SDK（anthropic / openai）が起動時に読み込まれるのを防ぐ。
  if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OpenAIProvider } = require('./openai')
    _provider = new OpenAIProvider()
  } else if (providerName === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RealProvider } = require('./real')
    _provider = new RealProvider()
  } else {
    // API キーが未設定の場合はモックにフォールバックしてクラッシュを防ぐ。
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MockProvider } = require('./mock')
    _provider = new MockProvider()
  }

  return _provider!
}
