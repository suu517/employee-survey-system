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

# データベース設定
DATABASE_PATH = 'survey_database.db'

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
    
    # デモデータの挿入（初回のみ）
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM survey_responses')
    count = cursor.fetchone()[0]
    conn.close()
    
    if count == 0:
        logger.info("デモデータを挿入しています...")
        try:
            import demo_data
            demo_data.insert_demo_data()
            logger.info("✅ デモデータの挿入が完了しました")
        except ImportError:
            logger.warning("demo_data.pyが見つかりません。デモデータの挿入をスキップします。")
        except Exception as e:
            logger.warning(f"デモデータの挿入に失敗しました: {e}")

# アプリケーション起動時にデータベースを初期化
try:
    init_database()
except Exception as e:
    logger.error(f"データベース初期化エラー: {e}")

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

# ====================
# 運営者管理用APIエンドポイント
# ====================

# 運営者認証チェック（簡易版）
def require_operator_auth(f):
    """運営者認証が必要なエンドポイントのデコレータ"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 本格実装時にはJWTトークンやセッション認証を使用
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '認証が必要です'}), 401
        
        # 仮の認証チェック（本格実装時に置き換え）
        token = auth_header.split(' ')[1]
        if token != 'operator_demo_token_2025':
            return jsonify({'error': '無効な認証トークンです'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/operator-dashboard.html')
def operator_dashboard():
    """運営者ダッシュボード（認証後）"""
    return send_from_directory('.', 'operator-dashboard.html')

@app.route('/api/operator/overview', methods=['GET'])
@require_operator_auth
def get_operator_overview():
    """運営者向けシステム概要データ"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 総回答数
        cursor.execute('SELECT COUNT(*) FROM survey_responses')
        total_responses = cursor.fetchone()[0]
        
        # アクティブなトークン数
        cursor.execute('SELECT COUNT(*) FROM survey_tokens WHERE is_active = 1')
        active_surveys = cursor.fetchone()[0]
        
        # 過去30日の回答トレンド
        cursor.execute('''
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM survey_responses 
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 30
        ''')
        
        daily_responses = cursor.fetchall()
        
        conn.close()
        
        # サンプルデータで補完
        overview_data = {
            'kpis': {
                'totalCompanies': 127,  # 実装時に企業テーブルから取得
                'totalResponses': total_responses,
                'activeSurveys': active_surveys,
                'monthlyRevenue': 2450000  # 実装時に課金システムから取得
            },
            'usageTrend': {
                'labels': ['30日前', '25日前', '20日前', '15日前', '10日前', '5日前', '今日'],
                'surveys': [12, 19, 15, 25, 22, 30, len(daily_responses)],
                'companies': [2, 3, 1, 4, 2, 5, 3]
            },
            'companySize': {
                'labels': ['小規模(1-50人)', '中規模(51-200人)', '大規模(201-1000人)', '超大規模(1000人以上)'],
                'values': [45, 35, 15, 5]
            },
            'systemStatus': {
                'api': 'online',
                'database': 'online',
                'backup': 'online',
                'load': 'normal'
            }
        }
        
        return jsonify(overview_data)
        
    except Exception as e:
        logger.error(f"運営者概要データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/companies', methods=['GET'])
@require_operator_auth
def get_operator_companies():
    """運営者向け企業一覧データ"""
    try:
        # 実装時には企業管理テーブルから取得
        # 現在はサンプルデータを返す
        companies_data = {
            'companies': [
                {
                    'id': '1',
                    'name': '株式会社テクノソリューション',
                    'industry': 'IT・技術',
                    'size': 150,
                    'plan': 'premium',
                    'responses': 1247,
                    'lastUsed': '2025-08-16',
                    'status': 'active'
                },
                {
                    'id': '2',
                    'name': 'グローバル製造業株式会社',
                    'industry': '製造業',
                    'size': 3200,
                    'plan': 'enterprise',
                    'responses': 2890,
                    'lastUsed': '2025-08-15',
                    'status': 'active'
                },
                {
                    'id': '3',
                    'name': 'フィナンシャルサービス',
                    'industry': '金融',
                    'size': 850,
                    'plan': 'premium',
                    'responses': 654,
                    'lastUsed': '2025-08-10',
                    'status': 'active'
                }
            ]
        }
        
        return jsonify(companies_data)
        
    except Exception as e:
        logger.error(f"運営者企業データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/companies', methods=['POST'])
@require_operator_auth
def add_operator_company():
    """運営者向け企業追加"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        # 必須フィールドの確認
        required_fields = ['name', 'industry', 'size', 'plan', 'email']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'必須フィールド "{field}" が不足しています'}), 400
        
        # 実装時には企業管理テーブルに挿入
        company_id = str(uuid.uuid4())
        
        logger.info(f"新規企業を追加しました: {data['name']} (ID: {company_id})")
        
        return jsonify({
            'success': True,
            'company_id': company_id,
            'message': '企業を正常に追加しました'
        })
        
    except Exception as e:
        logger.error(f"企業追加に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/security', methods=['GET'])
@require_operator_auth
def get_operator_security():
    """運営者向けセキュリティ監視データ"""
    try:
        # 実装時にはログ管理システムから取得
        security_data = {
            'alerts': [
                {
                    'id': '1',
                    'level': 'low',
                    'time': '2025-08-17 14:30',
                    'message': '異常なアクセス頻度を検出（警告レベル）'
                }
            ],
            'accessLogs': [
                {
                    'time': '2025-08-17 15:30:45',
                    'ip': '192.168.1.100',
                    'endpoint': '/api/submit',
                    'status': 200,
                    'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                {
                    'time': '2025-08-17 15:30:32',
                    'ip': '10.0.0.50',
                    'endpoint': '/api/statistics',
                    'status': 200,
                    'userAgent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            ]
        }
        
        return jsonify(security_data)
        
    except Exception as e:
        logger.error(f"セキュリティデータの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/analytics', methods=['GET'])
@require_operator_auth
def get_operator_analytics():
    """運営者向け全体分析データ"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 業界別統計の計算（実際のデータがある場合）
        cursor.execute('SELECT COUNT(*) FROM survey_responses')
        total_responses = cursor.fetchone()[0]
        
        conn.close()
        
        # 業界別ベンチマークデータ（サンプル）
        analytics_data = {
            'industryBenchmarks': [
                {'industry': 'IT・技術', 'satisfaction': 3.8, 'responses': 1247, 'nps': 23},
                {'industry': '製造業', 'satisfaction': 3.6, 'responses': 892, 'nps': 18},
                {'industry': '金融', 'satisfaction': 3.5, 'responses': 654, 'nps': 15},
                {'industry': '小売・サービス', 'satisfaction': 3.4, 'responses': 432, 'nps': 12}
            ],
            'satisfactionTrend': {
                'labels': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
                'data': [3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7]
            },
            'totalResponses': total_responses
        }
        
        return jsonify(analytics_data)
        
    except Exception as e:
        logger.error(f"分析データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/settings', methods=['GET'])
@require_operator_auth
def get_operator_settings():
    """運営者向けシステム設定取得"""
    try:
        # 実装時には設定管理テーブルから取得
        settings = {
            'maintenanceMode': False,
            'approvalRequired': True,
            'defaultResponseLimit': 1000,
            'rateLimit': 60,
            'sessionTimeout': 24,
            'force2FA': False,
            'backupInterval': 6,
            'dataRetention': 365
        }
        
        return jsonify(settings)
        
    except Exception as e:
        logger.error(f"設定データの取得に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/settings', methods=['PUT'])
@require_operator_auth
def update_operator_settings():
    """運営者向けシステム設定更新"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        # 実装時には設定管理テーブルを更新
        logger.info(f"システム設定を更新しました: {data}")
        
        return jsonify({
            'success': True,
            'message': '設定を正常に更新しました'
        })
        
    except Exception as e:
        logger.error(f"設定更新に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/operator/backup', methods=['POST'])
@require_operator_auth
def trigger_operator_backup():
    """運営者向けバックアップ実行"""
    try:
        # 実装時には実際のバックアップ処理を実行
        logger.info("手動バックアップを実行しました")
        
        return jsonify({
            'success': True,
            'message': 'バックアップを開始しました',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"バックアップ実行に失敗しました: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

# ====================
# 企業管理用APIエンドポイント
# ====================

# 企業管理用テーブルの初期化
def init_company_tables():
    """企業管理用テーブルの作成"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # 企業アカウントテーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS company_accounts (
            company_id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            access_key TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            max_urls INTEGER DEFAULT 10,
            max_responses_per_url INTEGER DEFAULT 1000
        )
    ''')
    
    # 企業とトークンの関連テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS company_tokens (
            company_id TEXT,
            token TEXT,
            FOREIGN KEY (company_id) REFERENCES company_accounts (company_id),
            FOREIGN KEY (token) REFERENCES survey_tokens (token),
            PRIMARY KEY (company_id, token)
        )
    ''')
    
    # デモ企業アカウントを作成
    cursor.execute('SELECT COUNT(*) FROM company_accounts WHERE company_id = ?', ('demo-company',))
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO company_accounts (company_id, company_name, access_key)
            VALUES (?, ?, ?)
        ''', ('demo-company', 'デモ企業株式会社', 'demo2025'))
    
    conn.commit()
    conn.close()

# 企業管理用テーブル初期化実行
try:
    init_company_tables()
    logger.info("企業管理用テーブルの初期化が完了しました")
except Exception as e:
    logger.error(f"企業管理用テーブル初期化エラー: {e}")

# 企業認証チェック
def require_company_auth(f):
    """企業認証が必要なエンドポイントのデコレータ"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '認証が必要です'}), 401
        
        token = auth_header.split(' ')[1]
        
        # 簡易トークン検証（実際の運用では JWT などを使用）
        if not token.startswith('company_'):
            return jsonify({'error': '無効な認証トークンです'}), 401
        
        # トークンから企業IDを取得（簡易実装）
        try:
            company_id = token.split('_')[1]
            # 企業の存在確認
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT company_id FROM company_accounts WHERE company_id = ? AND is_active = 1', (company_id,))
            if not cursor.fetchone():
                conn.close()
                return jsonify({'error': '無効な認証トークンです'}), 401
            conn.close()
            
            # リクエストに企業IDを追加
            request.company_id = company_id
            
        except (IndexError, ValueError):
            return jsonify({'error': '無効な認証トークンです'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/company-login.html')
def company_login():
    """企業ログインページ"""
    return send_from_directory('.', 'company-login.html')

@app.route('/company-dashboard.html')
def company_dashboard():
    """企業ダッシュボードページ"""
    return send_from_directory('.', 'company-dashboard.html')

@app.route('/api/company/login', methods=['POST'])
def company_login_api():
    """企業ログインAPI"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        company_id = data.get('company_id')
        access_key = data.get('access_key')
        
        if not company_id or not access_key:
            return jsonify({'error': '企業IDとアクセスキーが必要です'}), 400
        
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT company_id, company_name FROM company_accounts 
            WHERE company_id = ? AND access_key = ? AND is_active = 1
        ''', (company_id, access_key))
        
        company = cursor.fetchone()
        conn.close()
        
        if not company:
            return jsonify({'error': 'ログイン情報が正しくありません'}), 401
        
        # 簡易トークン生成（実際の運用では JWT を使用）
        token = f"company_{company_id}_{secrets.token_urlsafe(16)}"
        
        return jsonify({
            'success': True,
            'token': token,
            'company_id': company[0],
            'company_name': company[1]
        })
        
    except Exception as e:
        logger.error(f"企業ログインエラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/summary', methods=['GET'])
@require_company_auth
def get_company_summary():
    """企業管理用サマリーデータ取得"""
    try:
        company_id = request.company_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業のURL数取得
        cursor.execute('''
            SELECT COUNT(*) FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            WHERE ct.company_id = ? AND st.is_active = 1
        ''', (company_id,))
        total_urls = cursor.fetchone()[0]
        
        # 企業の総回答数取得
        cursor.execute('''
            SELECT SUM(st.current_responses) FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            WHERE ct.company_id = ?
        ''', (company_id,))
        result = cursor.fetchone()
        total_responses = result[0] if result[0] else 0
        
        # 平均満足度計算（サンプル）
        avg_satisfaction = 3.7  # 実際の計算は省略
        
        # 完了率計算（サンプル）
        completion_rate = 78.5  # 実際の計算は省略
        
        conn.close()
        
        return jsonify({
            'totalUrls': total_urls,
            'totalResponses': total_responses,
            'avgSatisfaction': avg_satisfaction,
            'completionRate': completion_rate
        })
        
    except Exception as e:
        logger.error(f"企業サマリーデータ取得エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/urls', methods=['GET'])
@require_company_auth
def get_company_urls():
    """企業の調査URL一覧取得"""
    try:
        company_id = request.company_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT st.token, st.created_at, st.expires_at, st.max_responses, 
                   st.current_responses, st.is_active, st.description
            FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            WHERE ct.company_id = ?
            ORDER BY st.created_at DESC
        ''', (company_id,))
        
        urls = []
        for row in cursor.fetchall():
            urls.append({
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
            'urls': urls
        })
        
    except Exception as e:
        logger.error(f"企業URL一覧取得エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/urls', methods=['POST'])
@require_company_auth
def create_company_url():
    """企業用調査URL作成"""
    try:
        company_id = request.company_id
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        description = data.get('description', '')
        max_responses = data.get('max_responses', 50)
        expires_hours = data.get('expires_hours', 720)
        
        # 企業の制限確認
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT max_urls, max_responses_per_url FROM company_accounts 
            WHERE company_id = ?
        ''', (company_id,))
        limits = cursor.fetchone()
        
        if not limits:
            conn.close()
            return jsonify({'error': '企業情報が見つかりません'}), 404
        
        max_urls, max_responses_per_url = limits
        
        # 現在のURL数確認
        cursor.execute('''
            SELECT COUNT(*) FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            WHERE ct.company_id = ? AND st.is_active = 1
        ''', (company_id,))
        current_url_count = cursor.fetchone()[0]
        
        if current_url_count >= max_urls:
            conn.close()
            return jsonify({'error': f'URL作成数の上限（{max_urls}個）に達しています'}), 400
        
        if max_responses > max_responses_per_url:
            max_responses = max_responses_per_url
        
        # トークン生成
        token = secrets.token_urlsafe(32)
        
        # 有効期限計算
        from datetime import datetime, timedelta
        expires_at = datetime.now() + timedelta(hours=expires_hours)
        
        # survey_tokensテーブルに挿入
        cursor.execute('''
            INSERT INTO survey_tokens (token, expires_at, max_responses, description)
            VALUES (?, ?, ?, ?)
        ''', (token, expires_at.isoformat(), max_responses, description))
        
        # company_tokensテーブルに関連付け
        cursor.execute('''
            INSERT INTO company_tokens (company_id, token)
            VALUES (?, ?)
        ''', (company_id, token))
        
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
        logger.error(f"企業URL作成エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/urls/<token>', methods=['DELETE'])
@require_company_auth
def disable_company_url(token):
    """企業用調査URL無効化"""
    try:
        company_id = request.company_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業がこのトークンを所有しているか確認
        cursor.execute('''
            SELECT ct.token FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            WHERE ct.company_id = ? AND ct.token = ?
        ''', (company_id, token))
        
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'URLが見つかりません'}), 404
        
        # URL無効化
        cursor.execute('''
            UPDATE survey_tokens SET is_active = 0 WHERE token = ?
        ''', (token,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'error': 'URLの無効化に失敗しました'}), 400
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"企業URL無効化エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/analytics', methods=['GET'])
@require_company_auth
def get_company_analytics():
    """企業用分析データ取得"""
    try:
        company_id = request.company_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業の回答データから満足度分布を計算（サンプル）
        satisfaction_distribution = [5, 8, 3, 2, 1]  # 実際は計算が必要
        
        # 最近の回答データ（サンプル）
        recent_responses = [
            {
                'timestamp': datetime.now().isoformat(),
                'satisfaction': 4,
                'department': '営業部',
                'position': '主任'
            },
            {
                'timestamp': (datetime.now() - timedelta(hours=2)).isoformat(),
                'satisfaction': 3,
                'department': '開発部',
                'position': '一般社員'
            }
        ]
        
        conn.close()
        
        return jsonify({
            'satisfactionDistribution': satisfaction_distribution,
            'recentResponses': recent_responses
        })
        
    except Exception as e:
        logger.error(f"企業分析データ取得エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/company/export', methods=['GET'])
@require_company_auth
def export_company_data():
    """企業用データエクスポート"""
    try:
        company_id = request.company_id
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業の回答データ取得
        cursor.execute('''
            SELECT sr.response_data, sr.created_at
            FROM company_tokens ct
            JOIN survey_tokens st ON ct.token = st.token
            JOIN survey_responses sr ON sr.survey_token = st.token
            WHERE ct.company_id = ?
            ORDER BY sr.created_at DESC
        ''', (company_id,))
        
        responses = cursor.fetchall()
        
        # CSV生成
        csv_lines = ['回答ID,回答日時,満足度,部署,役職']
        
        for i, (response_data, created_at) in enumerate(responses):
            try:
                data = json.loads(response_data)
                satisfaction = data.get('overall_satisfaction', 'N/A')
                department = data.get('department', 'N/A')
                position = data.get('position', 'N/A')
                
                csv_lines.append(f'{i+1},{created_at},{satisfaction},{department},{position}')
            except json.JSONDecodeError:
                continue
        
        csv_data = '\n'.join(csv_lines)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'csvData': csv_data,
            'count': len(responses)
        })
        
    except Exception as e:
        logger.error(f"企業データエクスポートエラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

# ====================
# 管理者用企業管理APIエンドポイント
# ====================

@app.route('/api/admin/companies', methods=['GET'])
def get_admin_companies():
    """管理者用企業一覧取得"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業一覧と現在のURL数を取得
        cursor.execute('''
            SELECT 
                ca.company_id,
                ca.company_name,
                ca.access_key,
                ca.max_urls,
                ca.max_responses_per_url,
                ca.is_active,
                ca.created_at,
                COUNT(ct.token) as current_urls
            FROM company_accounts ca
            LEFT JOIN company_tokens ct ON ca.company_id = ct.company_id
            LEFT JOIN survey_tokens st ON ct.token = st.token AND st.is_active = 1
            GROUP BY ca.company_id
            ORDER BY ca.created_at DESC
        ''')
        
        companies = []
        for row in cursor.fetchall():
            companies.append({
                'company_id': row[0],
                'company_name': row[1],
                'access_key': row[2],
                'max_urls': row[3],
                'max_responses_per_url': row[4],
                'is_active': bool(row[5]),
                'created_at': row[6],
                'current_urls': row[7]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'companies': companies
        })
        
    except Exception as e:
        logger.error(f"管理者用企業一覧取得エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/admin/companies', methods=['POST'])
def create_admin_company():
    """管理者用企業作成"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        company_id = data.get('company_id', '').strip()
        company_name = data.get('company_name', '').strip()
        access_key = data.get('access_key', '').strip()
        max_urls = data.get('max_urls', 10)
        max_responses_per_url = data.get('max_responses_per_url', 1000)
        
        # バリデーション
        if not company_id or not company_name or not access_key:
            return jsonify({'error': '必須項目が不足しています'}), 400
        
        # 企業ID重複チェック
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        cursor.execute('SELECT company_id FROM company_accounts WHERE company_id = ?', (company_id,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'error': 'この企業IDは既に使用されています'}), 400
        
        # 企業アカウント作成
        cursor.execute('''
            INSERT INTO company_accounts 
            (company_id, company_name, access_key, max_urls, max_responses_per_url)
            VALUES (?, ?, ?, ?, ?)
        ''', (company_id, company_name, access_key, max_urls, max_responses_per_url))
        
        conn.commit()
        conn.close()
        
        logger.info(f"管理者が企業アカウントを作成しました: {company_id}")
        
        return jsonify({
            'success': True,
            'company_id': company_id,
            'message': '企業アカウントを作成しました'
        })
        
    except Exception as e:
        logger.error(f"管理者用企業作成エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/admin/companies/<company_id>', methods=['PUT'])
def update_admin_company(company_id):
    """管理者用企業更新"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': '無効なデータです'}), 400
        
        company_name = data.get('company_name', '').strip()
        access_key = data.get('access_key', '').strip()
        max_urls = data.get('max_urls', 10)
        max_responses_per_url = data.get('max_responses_per_url', 1000)
        is_active = data.get('is_active', True)
        
        if not company_name or not access_key:
            return jsonify({'error': '必須項目が不足しています'}), 400
        
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業存在確認
        cursor.execute('SELECT company_id FROM company_accounts WHERE company_id = ?', (company_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': '企業が見つかりません'}), 404
        
        # 企業情報更新
        cursor.execute('''
            UPDATE company_accounts 
            SET company_name = ?, access_key = ?, max_urls = ?, 
                max_responses_per_url = ?, is_active = ?
            WHERE company_id = ?
        ''', (company_name, access_key, max_urls, max_responses_per_url, is_active, company_id))
        
        conn.commit()
        conn.close()
        
        logger.info(f"管理者が企業情報を更新しました: {company_id}")
        
        return jsonify({
            'success': True,
            'message': '企業情報を更新しました'
        })
        
    except Exception as e:
        logger.error(f"管理者用企業更新エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/api/admin/companies/<company_id>', methods=['DELETE'])
def delete_admin_company(company_id):
    """管理者用企業削除"""
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 企業存在確認
        cursor.execute('SELECT company_id FROM company_accounts WHERE company_id = ?', (company_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': '企業が見つかりません'}), 404
        
        # 関連するトークンと回答を削除
        cursor.execute('''
            DELETE FROM survey_responses 
            WHERE survey_token IN (
                SELECT st.token FROM company_tokens ct 
                JOIN survey_tokens st ON ct.token = st.token 
                WHERE ct.company_id = ?
            )
        ''', (company_id,))
        
        cursor.execute('''
            DELETE FROM survey_tokens 
            WHERE token IN (
                SELECT token FROM company_tokens WHERE company_id = ?
            )
        ''', (company_id,))
        
        cursor.execute('DELETE FROM company_tokens WHERE company_id = ?', (company_id,))
        cursor.execute('DELETE FROM company_accounts WHERE company_id = ?', (company_id,))
        
        conn.commit()
        conn.close()
        
        logger.info(f"管理者が企業を削除しました: {company_id}")
        
        return jsonify({
            'success': True,
            'message': '企業を削除しました'
        })
        
    except Exception as e:
        logger.error(f"管理者用企業削除エラー: {str(e)}")
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

if __name__ == '__main__':
    # 本番環境の設定
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info("従業員満足度調査システム サーバーを起動しています...")
    app.run(debug=debug, host='0.0.0.0', port=port)