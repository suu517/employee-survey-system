# 🚂 Railway.app デプロイ手順

## 📋 事前準備完了
- ✅ Git初期化済み
- ✅ 必要ファイル準備済み
- ✅ デモデータ自動生成設定済み

## 🚀 デプロイ手順

### Step 1: GitHubアカウント準備
1. GitHub (https://github.com) にログイン
2. 新規リポジトリ作成

### Step 2: コードをGitHubにプッシュ

#### ターミナルで以下を実行:
```bash
cd /Users/sugayayoshiyuki/Desktop/employee-survey-system

# GitHubリモートリポジトリを追加（リポジトリ作成後に表示されるURL）
git remote add origin https://github.com/USERNAME/employee-survey-system.git

# コードをプッシュ
git branch -M main
git push -u origin main
```

### Step 3: Railway.appでデプロイ

1. **Railway.app にアクセス**
   - https://railway.app
   - 「Start a New Project」をクリック

2. **GitHubアカウントで認証**
   - 「Login with GitHub」
   - Railway.appにGitHubアクセス許可

3. **リポジトリを選択**
   - 「Deploy from GitHub repo」
   - 「employee-survey-system」を選択

4. **自動デプロイ開始**
   - Railway.appが自動的に検出
   - Python環境セットアップ
   - 依存関係インストール
   - デプロイ実行（3-5分）

5. **ドメイン設定**
   - Settings → Domains
   - 「Generate Domain」クリック
   - URLが自動生成される

### Step 4: デプロイ完了確認

**生成されるURL例:**
```
https://employee-survey-system-production-xxxx.up.railway.app
```

**確認項目:**
- [ ] トップページ表示（デモサイト）
- [ ] 調査画面動作（/index.html）
- [ ] 管理者ダッシュボード（/admin-dashboard.html）
- [ ] 30件のサンプルデータ表示

## 📧 顧客への案内例

```
件名: 【デモサイト公開】従業員満足度調査システム - 実際にお試しください

○○会社 ○○様

従業員満足度調査システムのデモサイトを公開いたしました。

🌐 デモサイト
https://employee-survey-system-production-xxxx.up.railway.app

📊 管理者ダッシュボード（サンプルデータ30件表示）
https://employee-survey-system-production-xxxx.up.railway.app/admin-dashboard.html

📝 調査回答体験
https://employee-survey-system-production-xxxx.up.railway.app/index.html

【特別価格】100名規模：150,000円（70%OFF）
通常価格500,000円 → テストモニター価格150,000円

ぜひ実際に操作していただき、ご検討ください。
無料相談も承っております。

お問い合わせ：info@hr-analytics.jp
```

## 🔧 トラブルシューティング

### デプロイが失敗した場合
1. Railway.appのログを確認
2. requirements.txtの依存関係チェック
3. Procfileの設定確認

### データベースが空の場合
- 初回アクセス時に自動でデモデータが挿入される
- `/admin-dashboard.html`で30件の回答データを確認

## 🎯 デプロイ後のアクション

1. **URL動作確認** ✅
2. **営業資料にURL追加** 📧
3. **顧客への案内送付** 🎯
4. **無料相談の予約受付** 📞

---
**準備完了！あとはGitHubにプッシュ → Railway.appでデプロイするだけです！**