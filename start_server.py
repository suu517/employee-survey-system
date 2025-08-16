#!/usr/bin/env python3
"""
従業員満足度調査システム スタートアップスクリプト
"""

import subprocess
import sys
import os
import time

def check_requirements():
    """必要なパッケージの確認とインストール"""
    try:
        import flask
        import flask_cors
        print("✅ 必要なパッケージが既にインストールされています")
    except ImportError:
        print("📦 必要なパッケージをインストール中...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

def start_server():
    """サーバーの起動"""
    try:
        print("🚀 従業員満足度調査システムを起動しています...")
        print("📊 管理者ダッシュボード: http://localhost:5000/admin-dashboard.html")
        print("📝 調査回答ページ: http://localhost:5000")
        print("⏹️  終了するには Ctrl+C を押してください")
        print("-" * 60)
        
        # サーバー起動
        subprocess.run([sys.executable, "server.py"])
        
    except KeyboardInterrupt:
        print("\n✅ サーバーを停止しました")
    except Exception as e:
        print(f"❌ エラーが発生しました: {e}")

if __name__ == "__main__":
    # 現在のディレクトリにserver.pyがあるかチェック
    if not os.path.exists("server.py"):
        print("❌ server.py が見つかりません。正しいディレクトリで実行してください。")
        sys.exit(1)
    
    # 依存関係のチェック
    check_requirements()
    
    # サーバー起動
    start_server()