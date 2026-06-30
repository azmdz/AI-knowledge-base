// 256 次元に固定。シードデータの埋め込みと次元を合わせないとコサイン類似度が計算できない。
const DIM = 256

// Anthropic API には埋め込みエンドポイントがないため自前実装。
// 全プロバイダーで同じ関数を使うことでシードデータとの互換性を保つ。
export function tfidfEmbed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0)
  const normalized = text.toLowerCase()

  const asciiWords = normalized.match(/[a-z0-9][a-z0-9]*/g) ?? []

  // 日本語は単語境界がないため文字バイグラムで近似する。
  // U+3000–U+9FFF は ひらがな・カタカナ・漢字を包含する CJK ブロック。
  const cjkChars = normalized.replace(/[^぀-鿿]/g, '')
  const bigrams: string[] = []
  for (let i = 0; i < cjkChars.length - 1; i++) {
    bigrams.push(cjkChars.slice(i, i + 2))
  }

  const tokens = [...asciiWords, ...bigrams]
  if (tokens.length === 0) return vec

  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1)

  for (const [t, f] of freq) {
    let h = 0
    // djb2 系のローリングハッシュ。`>>> 0` で uint32 に強制し、
    // JS の整数オーバーフローで負値になって配列インデックスが壊れるのを防ぐ。
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
    vec[h % DIM] += f / tokens.length
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}
