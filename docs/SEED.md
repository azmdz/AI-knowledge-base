# シードデータ管理ガイド

`prisma/seed-data.json` に定義されたユーザー・記事を `npx prisma db seed` で DB に投入します。

---

## シードデータの構成

```
prisma/
├── seed.ts           # シードスクリプト
└── seed-data.json    # ユーザー・記事の定義
```

### seed-data.json の形式

```json
{
  "users": [
    {
      "id": "user_alice",
      "name": "Alice Tanaka",
      "email": "alice@example.com"
    }
  ],
  "articles": [
    {
      "title": "記事タイトル",
      "tags": ["タグA", "タグB"],
      "authorId": "user_alice",
      "viewCount": 0,
      "body": "# 記事タイトル\n\n本文..."
    }
  ]
}
```

### フィールド説明

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | ✓ | 記事タイトル。重複チェックのキーになる（同タイトルはスキップ） |
| `tags` | ✓ | タグ名の配列。Tag テーブルに upsert される |
| `authorId` | ✓ | `users` に定義した `id` と一致させること |
| `viewCount` | − | 省略時は 0。デモ用に任意の数を入れられる |
| `body` | ✓ | Markdown 形式の本文。`bodyRaw` と `bodyFormatted` の両方に設定される |

---

## 記事の追加方法

### 1. seed-data.json に追記

```json
{
  "articles": [
    // 既存の記事...
    {
      "title": "AWS S3 バケットの命名規則",
      "tags": ["AWS", "インフラ", "ガイドライン"],
      "authorId": "user_bob",
      "viewCount": 0,
      "body": "# AWS S3 バケットの命名規則\n\n..."
    }
  ]
}
```

### 2. シードを再実行

```bash
npx prisma db seed
```

**冪等性**: 同じタイトルの記事は `Skipping` とログに出てスキップされます。既存データは上書きされません。

---

## 埋め込みベクトルの扱い

### シードデータの埋め込み

`seed.ts` 内の `buildSimpleEmbedding()` が TF-IDF 相当の軽量計算でベクトルを生成します（`embeddingModel: 'tfidf-seed'`）。

これは `lib/ai/tfidf.ts` と同じアルゴリズムを使っているため、シード記事も AI 検索のヒット対象になります。

### ユーザーが投稿・編集した記事の埋め込み

API 経由で記事を作成・更新すると、埋め込みベクトルは**自動で生成・更新**されます。手動操作は不要です。

| 操作 | 埋め込み更新 |
|------|------------|
| `POST /api/articles`（新規投稿） | ✓ 自動生成 |
| `PATCH /api/articles/[id]`（編集・保存） | ✓ 自動再計算 |
| `npx prisma db seed`（シード） | ✓ seed.ts 内で生成 |
| DB に直接 INSERT（非推奨） | ✗ 手動で更新が必要 |

### DB 直接 INSERT 後の再インデックス

やむを得ず DB に直接記事を挿入した場合や、埋め込みモデルを変更した場合は、以下のスクリプトで全記事を再インデックスできます。

```ts
// scripts/reindex.ts（必要に応じて作成）
import { PrismaClient } from '../app/generated/prisma'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { getAIProvider } from '../lib/ai'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })
const ai = getAIProvider()

async function reindex() {
  const articles = await prisma.article.findMany()
  for (const article of articles) {
    const embedding = await ai.embed(article.title + '\n' + article.bodyRaw)
    await prisma.article.update({
      where: { id: article.id },
      data: { embedding: JSON.stringify(embedding), embeddingModel: 'tfidf-reindexed' },
    })
    console.log('Reindexed:', article.title)
  }
}

reindex().finally(() => prisma.$disconnect())
```

```bash
npx ts-node scripts/reindex.ts
```

---

## ユーザーの追加・変更

`seed-data.json` の `users` に追加し、`npx prisma db seed` を実行します。ユーザーは `email` をキーに upsert されるため、同メールアドレスのユーザーは更新されません（`update: {}` により変更なし）。

本番移行後は NextAuth で管理するため、シードユーザーは開発・デモ用途に限定してください。

---

## よくある操作

```bash
# シード実行（冪等、何度実行しても安全）
npx prisma db seed

# DB を初期化してシードし直す（開発環境のみ）
npx prisma migrate reset   # 確認プロンプトあり・全データ削除

# シードのドライラン（実際には書き込まない、TypeScript 確認のみ）
npx tsc --noEmit prisma/seed.ts
```
