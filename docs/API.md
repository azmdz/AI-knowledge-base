# API リファレンス

## 概要

すべてのエンドポイントは JSON を入出力とします。エラーレスポンスは `{ "error": ... }` の形式で返します。

**ベースURL**: `http://localhost:3000`（開発環境）

### 認可ヘッダー

書き込み系の操作は `X-User-Id` ヘッダーでユーザーを識別します。

| ヘッダー | 型 | 説明 |
|---------|-----|------|
| `X-User-Id` | string | 操作を行うユーザーの ID（`/api/users` で取得） |

ヘッダーが欠落している場合は `401 Unauthorized`、記事の所有者でない場合は `403 Forbidden` を返します。

### レート制限

AI エンドポイントは IP ごとに制限があります。超過時は `429` と `Retry-After` ヘッダー（秒数）を返します。

| エンドポイント | 上限 |
|--------------|------|
| `POST /api/ai/format` | 10 回 / 分 / IP |
| `POST /api/ai/tags` | 10 回 / 分 / IP |
| `POST /api/ai/edit` | 10 回 / 分 / IP |
| `POST /api/search` | 20 回 / 分 / IP |

### REST 原則からの意図的な逸脱

| エンドポイント | 逸脱内容 | 理由 |
|---|---|---|
| `POST /api/ai/format` | URL に動詞 (`format`) | AI への命令はリソース操作ではなくアクション。RPC スタイルの方が意図が明確 |
| `POST /api/ai/tags` | URL に動詞ではなくリソース名 | タグ提案はタグリソースへのアクションとして表現 |
| `POST /api/ai/edit` | URL に動詞 (`edit`) | 同上 |
| `POST /api/search` | 検索に GET でなく POST | `SearchLog` 作成の副作用があるため GET は不適切。将来のフィルタ拡張もボディ受け取りの方が柔軟 |
| `GET /api/drafts` | `/api/articles?status=draft` で代替可能 | 認可ロジック（本人記事のみ）が異なるため、将来の認証導入時に独立して保護できるよう専用エンドポイントとした |

---

## ユーザー

### `GET /api/users` — ユーザー一覧取得

登録済みユーザーの一覧を返します。ヘッダーのユーザー切り替え UI で使用します。

**レスポンス** `200 OK`

```json
[
  { "id": "user_alice", "name": "Alice Tanaka" },
  { "id": "user_bob",   "name": "Bob Suzuki" }
]
```

---

## 記事

### `GET /api/articles` — 記事一覧取得

公開済み記事の一覧を返します。

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|---------|------|
| `tag` | string | — | タグ名でフィルタ |
| `sort` | `newest` \| `popular` | `newest` | ソート順（新着 / 閲覧数） |

**レスポンス** `200 OK`

```json
[
  {
    "id": "cm1abc...",
    "title": "VPN 接続トラブルの対処法",
    "bodyRaw": "...",
    "bodyFormatted": "...",
    "authorId": "user_alice",
    "status": "published",
    "viewCount": 42,
    "createdAt": "2026-01-15T09:00:00.000Z",
    "updatedAt": "2026-01-20T12:00:00.000Z",
    "author": { "id": "user_alice", "name": "Alice Tanaka" },
    "tags": [
      { "tagId": "tag1", "articleId": "cm1abc...", "source": "user", "tag": { "id": "tag1", "name": "VPN" } }
    ]
  }
]
```

---

### `POST /api/articles` — 記事作成

新規記事を作成します。作成時に本文をベクトル化して `embedding` に保存します。

**必須ヘッダー**: `X-User-Id: <userId>`

**リクエストボディ**

```json
{
  "title": "VPN 接続トラブルの対処法",
  "bodyRaw": "VPNが繋がらない場合は...",
  "bodyFormatted": "# VPN 接続トラブル\n\n...",
  "status": "published",
  "tags": ["VPN", "ネットワーク"],
  "tagSources": {
    "VPN": "user",
    "ネットワーク": "ai_suggested"
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `title` | string | ✅ | 1〜200文字 |
| `bodyRaw` | string | ✅ | 原文（常に保存） |
| `bodyFormatted` | string | — | AI整形版（人間承認後のみ送信） |
| `status` | `"published"` \| `"draft"` | — | デフォルト: `"published"` |
| `tags` | string[] | — | タグ名の配列 |
| `tagSources` | object | — | タグ名 → `"user"` または `"ai_suggested"` |

**レスポンス** `201 Created`

作成した記事オブジェクト

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `401` | `X-User-Id` ヘッダーが欠落 |
| `404` | ユーザーが存在しない |
| `500` | サーバーエラー |

---

### `GET /api/articles/[id]` — 記事詳細取得

指定 ID の記事を返します。公開済み記事の取得時のみ `viewCount` を +1 インクリメントします。

**レスポンス** `200 OK`

```json
{
  "id": "cm1abc...",
  "title": "VPN 接続トラブルの対処法",
  "bodyRaw": "...",
  "bodyFormatted": "...",
  "status": "published",
  "viewCount": 43,
  "author": { "id": "user_alice", "name": "Alice Tanaka" },
  "tags": [...]
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `404` | 記事が存在しない |
| `500` | サーバーエラー |

---

### `PATCH /api/articles/[id]` — 記事更新

既存記事を更新します。タグは全件洗い替えします。更新時に埋め込みを再計算します。

**必須ヘッダー**: `X-User-Id: <userId>`（著者本人のみ）

**リクエストボディ**

```json
{
  "title": "VPN 接続トラブルの対処法（改訂版）",
  "bodyRaw": "更新後の原文...",
  "bodyFormatted": null,
  "status": "published",
  "tags": ["VPN", "ネットワーク", "セキュリティ"],
  "tagSources": {
    "VPN": "user",
    "セキュリティ": "ai_suggested"
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `title` | string | ✅ | |
| `bodyRaw` | string | ✅ | |
| `bodyFormatted` | string \| null | — | `null` を明示すると整形版をクリア |
| `status` | `"published"` \| `"draft"` | — | 省略時は現状維持 |
| `tags` | string[] | — | |
| `tagSources` | object | — | |

**レスポンス** `200 OK`

更新後の記事オブジェクト

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `401` | `X-User-Id` ヘッダーが欠落 |
| `403` | 著者以外が更新しようとした |
| `404` | 記事が存在しない |
| `500` | サーバーエラー |

---

### `DELETE /api/articles/[id]` — 記事削除

**必須ヘッダー**: `X-User-Id: <userId>`（著者本人のみ）

**レスポンス** `204 No Content`

**エラー**

| コード | 条件 |
|--------|------|
| `401` | `X-User-Id` ヘッダーが欠落 |
| `403` | 著者以外が削除しようとした |
| `404` | 記事が存在しない |
| `500` | サーバーエラー |

---

### `GET /api/articles/[id]/reactions` — リアクション取得

記事のリアクション件数と、指定ユーザーのリアクション状態を返します。

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `userId` | string | ユーザーID（省略時は `userReacted` が空配列） |

**レスポンス** `200 OK`

```json
{
  "counts": { "like": 5, "helpful": 3 },
  "userReacted": ["like"]
}
```

---

### `POST /api/articles/[id]/reactions` — リアクションのトグル

既にリアクション済みなら削除、未リアクションなら追加します。更新後の状態を返します。

**リクエストボディ**

```json
{
  "userId": "user_alice",
  "type": "like"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `userId` | string | リアクションするユーザーID |
| `type` | `"like"` \| `"helpful"` | リアクション種別 |

**レスポンス** `200 OK`

```json
{
  "counts": { "like": 6, "helpful": 3 },
  "userReacted": ["like"]
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `404` | 記事が存在しない |
| `500` | サーバーエラー |

---

## タグ

### `GET /api/tags` — 既存タグ一覧

登録済みタグを記事数の降順で返します。タグ入力時の補完候補に使用します。

**レスポンス** `200 OK`

```json
[
  { "name": "VPN", "count": 5 },
  { "name": "ネットワーク", "count": 3 }
]
```

---

## 下書き

### `GET /api/drafts` — 自分の下書き一覧

認証ユーザー本人の下書き記事を返します。

**必須ヘッダー**: `X-User-Id: <userId>`

**レスポンス** `200 OK`

```json
[
  {
    "id": "cm2def...",
    "title": "作業メモ",
    "bodyRaw": "...",
    "updatedAt": "2026-06-28T10:00:00.000Z",
    "author": { "name": "Alice Tanaka" }
  }
]
```

**エラー**

| コード | 条件 |
|--------|------|
| `401` | `X-User-Id` ヘッダーが欠落 |
| `500` | サーバーエラー |

---

## 検索

### `POST /api/search` — 記事検索

AI モード（RAG）とキーワードモードを切り替えて検索します。

**リクエストボディ**

```json
{
  "query": "VPNが繋がらないときの対処法を教えて",
  "mode": "ai",
  "topK": 5
}
```

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|---------|------|
| `query` | string | — | 検索クエリ（1〜500文字） |
| `mode` | `"ai"` \| `"regular"` | `"ai"` | 検索モード |
| `topK` | integer | `5` | AI検索時の参照記事数（1〜10） |

**AI モードのレスポンス** `200 OK`

```json
{
  "mode": "ai",
  "logId": "cm2xyz...",
  "answer": "VPNが繋がらない場合、まず設定の「プロトコル」をIKEv2に変更してください...",
  "citedArticles": [
    {
      "id": "cm1abc...",
      "title": "VPN 接続トラブルの対処法",
      "tags": ["VPN", "ネットワーク"]
    }
  ]
}
```

**キーワードモードのレスポンス** `200 OK`

```json
{
  "mode": "regular",
  "articles": [
    {
      "id": "cm1abc...",
      "title": "VPN 接続トラブルの対処法",
      "excerpt": "…VPNが繋がらない場合は、設定でIKEv2を選ぶ…",
      "tags": ["VPN", "ネットワーク"],
      "author": "Alice Tanaka",
      "createdAt": "2026-01-15T09:00:00.000Z"
    }
  ]
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `429` | レート制限（20 回 / 分）超過 |
| `500` | 検索失敗 |

---

### `PATCH /api/search/[id]` — 検索フィードバック送信

AI 検索結果に対する「役に立った / 役に立たなかった」フィードバックを送信します。

**リクエストボディ**

```json
{ "wasHelpful": true }
```

**レスポンス** `200 OK`

更新された `SearchLog` オブジェクト

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `404` | 検索ログが存在しない |

---

## AI

### `POST /api/ai/format` — 記事整形

原文を渡すと、整形済み Markdown 本文とタイトル候補を返します。タグ提案は別エンドポイント（`POST /api/ai/tags`）です。レート制限: 10 回 / 分 / IP。

**リクエストボディ**

```json
{
  "raw": "vpnつながらない\nIKEv2にしたら治った\nあとDNSも8.8.8.8に変えた"
}
```

**レスポンス** `200 OK`

```json
{
  "title": "VPN 接続トラブルの対処法",
  "body": "# VPN 接続トラブルの対処法\n\n## 症状\n..."
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `400` | `raw` が空 |
| `429` | レート制限超過（`Retry-After` ヘッダーに残り秒数） |
| `500` | AI 処理失敗 |

---

### `POST /api/ai/tags` — AIタグ提案

記事本文を渡すと、タグ候補を3〜5個返します。レート制限: 10 回 / 分 / IP。

**リクエストボディ**

```json
{
  "body": "# VPN 接続トラブルの対処法\n\nVPNが繋がらない場合は..."
}
```

**レスポンス** `200 OK`

```json
{
  "tags": ["VPN", "ネットワーク", "DNS", "トラブルシューティング"]
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `400` | `body` が空 |
| `429` | レート制限超過（`Retry-After` ヘッダーに残り秒数） |
| `500` | AI 処理失敗 |

---

### `POST /api/ai/edit` — AI 編集

本文と自然言語の編集指示を渡すと、編集後の本文を返します。レート制限: 10 回 / 分 / IP。

**リクエストボディ**

```json
{
  "body": "# VPN接続トラブル\n\nVPNが繋がらない...",
  "instruction": "箇条書きに整理して、手順番号を付けてください"
}
```

**レスポンス** `200 OK`

```json
{
  "body": "# VPN接続トラブル\n\n## 手順\n\n1. 設定アプリを開く\n..."
}
```

**エラー**

| コード | 条件 |
|--------|------|
| `400` | バリデーションエラー |
| `429` | レート制限超過（`Retry-After` ヘッダーに残り秒数） |
| `500` | AI 処理失敗 |

---

### `POST /api/ai/edit-log` — AI 編集採用 / 却下ログ記録

ユーザーが差分ビューで「採用する」または「却下」を選択した際に呼ばれます。KPI 計測用途。

**リクエストボディ**

```json
{
  "instruction": "箇条書きに整理して",
  "accepted": true,
  "articleId": "cm1abc..."
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `instruction` | string | ✅ | AI への指示内容 |
| `accepted` | boolean | ✅ | `true` = 採用 / `false` = 却下 |
| `articleId` | string | — | 記事編集時のみ記事 ID を紐付け |

**レスポンス** `200 OK`

```json
{ "id": "cm3log..." }
```

---

## エラーレスポンス共通フォーマット

**バリデーションエラー（400）**

```json
{
  "error": {
    "fieldErrors": {
      "title": ["String must contain at least 1 character(s)"]
    },
    "formErrors": []
  }
}
```

**認証・認可エラー**

```json
{ "error": "Unauthorized" }
{ "error": "Forbidden" }
```

**レート制限（429）**

```json
{ "error": "Too many requests" }
```

`Retry-After` ヘッダーに再試行可能になるまでの秒数が含まれます。

**サーバーエラー（500）**

```json
{ "error": "Internal server error" }
```

---

## データモデル早見表

| テーブル | 主な用途 | KPI 関連カラム |
|---------|---------|-------------|
| `Article` | 記事本体 | `viewCount`, `embeddingModel` |
| `ArticleTag` | 記事↔タグの中間テーブル | `source`（user / ai_suggested） |
| `SearchLog` | 検索ログ | `wasHelpful`（北極星指標） |
| `EditLog` | AI 編集採用 / 却下ログ | `accepted`（AI 編集採用率） |
| `User` | ユーザー | — |
| `Tag` | タグマスター | — |
| `Reaction` | いいね / 役立つ | — |
