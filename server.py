#!/usr/bin/env python3
"""
従業員満足度調査システム - Backend API Server
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import uuid
from datetime import datetime
import os
import logging
import hashlib
import secrets
from functools import wraps

app = Flask(__name__)
CORS(app)

# セキュリティ設定
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB制限

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# セキュリティ関数
def validate_request_data(data):
    """リクエストデータの検証"""
    if not isinstance(data, dict):
        return False, "無効なデータ形式です"
    
    # 必須フィールドの確認
    required_fields = ['submission_time']
    for field in required_fields:
        if field not in data:
            return False, f"必須フィールド '{field}' が不足しています"
    
    # データサイズの制限
    if len(json.dumps(data)) > 100000:  # 100KB制限
        return False, "データサイズが大きすぎます"
    
    return True, "OK"

def rate_limit_check(client_ip):
    """レート制限チェック（簡易版）"""
    # 実際の実装では Redis や メモリ内カウンタを使用
    # ここでは基本的な実装のみ
    return True

def sanitize_input(text):
    """入力値のサニタイズ"""
    if not isinstance(text, str):
        return str(text)
    
    # HTMLタグの除去など基本的なサニタイズ
    import re
    text = re.sub(r'<[^>]+>', '', text)
    return text[:1000]  # 最大1000文字に制限

# データベース設定
DATABASE_PATH = 'survey_database.db'

def init_database():
    """データベースの初期化"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # 調査回答テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS survey_responses (
            id TEXT PRIMARY KEY,
            submission_time TEXT NOT NULL,
            user_agent TEXT,
            page_load_time INTEGER,
            response_data TEXT NOT NULL,
            survey_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 調査URL管理テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS survey_tokens (
            token TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            max_responses INTEGER DEFAULT 1,
            current_responses INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            description TEXT
        )
    ''')
    
    # 自由記述回答テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS free_text_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            response_id TEXT NOT NULL,
            question_type TEXT NOT NULL,
            question_label TEXT,
            response_text TEXT NOT NULL,
            character_count INTEGER,
            response_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (response_id) REFERENCES survey_responses (id)
        )
    ''')
    
    # 管理者用統計テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS survey_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_responses INTEGER DEFAULT 0,
            completion_rate REAL DEFAULT 0.0,
            avg_satisfaction REAL DEFAULT 0.0,
            nps_score REAL DEFAULT 0.0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 初期統計データの挿入
    cursor.execute('SELECT COUNT(*) FROM survey_statistics')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO survey_statistics (total_responses, completion_rate, avg_satisfaction, nps_score)
            VALUES (0, 0.0, 0.0, 0.0)
        ''')
    
    conn.commit()
    conn.close()
    logger.info("データベースの初期化が完了しました")

@app.route('/')
def index():
    """デモトップページ"""
    return send_from_directory('.', 'demo.html')

@app.route('/survey')
def survey():
    """調査ページ"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_files(filename):
    """静的ファイルの配信"""
    return send_from_directory('.', filename)

@app.route('/api/submit', methods=['POST'])
def submit_survey():
    """調査回答の保存"""
    try:
        # レート制限チェック
        client_ip = request.remote_addr
        if not rate_limit_check(client_ip):
            logger.warning(f"レート制限違反: {client_ip}")
            return jsonify({'error': 'レート制限に達しました'}), 429
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        # データ検証
        is_valid, error_message = validate_request_data(data)
        if not is_valid:
            logger.warning(f"無効なデータ送信: {error_message}")
            return jsonify({'error': error_message}), 400
        
        # 入力値のサニタイズ
        if 'user_agent' in data:
            data['user_agent'] = sanitize_input(data['user_agent'])
        
        # 一意のIDを生成
        response_id = str(uuid.uuid4())
        
        # データベースに保存
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # トークンの検証と回答数更新
        survey_token = data.get('survey_token')
        if survey_token:
            cursor.execute('''
                SELECT current_responses, max_responses FROM survey_tokens 
                WHERE token = ? AND is_active = 1
            ''', (survey_token,))
            token_info = cursor.fetchone()
            
            if not token_info:
                conn.close()
                return jsonify({'error': '無効なトークンです'}), 400
                
            current_responses, max_responses = token_info
            if current_responses >= max_responses:
                conn.close()
                return jsonify({'error': '回答数上限に達しています'}), 400
        
        cursor.execute('''
            INSERT INTO survey_responses 
            (id, submission_time, user_agent, page_load_time, response_data, survey_token)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            response_id,
            data.get('submission_time'),
            data.get('user_agent'),
            data.get('page_load_time'),
            json.dumps(data),
            survey_token
        ))
        
        # トークンの回答数を更新
        if survey_token:
            cursor.execute('''
                UPDATE survey_tokens 
                SET current_responses = current_responses + 1
                WHERE token = ?
            ''', (survey_token,))
        
        # 自由記述回答を別テーブルに保存
        free_text_fields = {
            'most_satisfied': '最も満足度が高い項目について',
            'least_satisfied': '最も満足度が低い項目について', 
            'most_expected': '最も期待度が高い項目について',
            'other_comments': 'その他ご意見・ご要望'
        }
        
        for field_name, label in free_text_fields.items():
            if field_name in data and data[field_name]:
                response_text = data[field_name]
                character_count = len(response_text)
                
                cursor.execute('''
                    INSERT INTO free_text_responses 
                    (response_id, question_type, question_label, response_text, character_count)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    response_id,
                    field_name,
                    label,
                    response_text,
                    character_count
                ))
        
        conn.commit()
        conn.close()
        
        # 統計データを更新
        update_statistics()
        
        logger.info(f"調査回答を保存しました: {response_id}")
        
        return jsonify({
            'success': True,
            'response_id': response_id,
            'message': '調査回答を正常に保存しました'
        })
        
    except Exception as e:
        logger.error(f"調査回答の保存に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """管理者ダッシュボード用の統計データ取得"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 基本統計
        cursor.execute('SELECT COUNT(*) FROM survey_responses')
        total_responses = cursor.fetchone()[0]
        
        # 満足度の計算
        cursor.execute('SELECT response_data FROM survey_responses')
        responses = cursor.fetchall()
        
        satisfaction_scores = []
        nps_scores = []
        
        for response in responses:
            try:
                data = json.loads(response[0])
                
                # 総合満足度の計算
                overall_satisfaction = data.get('overall_satisfaction')
                if overall_satisfaction:
                    score = get_satisfaction_score(overall_satisfaction)
                    if score:
                        satisfaction_scores.append(score)
                
                # NPS計算用の推奨度
                recommendation = data.get('recommendation')
                if recommendation:
                    nps_score = get_nps_score(recommendation)
                    if nps_score is not None:
                        nps_scores.append(nps_score)
                        
            except json.JSONDecodeError:
                continue
        
        # 平均値の計算
        avg_satisfaction = sum(satisfaction_scores) / len(satisfaction_scores) if satisfaction_scores else 0
        
        # NPSの計算
        nps = calculate_nps(nps_scores) if nps_scores else 0
        
        # 完了率（仮の値）
        completion_rate = 87.5
        
        # 部署別データ（サンプル）
        department_data = get_department_statistics()
        
        # カテゴリ別満足度
        category_satisfaction = get_category_satisfaction(responses)
        
        statistics = {
            'total_responses': total_responses,
            'completion_rate': completion_rate,
            'avg_satisfaction': round(avg_satisfaction, 2),
            'nps_score': round(nps, 1),
            'department_data': department_data,
            'category_satisfaction': category_satisfaction,
            'satisfaction_distribution': get_satisfaction_distribution(satisfaction_scores),
            'response_trend': get_response_trend()
        }
        
        conn.close()
        
        return jsonify(statistics)
        
    except Exception as e:
        logger.error(f"統計データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/responses', methods=['GET'])
def get_responses():
    """全回答データの取得（管理者用）"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, submission_time, response_data, created_at 
            FROM survey_responses 
            ORDER BY created_at DESC
        ''')
        
        responses = []
        for row in cursor.fetchall():
            try:
                response_data = json.loads(row[2])
                responses.append({
                    'id': row[0],
                    'submission_time': row[1],
                    'data': response_data,
                    'created_at': row[3]
                })
            except json.JSONDecodeError:
                continue
        
        conn.close()
        
        return jsonify(responses)
        
    except Exception as e:
        logger.error(f"回答データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/free-text-analysis', methods=['GET'])
def get_free_text_analysis():
    """自由記述回答の分析データ取得"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 自由記述回答の統計
        cursor.execute('''
            SELECT 
                question_type,
                question_label,
                COUNT(*) as response_count,
                AVG(character_count) as avg_length,
                MIN(character_count) as min_length,
                MAX(character_count) as max_length
            FROM free_text_responses 
            GROUP BY question_type, question_label
            ORDER BY response_count DESC
        ''')
        
        stats = []
        for row in cursor.fetchall():
            stats.append({
                'question_type': row[0],
                'question_label': row[1],
                'response_count': row[2],
                'avg_length': round(row[3], 1) if row[3] else 0,
                'min_length': row[4],
                'max_length': row[5]
            })
        
        # 最新の自由記述回答
        cursor.execute('''
            SELECT response_text, character_count, response_time, question_label
            FROM free_text_responses 
            ORDER BY response_time DESC 
            LIMIT 10
        ''')
        
        recent_responses = []
        for row in cursor.fetchall():
            recent_responses.append({
                'text': row[0][:200] + '...' if len(row[0]) > 200 else row[0],
                'length': row[1],
                'time': row[2],
                'question': row[3]
            })
        
        conn.close()
        
        return jsonify({
            'statistics': stats,
            'recent_responses': recent_responses
        })
        
    except Exception as e:
        logger.error(f"自由記述分析データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/tokens', methods=['POST'])
def create_survey_token():
    """調査URLトークンの作成"""
    try:
        data = request.get_json()
        max_responses = data.get('max_responses', 1)
        description = data.get('description', '')
        expires_hours = data.get('expires_hours', 24)
        
        # トークン生成
        token = secrets.token_urlsafe(32)
        
        # 有効期限計算
        from datetime import datetime, timedelta
        expires_at = datetime.now() + timedelta(hours=expires_hours)
        
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO survey_tokens (token, expires_at, max_responses, description)
            VALUES (?, ?, ?, ?)
        ''', (token, expires_at.isoformat(), max_responses, description))
        
        conn.commit()
        conn.close()
        
        survey_url = f"/survey/{token}"
        
        return jsonify({
            'success': True,
            'token': token,
            'survey_url': survey_url,
            'max_responses': max_responses,
            'expires_at': expires_at.isoformat()
        })
        
    except Exception as e:
        logger.error(f"トークン作成に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/tokens', methods=['GET'])
def get_survey_tokens():
    """調査URLトークン一覧取得"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT token, created_at, expires_at, max_responses, current_responses, is_active, description
            FROM survey_tokens ORDER BY created_at DESC
        ''')
        
        tokens = []
        for row in cursor.fetchall():
            tokens.append({
                'token': row[0],
                'created_at': row[1],
                'expires_at': row[2],
                'max_responses': row[3],
                'current_responses': row[4],
                'is_active': bool(row[5]),
                'description': row[6]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'tokens': tokens
        })
        
    except Exception as e:
        logger.error(f"トークン一覧取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/survey/<token>')
def survey_with_token(token):
    """トークン付き調査ページ"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # トークンの検証
        cursor.execute('''
            SELECT expires_at, max_responses, current_responses, is_active
            FROM survey_tokens WHERE token = ?
        ''', (token,))
        
        token_data = cursor.fetchone()
        conn.close()
        
        if not token_data:
            return "無効なURLです", 404
            
        expires_at, max_responses, current_responses, is_active = token_data
        
        # 有効性チェック
        from datetime import datetime
        if not is_active:
            return "このURLは無効化されています", 403
            
        if datetime.now() > datetime.fromisoformat(expires_at):
            return "このURLは有効期限が切れています", 403
            
        if current_responses >= max_responses:
            return "回答数上限に達しています", 403
        
        # index.htmlを読み込んでトークンを埋め込み
        with open('index.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        # トークンをJavaScriptに埋め込み
        html_content = html_content.replace(
            '<body>',
            f'<body><script>window.SURVEY_TOKEN = "{token}";</script>'
        )
        
        return html_content
        
    except Exception as e:
        logger.error(f"トークン付き調査ページの表示に失敗しました: {str(e)}")
        return "サーバーエラーが発生しました", 500

@app.route('/api/tokens/<token>', methods=['DELETE'])
def disable_survey_token(token):
    """調査URLトークンの無効化"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE survey_tokens SET is_active = 0 WHERE token = ?
        ''', (token,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'トークンが見つかりません'}), 404
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"トークン無効化に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    """データのエクスポート（CSV形式）"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM survey_responses ORDER BY created_at DESC')
        responses = cursor.fetchall()
        
        # CSVデータの生成
        csv_data = generate_csv_export(responses)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': csv_data,
            'count': len(responses)
        })
        
    except Exception as e:
        logger.error(f"データエクスポートに失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

def get_satisfaction_score(value):
    """満足度の数値変換"""
    score_map = {
        'very_satisfied': 5,
        'satisfied': 4, 
        'neutral': 3,
        'dissatisfied': 2,
        'very_dissatisfied': 1
    }
    return score_map.get(value)

def get_nps_score(value):
    """NPS用の数値変換"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

def calculate_nps(scores):
    """NPS計算"""
    if not scores:
        return 0
    
    promoters = len([s for s in scores if s >= 9])
    detractors = len([s for s in scores if s <= 6])
    total = len(scores)
    
    return ((promoters - detractors) / total) * 100

def get_department_statistics():
    """部署別統計（サンプルデータ）"""
    return [
        {'department': '営業部', 'satisfaction': 3.8, 'responses': 25},
        {'department': 'エンジニアリング部', 'satisfaction': 4.1, 'responses': 18},
        {'department': 'マーケティング部', 'satisfaction': 3.5, 'responses': 12},
        {'department': '人事部', 'satisfaction': 4.0, 'responses': 8},
        {'department': '経理部', 'satisfaction': 3.7, 'responses': 6}
    ]

def get_category_satisfaction(responses):
    """カテゴリ別満足度の計算"""
    categories = {
        'work_hours': '勤務時間',
        'workload': '仕事量',
        'work_content': '仕事内容',
        'holidays': '休日休暇',
        'work_system': '勤務体系',
        'promotion': '昇給昇格',
        'relationships': '人間関係',
        'environment': '働く環境',
        'growth': '成長実感',
        'goals': '目標・ノルマ',
        'career': '将来キャリア',
        'benefits': '福利厚生',
        'training': '教育研修',
        'evaluation': '評価制度',
        'culture': '社風・文化'
    }
    
    # 実際のデータから計算する実装をここに追加
    # 現在はサンプルデータを返す
    return [
        {'category': '働く環境', 'satisfaction': 4.2, 'expectation': 4.5},
        {'category': '人間関係', 'satisfaction': 4.0, 'expectation': 4.3},
        {'category': '成長実感', 'satisfaction': 3.8, 'expectation': 4.6},
        {'category': '仕事内容', 'satisfaction': 3.7, 'expectation': 4.1},
        {'category': '福利厚生', 'satisfaction': 3.5, 'expectation': 4.4}
    ]

def get_satisfaction_distribution(scores):
    """満足度分布の計算"""
    if not scores:
        return [0, 0, 0, 0, 0]
    
    distribution = [0, 0, 0, 0, 0]
    for score in scores:
        if 1 <= score <= 5:
            distribution[score - 1] += 1
    
    return distribution

def get_response_trend():
    """回答トレンド（過去7日間）"""
    # 実際の実装では過去7日間のデータを取得
    return [2, 5, 3, 8, 6, 4, 7]

def generate_csv_export(responses):
    """CSV形式でのデータ生成"""
    csv_lines = ['ID,送信時刻,回答データ,作成日時']
    
    for response in responses:
        csv_lines.append(f'"{response[0]}","{response[1]}","{response[3]}","{response[4]}"')
    
    return '\n'.join(csv_lines)

def update_statistics():
    """統計データの更新"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 統計の再計算と更新
        cursor.execute('SELECT COUNT(*) FROM survey_responses')
        total_responses = cursor.fetchone()[0]
        
        cursor.execute('''
            UPDATE survey_statistics 
            SET total_responses = ?, last_updated = CURRENT_TIMESTAMP
            WHERE id = 1
        ''', (total_responses,))
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.error(f"統計データの更新に失敗しました: {str(e)}")

if __name__ == '__main__':
    # データベースの初期化
    init_database()
    
    # デモデータの挿入（初回のみ）
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM survey_responses')
    count = cursor.fetchone()[0]
    conn.close()
    
    if count == 0:
        logger.info("デモデータを挿入しています...")
        try:
            from demo_data import insert_demo_data
            insert_demo_data()
            logger.info("✅ デモデータの挿入が完了しました")
        except Exception as e:
            logger.warning(f"デモデータの挿入に失敗しました: {e}")
    
    # 本番環境の設定
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info("従業員満足度調査システム サーバーを起動しています...")
    app.run(debug=debug, host='0.0.0.0', port=port)