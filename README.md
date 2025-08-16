# 従業員満足度調査システム

企業の従業員満足度・期待度を調査・分析するためのWebアプリケーションシステムです。

## 🎯 システム概要

- **調査フロントエンド**: 9ページの詳細な従業員満足度調査
- **管理者ダッシュボード**: リアルタイムでの調査結果分析・可視化
- **バックエンドAPI**: Flask + SQLiteによるデータ管理
- **セキュリティ**: レート制限、データ検証、入力サニタイズ

## 📁 ファイル構成

```
employee-survey-system/
├── index.html              # 調査回答ページ
├── survey-script.js        # 調査用JavaScript
├── survey-style.css        # 調査用スタイル
├── admin-dashboard.html    # 管理者ダッシュボード
├── admin-script.js         # 管理者用JavaScript
├── admin-style.css         # 管理者用スタイル
├── server.py              # Flask APIサーバー
├── start_server.py        # サーバー起動スクリプト
├── requirements.txt       # Python依存関係
└── README.md             # このファイル
```

## 🚀 クイックスタート

### 1. システム起動

```bash
cd /Users/sugayayoshiyuki/Desktop/employee-survey-system
python3 start_server.py
```

### 2. アクセス

- **調査回答**: http://localhost:5000
- **管理者ダッシュボード**: http://localhost:5000/admin-dashboard.html

## 📊 主要機能

### 🔍 調査機能
- **9カテゴリの詳細調査**: 勤務時間、仕事量、職場環境など
- **満足度・期待度の両方を測定**: 5段階評価システム
- **プログレスバー**: 回答進捗の可視化
- **自動保存**: 途中まで回答した内容を一時保存
- **レスポンシブデザイン**: PC・タブレット・スマホ対応

### 📈 管理者ダッシュボード
- **KPIサマリー**: 総回答数、完了率、平均満足度、NPS
- **満足度分布**: ドーナツチャートでの可視化
- **回答トレンド**: 時系列での回答数推移
- **部署別分析**: 部門ごとの満足度比較
- **リアルタイム更新**: APIからのライブデータ取得

### 🔒 セキュリティ機能
- **レート制限**: API乱用防止
- **データ検証**: 入力値の妥当性チェック
- **入力サニタイズ**: XSS攻撃防止
- **ファイルサイズ制限**: DoS攻撃防止

### 📥 データエクスポート
- **CSV形式**: Excel で開ける形式でエクスポート
- **完全データ**: 全回答データの一括ダウンロード
- **フィルタリング**: 部署・役職別でのデータ絞り込み

## 🛠️ 技術仕様

### フロントエンド
- **HTML5/CSS3/JavaScript**: モダンWeb技術
- **Chart.js**: データ可視化ライブラリ
- **Fetch API**: 非同期通信

### バックエンド
- **Flask 2.3.3**: Pythonウェブフレームワーク
- **SQLite**: 軽量データベース
- **Flask-CORS**: クロスオリジン対応

### データベース設計
```sql
-- 調査回答テーブル
survey_responses (
    id TEXT PRIMARY KEY,
    submission_time TEXT,
    user_agent TEXT,
    page_load_time INTEGER,
    response_data TEXT,
    created_at TIMESTAMP
)

-- 統計データテーブル
survey_statistics (
    id INTEGER PRIMARY KEY,
    total_responses INTEGER,
    completion_rate REAL,
    avg_satisfaction REAL,
    nps_score REAL,
    last_updated TIMESTAMP
)
```

## 📊 API エンドポイント

| メソッド | エンドポイント | 説明 |
|---------|-------------|------|
| POST | `/api/submit` | 調査回答の保存 |
| GET | `/api/statistics` | 統計データ取得 |
| GET | `/api/responses` | 全回答データ取得 |
| GET | `/api/export` | CSV形式でエクスポート |

## 🔧 開発者向け情報

### ローカル開発環境

```bash
# 依存関係のインストール
pip3 install -r requirements.txt

# 開発サーバー起動
python3 server.py
```

### データベースの初期化
サーバー初回起動時に自動的にSQLiteデータベースが作成されます。

### ログ確認
```bash
# サーバーログ
tail -f server.log

# アクセスログ
tail -f access.log
```

## 📈 今後の拡張予定

### 機能追加
- [ ] 管理者認証システム
- [ ] 通知機能（Slack/Email）
- [ ] PDFレポート生成
- [ ] 多言語対応
- [ ] モバイルアプリ

### 分析機能
- [ ] 統計的有意性検定
- [ ] 予測分析（満足度トレンド）
- [ ] テキストマイニング
- [ ] セグメント分析

### インフラ
- [ ] Docker化
- [ ] PostgreSQL対応
- [ ] Redis キャッシュ
- [ ] 負荷分散

## 🤝 サポート

システムの使用方法や機能追加のご要望がございましたら、お気軽にお声がけください。

## 📄 ライセンス

このプロジェクトは個人使用・社内使用を目的として作成されています。

---

**作成日**: 2025年8月16日  
**最終更新**: 2025年8月16日  
**バージョン**: 2.0.0