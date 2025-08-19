# 従業員満足度調査システム - URL リファレンス

## 本番環境URL
**ベースURL**: `https://web-production-4ecb0.up.railway.app`

---

## 🌐 公開ページ・エンドポイント

### メインページ
| URL | 説明 | アクセス権限 |
|-----|------|--------------|
| `/` | デモトップページ | 🌍 公開 |
| `/demo.html` | デモトップページ | 🌍 公開 |
| `/survey` | 基本調査ページ | 🌍 公開 |
| `/index.html` | 基本調査ページ | 🌍 公開 |

### 動的調査URL
| URL | 説明 | アクセス権限 |
|-----|------|--------------|
| `/survey/{token}` | トークン付き調査ページ | 🔗 トークン有効時のみ |

---

## 👥 企業向けページ

### 企業ログイン・ダッシュボード
| URL | 説明 | アクセス権限 |
|-----|------|--------------|
| `/company-login.html` | 企業ログインページ | 🌍 公開 |
| `/company-dashboard.html` | 企業管理ダッシュボード | 🏢 企業認証必須 |

### 企業向けAPI
| メソッド | URL | 説明 | 認証 |
|----------|-----|------|------|
| POST | `/api/company/login` | 企業ログイン | 🌍 公開 |
| GET | `/api/company/summary` | 企業サマリーデータ取得 | 🏢 企業認証 |
| GET | `/api/company/urls` | 企業の調査URL一覧取得 | 🏢 企業認証 |
| POST | `/api/company/urls` | 企業用調査URL作成 | 🏢 企業認証 |
| DELETE | `/api/company/urls/{token}` | 企業用調査URL無効化 | 🏢 企業認証 |
| GET | `/api/company/analytics` | 企業用分析データ取得 | 🏢 企業認証 |
| GET | `/api/company/export` | 企業用データエクスポート | 🏢 企業認証 |

---

## 🛠️ 運営者向けページ

### 運営者ダッシュボード
| URL | 説明 | アクセス権限 |
|-----|------|--------------|
| `/operator-login.html` | 運営者ログインページ | 🌍 公開 |
| `/operator-dashboard.html` | 運営者管理ダッシュボード | 🔧 運営者認証必須 |

### 運営者向けAPI
| メソッド | URL | 説明 | 認証 |
|----------|-----|------|------|
| GET | `/api/operator/overview` | システム概要データ | 🔧 運営者認証 |
| GET | `/api/operator/companies` | 企業一覧データ | 🔧 運営者認証 |
| POST | `/api/operator/companies` | 企業追加 | 🔧 運営者認証 |
| GET | `/api/operator/security` | セキュリティ監視データ | 🔧 運営者認証 |
| GET | `/api/operator/analytics` | 全体分析データ | 🔧 運営者認証 |
| GET | `/api/operator/settings` | システム設定取得 | 🔧 運営者認証 |
| PUT | `/api/operator/settings` | システム設定更新 | 🔧 運営者認証 |
| POST | `/api/operator/backup` | バックアップ実行 | 🔧 運営者認証 |

---

## 📊 管理者向けページ・API

### 管理者ダッシュボード
| URL | 説明 | アクセス権限 |
|-----|------|--------------|
| `/admin-dashboard.html` | 管理者ダッシュボード | 📊 管理者用 |

### 管理者向け企業管理API
| メソッド | URL | 説明 | 認証 |
|----------|-----|------|------|
| GET | `/api/admin/companies` | 管理者用企業一覧取得 | 📊 管理者用 |
| POST | `/api/admin/companies` | 管理者用企業作成 | 📊 管理者用 |
| PUT | `/api/admin/companies/{company_id}` | 管理者用企業更新 | 📊 管理者用 |
| DELETE | `/api/admin/companies/{company_id}` | 管理者用企業削除 | 📊 管理者用 |

---

## 📝 調査・データAPI

### 調査回答API
| メソッド | URL | 説明 | 認証 |
|----------|-----|------|------|
| POST | `/api/submit` | 調査回答の保存 | 🌍 公開 |
| GET | `/api/statistics` | 統計データ取得 | 🌍 公開 |
| GET | `/api/responses` | 全回答データ取得 | 📊 管理者用 |
| GET | `/api/free-text-analysis` | 自由記述分析データ取得 | 📊 管理者用 |
| GET | `/api/export` | データエクスポート | 📊 管理者用 |

### 調査URL管理API
| メソッド | URL | 説明 | 認証 |
|----------|-----|------|------|
| GET | `/api/tokens` | 調査URLトークン一覧取得 | 📊 管理者用 |
| POST | `/api/tokens` | 調査URLトークン作成 | 📊 管理者用 |
| DELETE | `/api/tokens/{token}` | 調査URLトークン無効化 | 📊 管理者用 |

---

## 🚀 主要なワークフロー

### 1. 企業アカウント作成〜調査実施
```
1. 運営者: /operator-dashboard.html → 企業管理 → 新規企業追加
2. 企業: /company-login.html → ログイン
3. 企業: /company-dashboard.html → 新規URL作成
4. 従業員: /survey/{token} → 調査回答
5. 企業: /company-dashboard.html → 結果確認
```

### 2. 調査データ分析
```
1. 管理者: /admin-dashboard.html → 統計確認
2. 運営者: /operator-dashboard.html → 全体分析
3. API: /api/statistics → 統計データ取得
4. API: /api/export → データダウンロード
```

---

## 🔐 認証について

### 企業認証
- **ログイン**: `POST /api/company/login`
- **認証方式**: `company_id` + `access_key`
- **トークン形式**: `company_{company_id}_{random}`

### 運営者認証
- **認証方式**: Bearer Token
- **トークン**: 設定により変更可能

### セキュリティ機能
- レート制限
- データサイズ制限
- 入力値サニタイズ
- トークン有効期限管理

---

## 📱 アクセス例

### 本番環境での主要URL
```
🌍 公開ページ:
https://web-production-4ecb0.up.railway.app/

🏢 企業ログイン:
https://web-production-4ecb0.up.railway.app/company-login.html

🔧 運営者ダッシュボード:
https://web-production-4ecb0.up.railway.app/operator-dashboard.html

📊 管理者ダッシュボード:
https://web-production-4ecb0.up.railway.app/admin-dashboard.html

🔗 調査ページ例:
https://web-production-4ecb0.up.railway.app/survey/abc123def456
```

---

## 📋 ステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 400 | 無効なリクエスト |
| 401 | 認証エラー |
| 403 | アクセス権限なし・URL無効化済み |
| 404 | リソースが見つからない |
| 429 | レート制限超過 |
| 500 | サーバーエラー |

---

*最終更新: 2025-08-19*
*🤖 Generated with Claude Code*