# 社内ナレッジベース

「使われない社内サービスを改善せよ」課題の提出物です。

---

## 1. 課題分析

### 行動指針：Done is better than perfect

「書き殴った初稿はある。でもクオリティが不安で公開できていない」という状態が、社内ナレッジが蓄積されない根本原因だと見ています。このサービスは Draft から Published の距離を縮めることにフォーカスしました。

AI が社内文書の水準に合わせて整形・校正するため、ユーザーは内容の事実確認だけ行えば公開できます。汎用 AI との違いは、社内向けに調整されたプロンプトと社内記事データを使う点と、「これでいいか？」の品質判断をサービスが引き受ける点です。

### 問題の本質：1つの負のループ

「利用率が低い・投稿されない・検索されない・定着しない」は独立した4問題ではなく、相互依存する負のフィードバックループです。

```
投稿されない → 記事が少ない → 検索しても役に立たない
     ↑                                    ↓
  定着しない  ←←←← 使われない ←←←←←←←←
```

公開ハードルを下げると、このループが逆転します。

```
公開ハードルが下がる（AI校正）→ 記事が増える → 検索精度が上がる
           ↑                                           ↓
    また書きたくなる ←← 成功体験が生まれる ←←←←←←←
```

### Fogg 行動モデル (B = M × A × T) で分析

| 障壁 | 種別 | 深刻度 |
|------|------|--------|
| **検索しても答えが見つからない** | 能力(A)の欠如 | ★★★★★ |
| **記事の書き方がわからない** | 能力(A)の欠如 | ★★★★☆ |
| **投稿した感覚が薄い** | 動機(M)の欠如 | ★★★☆☆ |
| **記事がそもそも少ない（コールドスタート）** | トリガー(T)の欠如 | ★★★★☆ |
| 文化・運用オーナー不在 | 環境 | コードでは解決不可 |

### 最大レバレッジの選定

コードで解決できる最大のボトルネックは2点に絞りました：

1. **「書く摩擦が高い」（北極星）** → **AI整形・AI編集支援 + タグ提案で投稿ハードルを下げる**
2. **「検索しても役に立たない」** → **AI Q&A（RAG）で自然言語の質問に引用付き回答**

---

## 2. 改善案と KPI

### 改善策と選定理由

Fogg モデルで「深刻度★4以上」かつ「コードで解決できる」障壁を優先しました。

| 施策 | 解消する障壁 | 選んだ理由 | 実装 |
|------|------------|-----------|------|
| AI Q&A 検索（RAG） | 「検索しても見つからない」（能力★5） | Fogg 分析で深刻度は最大だが、記事が蓄積されていないと機能しない。書く摩擦解消と並行して対応 | `/search` |
| AI 記事整形・タグ提案 | 「書き方がわからない」（能力★4） | 「書けるが公開できない」層が多いと見た。AI整形で品質判断を肩代わりする | `/new` + `POST /api/ai/format` |
| AI 編集指示 + diff 表示 | 「不完全なものを公開する心理的障壁」 | 整形だけでは細かい調整ができない。diff で変更箇所を確認してから採用できる | `/new`, `/articles/[id]/edit` |
| シードデータ（15件） | デモ・評価用の初期データ | コールドスタートの本質的解決はワークショップ等の組織施策が必要（コードでは解決不可）。RAG や整形の動作確認に最低限の文脈として用意 | `prisma/seed.ts` |
| Reactions（いいね・役立つ） | 「投稿した感覚が薄い」（動機★3） | 実装コストが低く、書き手への可視フィードバックになる | `/articles/[id]` |
| AI編集採用率の追跡 | 効果測定 | 採用率が低ければプロンプト改善の根拠になる | `EditLog` |

### KPI の変化想定

| 指標 | 実装前 | 実装後（目標） | 変化の理由 |
|------|--------|--------------|-----------|
| **投稿者比率**（北極星） | 低（投稿の摩擦・品質不安が原因） | 30% 以上 | AI整形・編集指示で「書き殴り→公開」の心理的距離が縮まる。記事が増えて初めて検索成功率も動く |
| **検索成功率** | 計測不能（記事が少なく検索自体されない） | 60% 以上 | 投稿者比率が上がり記事が蓄積された結果として追ってくる遅行指標 |
| **AI編集採用率** | N/A（機能なし） | 60% 以上 | 採用率が低い場合はプロンプト改善の根拠として使う |
| **AIタグ採用率** | N/A（機能なし） | 40% 以上 | タグ入力の手間が省けるため採用されやすい。タグ精度の代理指標でもある |

投稿者比率が上がれば記事が増え、検索精度が上がり、また使われる——この順序で正のループが回ります。

→ 計測クエリ・フェーズ2KPIの詳細は [`docs/KPI.md`](docs/KPI.md) を参照

---

## 3. 実装

### 技術スタック

| 分類 | 採用技術 |
|------|---------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| DB | SQLite (Prisma 7 + libSQL Driver Adapter) |
| AI | Anthropic Claude (`claude-opus-4-8`) / OpenAI GPT-4o / MockProvider |
| エディタ | Tiptap（WYSIWYG × Markdown） |
| バリデーション | Zod |

### 機能一覧

- **記事一覧** (`/`) — タグフィルタ・新着/人気ソート
- **記事詳細** (`/articles/[id]`) — Markdownレンダリング・閲覧数インクリメント・Reactions
- **記事投稿** (`/new`) — WYSIWYG エディタ + AI編集指示 + diff 差分表示 + タグ提案 + localStorage 自動保存
- **記事編集** (`/articles/[id]/edit`) — 投稿と同一のAI支援UI
- **下書き一覧** (`/drafts`) — 自分の下書きのみ表示・編集へのリンク
- **AI Q&A 検索** (`/search`) — 自然言語で質問 → RAGで引用付き回答 → フィードバック収集
- **キーワード検索** (`/search`) — トグルで切り替え・検索語ハイライト
- **グローバルユーザー切り替え** (ヘッダー) — 認証なしでユーザーをシミュレート

### AI 編集フロー

```
[本文を書く] → [AI編集指示を入力] → [差分を確認] → [採用 / 却下]
                                                         ↓
                                               EditLog に記録（KPI計測）
```

### AI Provider 抽象化

```
AI_PROVIDER=anthropic # Claude API を使用
AI_PROVIDER=openai    # OpenAI GPT-4o を使用
AI_PROVIDER=mock      # API キーなしで動作（開発用・デフォルト）
```

APIキーがない場合は `openai` → `anthropic` → `mock` の順でフォールバックします。

`bodyRaw`（原文）は常に保持し、`bodyFormatted`（AI整形版）は人間が承認後のみ保存します。

---

## セットアップ

```bash
# 1. 依存関係インストール
npm install

# 2. Prisma Client 生成（Prisma 7 Driver Adapter 必須）
npx prisma generate

# 3. 環境変数を設定
cp .env.example .env
# .env を編集（任意で API キーを設定）

# 4. DB マイグレーション & シードデータ投入
npx prisma migrate deploy
npx prisma db seed

# 5. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

### 環境変数

| 変数 | 説明 | デフォルト |
|------|------|---------|
| `DATABASE_URL` | SQLite ファイルパス | `file:./dev.db` |
| `AI_PROVIDER` | `anthropic` / `openai` / `mock` | `mock` |
| `ANTHROPIC_API_KEY` | Anthropic API キー | （anthropic 時は必須） |
| `OPENAI_API_KEY` | OpenAI API キー | （openai 時は必須） |

APIキーなしでも `AI_PROVIDER=mock` でシードデータ入りの状態で全機能が動作します。

---

## ディレクトリ構成

```
.
├── app/
│   ├── page.tsx                                # 記事一覧
│   ├── articles/
│   │   └── [id]/
│   │       ├── page.tsx                        # 記事詳細（Reactions含む）
│   │       └── edit/page.tsx                   # 記事編集
│   ├── drafts/page.tsx                         # 下書き一覧（自分の下書きのみ）
│   ├── new/page.tsx                            # 記事投稿（localStorage自動保存）
│   ├── search/page.tsx                         # Q&A検索
│   └── api/
│       ├── articles/route.ts                   # GET 一覧 / POST 作成
│       ├── articles/[id]/route.ts              # GET 詳細 / PATCH 更新 / DELETE 削除
│       ├── articles/[id]/reactions/route.ts    # GET カウント / POST トグル
│       ├── ai/format/route.ts                  # AI整形（本文のみ）レート制限付き
│       ├── ai/tags/route.ts                    # AIタグ提案（レート制限付き）
│       ├── ai/edit/route.ts                    # AI編集（レート制限付き）
│       ├── ai/edit-log/route.ts                # 採用/却下ログ
│       ├── drafts/route.ts                     # 下書き一覧
│       ├── tags/route.ts                       # 既存タグ一覧（補完用）
│       ├── search/route.ts                     # RAG検索（レート制限付き）
│       ├── search/[id]/route.ts                # フィードバック更新
│       └── users/route.ts                      # ユーザー一覧
├── components/
│   ├── ArticleActions.tsx                      # 編集・削除ボタン（著者本人のみ表示）
│   ├── ArticleCard.tsx
│   ├── ArticleEditForm.tsx                     # 編集フォーム（AI編集UI付き）
│   ├── DiffViewer.tsx                          # git-like 差分表示
│   ├── MarkdownEditor.tsx                      # Tiptap WYSIWYG エディタ
│   ├── ReactionButtons.tsx                     # いいね・役立つボタン
│   ├── TagFilter.tsx
│   └── UserSelector.tsx                        # ヘッダー用ユーザー切り替え
├── hooks/
│   └── useArticleEditor.ts                     # AI編集・タグ管理の共通フック
├── lib/
│   ├── ai/
│   │   ├── provider.ts                         # AIProvider インターフェース
│   │   ├── prompts.ts                          # AIプロンプト定義（format / edit / answer）
│   │   ├── parse-answer.ts                     # cited_ids パーサー（共有）
│   │   ├── tfidf.ts                            # ベクトル生成（256次元・CJK対応）
│   │   ├── similarity.ts                       # コサイン類似度
│   │   ├── real.ts                             # Anthropic Claude 実装
│   │   ├── openai.ts                           # OpenAI 実装
│   │   ├── mock.ts                             # モック実装
│   │   └── index.ts                            # プロバイダーファクトリー
│   ├── prisma.ts                               # Prisma Client シングルトン
│   ├── rate-limit.ts                           # インメモリレートリミッター
│   └── user-context.tsx                        # UserProvider + useCurrentUser
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── seed-data.json                          # シード記事15件
└── docs/
    ├── DESIGN.md                               # 設計思想・アーキテクチャ
    ├── KPI.md                                  # KPI設計・計測クエリ
    ├── API.md                                  # APIリファレンス
    ├── USAGE.md                                # 使用ガイド・MVP仕様
    ├── SEED.md                                 # シードデータ管理・再インデックス手順
    └── PRODUCTION.md                           # 本番化チェックリスト
```

---

## 意図的に含めなかったもの

| 機能 | 理由 |
|------|------|
| 認証（NextAuth 等） | MVPの優先範囲外。現在はヘッダーのユーザー切り替えで代替。本番化時に NextAuth を追加する。 |
| Slack通知連携 | 「投稿した感覚が薄い」動機の問題へのアプローチとして有効。フェーズ2以降。 |
| ストリーミング応答 | AI回答のUX向上に有効だが、実装複雑度に対してMVP段階では優先度が低い。 |
| pgvector 移行 | 現状の全件コサイン類似度計算は記事数が少いうちは十分。スケール時に移行する。 |
| 収集データの活用 | `SearchLog.wasHelpful` / `EditLog.accepted` / `ArticleTag.source` はすでに収集中。蓄積後にプロンプト改善・埋め込みモデル改善・検索チューニングへ活用する。詳細は [`docs/PRODUCTION.md`](docs/PRODUCTION.md) を参照。 |
