# KPI 設計

## 1. 解決したい仮説

このプロダクトは以下の2つの仮説を前提に設計されています。KPI はこれらの仮説が正しいかどうかを定量的に検証するために設定します。

| # | 仮説 | 検証する指標 |
|---|------|------------|
| H1 | 記事を書くハードルの高さ・不完全なものを公開する心理的障壁が、投稿数を抑制している | AI編集採用率・AI補助利用後の公開完了率 |
| H2 | 検索が役に立たないことが、サービスの定着を妨げている | 検索成功率・リピート検索率 |

---

## 2. 北極星指標

**月間投稿者比率**（月間投稿者数 ÷ 全ユーザー数）

```sql
SELECT
  COUNT(DISTINCT authorId) AS active_authors,
  (SELECT COUNT(*) FROM User) AS total_users,
  ROUND(
    100.0 * COUNT(DISTINCT authorId) / (SELECT COUNT(*) FROM User), 1
  ) AS author_ratio_pct
FROM Article
WHERE status = 'published'
  AND createdAt >= DATE('now', '-30 days');
```

**目標**: 30% 以上

このサービスの設計思想は「書く摩擦を下げること」です。記事が増えなければ検索成功率は動かず、正のループも起動しません。投稿者比率は供給側の健全性を示す先行指標であり、他のすべての指標の前提になります。

検索成功率（`SearchLog.wasHelpful`）は投稿者比率が上がった結果として追ってくる遅行指標として別途監視します。

---

## 3. 先行指標

北極星指標（投稿者比率）が改善している理由を掘り下げるために、以下の指標を日常的に観察します。

### 3.1 書き手側の指標

#### AI編集採用率
```sql
SELECT
  COUNT(*) FILTER (WHERE accepted = true)  AS accepted,
  COUNT(*)                                  AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE accepted = true) / COUNT(*), 1
  ) AS adoption_rate_pct
FROM EditLog;
```

**目標**: 60% 以上

**解釈**:
- 採用率が低い → AIの指示理解精度が低い、またはプロンプトが長すぎて役に立たない
- 採用率が高い → AI補助が書き手の期待に沿っている

---

#### AIタグ採用率
```sql
SELECT
  COUNT(*) FILTER (WHERE source = 'ai_suggested') AS ai_tags,
  COUNT(*)                                          AS total_tags,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE source = 'ai_suggested') / COUNT(*), 1
  ) AS ai_adoption_pct
FROM ArticleTag;
```

**目標**: 40% 以上

**解釈**:
- 採用率が低い → AI提案タグの精度が低い、またはユーザーが手動タグを好む
- 採用率が高い → タグ付け摩擦の解消に成功している

---

### 3.2 読み手側の指標

#### 検索成功率
```sql
SELECT
  COUNT(*) FILTER (WHERE wasHelpful = true)  AS helpful,
  COUNT(*) FILTER (WHERE wasHelpful = false) AS not_helpful,
  COUNT(*) FILTER (WHERE wasHelpful IS NULL) AS no_feedback,
  COUNT(*)                                    AS total,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE wasHelpful = true)
      / NULLIF(COUNT(*) FILTER (WHERE wasHelpful IS NOT NULL), 0), 1
  ) AS success_rate_pct
FROM SearchLog
WHERE createdAt >= DATE('now', '-30 days');
```

**目標**: フィードバックあり件数の 60% 以上が「役に立った」

**注意**: フィードバック回答率自体も監視する。回答率が低すぎると指標として信頼できない。

---

#### Reactions（いいね・役立つ）集計
```sql
SELECT
  type,
  COUNT(*) AS total,
  COUNT(DISTINCT articleId) AS articles_with_reaction,
  COUNT(DISTINCT userId) AS users_who_reacted
FROM Reaction
WHERE createdAt >= DATE('now', '-30 days')
GROUP BY type;
```

Reactionsはエンゲージメントの先行指標として機能します。反応数が増えることで書き手の投稿動機（M）が補強されます。

---

### 3.3 ループ全体の指標

#### AI補助利用後の公開完了率（現在未実装）

**定義**: AI編集を1回以上使ったセッションで、最終的に記事が公開されたセッションの割合

**実装に必要なもの**:
- 記事作成セッションの開始イベント記録（`ArticleSession` テーブル等）
- `EditLog.sessionId` と `Article.id` の紐付け

これを計測できると「AI補助が心理的障壁の解消に有効か」という仮説H1を直接検証できます。現フェーズでは EditLog の `articleId` から編集時の採用率を代替指標として使用します。

---

## 4. ガードレール指標

これらが悪化した場合、たとえ北極星指標が改善していても問題と判断します。

| 指標 | 閾値 | 測定方法 |
|------|------|---------|
| AI API エラー率 | 5% 以下 | サーバーログの HTTP 500 件数 |
| 検索応答時間（P95） | 3秒以内 | Next.js サーバーログ |
| 記事取得エラー率 | 1% 以下 | `/api/articles` の 5xx 件数 |
| レート制限到達率 | 通常運用で 1% 以下 | HTTP 429 の件数 |

---

## 5. アンチKPI（追ってはいけない指標）

| 指標 | 追わない理由 |
|------|------------|
| 総記事数 | 低品質な記事を量産してもループが回らない |
| 総閲覧数（PV） | 同じ人が同じ記事を繰り返し見ても価値は増えない |
| AI使用回数 | AI利用自体が目的ではなく、手段に過ぎない |
| Reactions 総数 | 少数の記事に集中する可能性があり、投稿者の広がりを反映しない |

---

## 6. 計測ロードマップ

| フェーズ | 計測できること | 実装状況 |
|---------|-------------|---------|
| **現在** | 投稿者比率、検索成功率、AIタグ採用率、AI編集採用率、Reactions集計 | ✅ 実装済み |
| **フェーズ2**（認証導入後） | 投稿者比率（個人単位）、個人別行動分析 | 🔲 未実装 |
| **フェーズ3**（セッション記録後） | AI補助 → 公開完了率、離脱ポイント特定 | 🔲 未実装 |
