# 本番化チェックリスト

MVP（SQLite・疑似認証）から本番環境へ移行する際に対応が必要な項目をまとめています。

各項目は独立しているため、段階的に対応できます。優先度の目安は「リスクの大きさ」で並べています。

---

## 1. 認証（最優先）

**現状**: `X-User-Id` ヘッダーをブラウザが送信。技術的にはなりすまし可能。

**移行先**: NextAuth.js（メール認証 / Google / GitHub など）

```bash
npm install next-auth
```

**変更が必要な箇所**

| ファイル | 変更内容 |
|---------|---------|
| `lib/user-context.tsx` | `UserProvider` を NextAuth の `SessionProvider` に置き換え |
| `app/api/articles/route.ts` | `req.headers.get('x-user-id')` → `getServerSession()` |
| `app/api/articles/[id]/route.ts` | 同上 |
| `app/api/drafts/route.ts` | 同上 |
| `components/UserSelector.tsx` | ログイン/ログアウト UI に差し替え |

**注意**: シードユーザー（`user_alice` 等）は固定 ID で作成されています。NextAuth 移行後は実アカウントのIDに合わせてシードを更新するか、ユーザーを再作成してください。

---

## 2. データベース

**現状**: SQLite（シングルライター、ファイルベース）

**移行先**: PostgreSQL + pgvector（ベクトル検索をDBに委ねる）

### 2-1. PostgreSQL への移行

`prisma/schema.prisma` のプロバイダーを変更します。

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`PrismaLibSql` アダプターは不要になるため、各ファイルから削除します。

```bash
npm uninstall @prisma/adapter-libsql @libsql/client
npx prisma migrate deploy
npx prisma db seed
```

### 2-2. pgvector への移行（オプション）

現在は全件コサイン類似度計算をアプリ側で行っています。記事数が増えてきたらベクトル近傍探索をDB側に移すことで検索が高速化します。

```prisma
// schema.prisma に追加
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector]
}

model Article {
  // embedding を String から Vector に変更
  embedding   Unsupported("vector(256)")?
}
```

`app/api/search/route.ts` のコサイン類似度計算を `ORDER BY embedding <=> $1` クエリに置き換えます。

---

## 3. レートリミッター

**現状**: `lib/rate-limit.ts` はインメモリ実装。プロセス再起動でリセット、複数インスタンスではカウントが共有されない。

**移行先**: Redis / Upstash Redis

```bash
npm install @upstash/redis
# または
npm install ioredis
```

`lib/rate-limit.ts` の `Map` を Redis の `INCR` + `EXPIRE` に置き換えます。Upstash を使う場合はサーバーレス環境でも動作します。

```ts
// Upstash 版の例
import { Redis } from '@upstash/redis'
const redis = new Redis({ url: process.env.UPSTASH_URL!, token: process.env.UPSTASH_TOKEN! })

export async function checkRateLimit(key: string, limit: number, windowMs: number) {
  const count = await redis.incr(key)
  if (count === 1) await redis.pexpire(key, windowMs)
  return count <= limit ? { allowed: true } : { allowed: false, resetAt: Date.now() + windowMs }
}
```

---

## 4. AI プロバイダー

**現状**: `AI_PROVIDER=mock` ではキーなしで動作するが、整形・検索の精度が低い。

**本番設定**

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8   # 省略時のデフォルト
```

または

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**コスト管理**: レートリミッターを Redis に移行してからコスト上限を設定することを推奨します。現状のインメモリ実装はマルチインスタンス環境でリミットが機能しません。

---

## 5. 埋め込みモデル

**現状**: 全プロバイダー共通で自前 TF-IDF（256次元）を使用。日本語の意味的類似性に限界がある。

**移行先**: `text-embedding-3-small`（OpenAI）等の外部埋め込みモデル

移行する場合は次元数が変わるため、既存の全記事の埋め込みを再計算する必要があります。

```ts
// lib/ai/openai.ts の embed() を変更
async embed(text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}
```

その後、全記事に対して再インデックスを実行します（[SEED.md](SEED.md) の「再インデックス」セクション参照）。

---

## 6. 環境変数チェックリスト

本番環境で設定が必要な環境変数の一覧です。

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | ✓ | PostgreSQL 接続文字列 |
| `NEXTAUTH_URL` | ✓ | 本番 URL（例: `https://knowledge.example.com`） |
| `NEXTAUTH_SECRET` | ✓ | `openssl rand -base64 32` で生成 |
| `AI_PROVIDER` | ✓ | `anthropic` または `openai` |
| `ANTHROPIC_API_KEY` | anthropic 時 | |
| `OPENAI_API_KEY` | openai 時 | |
| `UPSTASH_URL` | Redis 移行後 | |
| `UPSTASH_TOKEN` | Redis 移行後 | |

---

## 移行優先度まとめ

| 優先度 | 項目 | 理由 |
|--------|------|------|
| 即時 | 認証（NextAuth） | なりすましリスクが実害につながる |
| 早期 | PostgreSQL 移行 | SQLite はシングルライターのため本番負荷に耐えない |
| 早期 | Redis レートリミッター | マルチインスタンスでリミットが無効化される |
| 中期 | 本番 AI プロバイダー設定 | mock では整形・検索精度が低い |
| 長期 | pgvector / 埋め込みモデル改善 | 記事が数百件を超えた時点で検討 |
| 長期 | 収集データの活用 | 蓄積が一定量に達した時点で着手 |

---

## 7. 収集データの活用（フェーズ2）

MVP では以下のデータをすでに収集しています。蓄積が進んだ段階で、それぞれを改善施策へ接続します。

| データ | テーブル / カラム | 活用先 |
|--------|----------------|--------|
| 検索の役立ち度 | `SearchLog.wasHelpful` | RAG のコンテキスト選択チューニング、上位 k 件の最適化 |
| AI編集の採用率 | `EditLog.accepted` | 整形プロンプトの改善。採用率が低い編集パターンを特定 |
| AIタグの採用率 | `ArticleTag.source = 'ai_suggested'` | タグ提案プロンプトの改善。拒否されやすいタグの傾向分析 |
| リアクション数 | `Reaction.type` | 人気記事の特徴を分析し、整形スタイルのリファレンスに活用 |

### 活用の優先順序

1. **プロンプト改善**（コスト最小）: `EditLog` と `SearchLog` を集計し、採用率・成功率が低いパターンを洗い出してプロンプトを修正する
2. **埋め込みモデル改善**: 検索成功率が頭打ちになった段階で `text-embedding-3-small` 等に移行し、全記事を再インデックス（Section 5 参照）
3. **RAG チューニング**: コンテキストに渡す記事数・類似度閾値を `SearchLog.wasHelpful` を指標に調整

> **注意**: データ量が少ない段階での分析は統計的に不安定です。`SearchLog` が 200 件以上、`EditLog` が 100 件以上蓄積されてから着手することを推奨します。
