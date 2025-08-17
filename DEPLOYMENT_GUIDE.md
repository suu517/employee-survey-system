# 🚀 デモ用クラウドデプロイメントガイド

## ✅ デプロイ準備完了

テスト販売用のデモ環境が準備完了しました！

### 📋 デプロイ方法（3つの選択肢）

## 🌟 Option 1: Railway.app（推奨・最速）

### 1. Railway.appでのデプロイ
```bash
# 1. Railway.app にアクセス
https://railway.app

# 2. GitHubアカウントでサインアップ/ログイン

# 3. "Deploy from GitHub repo" を選択
# 4. この employee-survey-system フォルダをアップロード

# 5. 自動デプロイ開始（約3-5分で完了）
```

### 2. 取得できるURL例
```
https://employee-survey-system-production.up.railway.app
```

## 🔥 Option 2: Heroku

### 1. Heroku CLIインストール
```bash
# macOS
brew install heroku/brew/heroku

# Windows
# https://devcenter.heroku.com/articles/heroku-cli からダウンロード
```

### 2. デプロイコマンド
```bash
cd /Users/sugayayoshiyuki/Desktop/employee-survey-system

# Heroku ログイン
heroku login

# アプリ作成
heroku create your-survey-demo

# デプロイ
git push heroku master

# URL取得
heroku open
```

## ⚡ Option 3: Vercel（フロントエンドのみ）

### 1. Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

## 🎯 デプロイ後の確認事項

### ✅ チェックリスト
- [ ] デモトップページが表示される（/）
- [ ] 調査画面が動作する（/index.html）
- [ ] 管理者ダッシュボードでデータ表示（/admin-dashboard.html）
- [ ] 30件のサンプルデータが表示される
- [ ] CSV エクスポートが動作する

### 🔗 取得できるURL構成
```
https://your-domain.com/                 # デモトップページ
https://your-domain.com/index.html       # 調査回答画面
https://your-domain.com/admin-dashboard.html # 管理者ダッシュボード
```

## 💼 テスト販売での活用方法

### 📧 顧客への送付内容
```
件名: 【限定デモ公開】従業員満足度調査システム - 70%OFF特別価格

〇〇会社 〇〇様

お世話になっております。

従業員満足度調査システムのデモサイトをご用意いたしました。

🌐 デモサイト: https://your-domain.com
📊 管理者画面: https://your-domain.com/admin-dashboard.html
📝 調査体験: https://your-domain.com/index.html

【特別価格】100名規模：150,000円（通常500,000円の70%OFF）

ぜひ実際に触っていただき、ご検討ください。
無料相談も承っております。

お問い合わせ：info@hr-analytics.jp
```

## 🛡️ セキュリティ設定

### 本格運用時の追加設定
```python
# server.py に追加
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = 1800
```

## 📊 デモデータ仕様

### 🎲 自動生成される内容
- **30件のサンプル回答**
- **6部署 × 5役職の組み合わせ**
- **15カテゴリの満足度・期待度データ**
- **100件以上の自由記述回答**
- **リアルな統計データ**

### 📈 表示される指標
- 総回答数: 30件
- 回答完了率: 87%
- 平均満足度: 3.7/5.0
- eNPSスコア: +23

## 🎯 次のアクション

1. **Railway.app でデプロイ** →  URL取得
2. **営業資料にURL追加** → 顧客送付
3. **無料相談の予約受付** → 案件化
4. **成功事例の蓄積** → サービス拡大

---

**🚀 準備完了！あとはデプロイするだけです！**