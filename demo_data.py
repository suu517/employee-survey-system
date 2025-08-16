#!/usr/bin/env python3
"""
デモ用サンプルデータの生成
"""

import json
import sqlite3
import uuid
from datetime import datetime, timedelta
import random

def generate_demo_data():
    """デモ用のサンプル回答データを生成"""
    
    departments = ['営業部', 'エンジニアリング部', 'マーケティング部', '人事部', '経理部', '企画部']
    positions = ['ジュニア', 'ミッド', 'シニア', 'マネージャー', 'ディレクター']
    
    # 満足度・期待度の項目
    satisfaction_items = [
        'work_hours_satisfaction', 'workload_satisfaction', 'work_content_satisfaction',
        'holidays_satisfaction', 'work_system_satisfaction', 'salary_satisfaction',
        'relationships_satisfaction', 'environment_satisfaction', 'growth_satisfaction',
        'goals_satisfaction', 'career_satisfaction', 'benefits_satisfaction',
        'training_satisfaction', 'evaluation_satisfaction', 'culture_satisfaction'
    ]
    
    expectation_items = [item.replace('_satisfaction', '_expectation') for item in satisfaction_items]
    
    satisfaction_values = [
        '満足していない', 'どちらかと言えば満足していない', 'どちらとも言えない',
        'どちらかと言えば満足している', '満足している'
    ]
    
    expectation_values = [
        '今の会社には期待していない', '今の会社にはどちらかと言えば期待していない',
        'どちらとも言えない', '今の会社にはどちらかと言えば期待している',
        '今の会社には期待している'
    ]
    
    income_ranges = [
        '300万円未満', '300万円以上400万円未満', '400万円以上500万円未満',
        '500万円以上600万円未満', '600万円以上700万円未満', '700万円以上800万円未満',
        '800万円以上900万円未満', '900万円以上1000万円未満', '1000万円以上'
    ]
    
    # 自由記述のサンプル
    sample_comments = {
        'most_satisfied': [
            'チームワークが良く、困った時にすぐに助けてもらえる環境があります。上司も部下の意見をしっかり聞いてくれるので、やりがいを感じています。',
            'リモートワークとオフィス勤務を自由に選べるのが本当に助かっています。子育てとの両立ができて、ストレスが大幅に減りました。',
            '新しい技術を学ぶ機会が多く、会社も研修費用をサポートしてくれます。自分のスキルアップに投資してくれる会社だと感じています。',
            '給与水準が業界平均より高く、成果に応じて適正に評価してもらえています。頑張った分がしっかり還元される制度があります。'
        ],
        'least_satisfied': [
            '残業時間が多く、プライベートとのバランスが取りにくいです。特に繁忙期は家族との時間が全く取れません。',
            '評価制度が不透明で、何を頑張れば昇進できるのかがわかりません。もっと明確な基準を示してほしいです。',
            'オフィス環境が古く、特にエアコンや照明などの設備が不十分です。快適に働ける環境整備をお願いしたいです。',
            '同じような業務の繰り返しで、成長を感じられません。新しいチャレンジができる機会を増やしてほしいです。'
        ],
        'most_expected': [
            'デジタル化の推進により、もっと効率的に業務ができるようになることを期待しています。AIやツールの活用で生産性向上を。',
            '在宅勤務制度の拡充で、もっと柔軟な働き方ができるようになってほしいです。週3日在宅などの選択肢があると嬉しいです。',
            '管理職向けの研修制度を充実させて、マネジメントスキルの向上を図ってほしいです。チーム運営がもっと上手くなりたいです。',
            '福利厚生の拡充、特に健康管理や家族サポートの制度を期待しています。長く働き続けられる環境作りをお願いします。'
        ],
        'other_comments': [
            '全体的には良い会社だと思います。今後も従業員の声を聞いて、より良い職場環境作りを続けてください。',
            'コミュニケーションツールの改善をお願いします。情報共有がもっとスムーズになれば効率が上がると思います。',
            '若手の意見も積極的に取り入れてもらえる風土があり、とても働きやすいです。この文化を大切にしてほしいです。',
            ''  # 空の回答も含める
        ]
    }
    
    demo_responses = []
    
    # 30件のサンプル回答を生成
    for i in range(30):
        response_id = str(uuid.uuid4())
        
        # 基本情報
        response_data = {
            'department': random.choice(departments),
            'position': random.choice(positions),
            'annual_income': random.choice(income_ranges),
            'years_of_service': f"{random.randint(1, 15)}年",
            'employment_type': random.choice(['正社員', '契約社員']),
            'age_group': random.choice(['20代', '30代', '40代', '50代']),
            'overall_satisfaction': random.choice(satisfaction_values),
            'recommendation': str(random.randint(1, 10))
        }
        
        # 満足度評価
        for item in satisfaction_items:
            response_data[item] = random.choice(satisfaction_values)
        
        # 期待度評価
        for item in expectation_items:
            response_data[item] = random.choice(expectation_values)
        
        # 自由記述
        response_data['most_satisfied'] = random.choice(sample_comments['most_satisfied'])
        response_data['least_satisfied'] = random.choice(sample_comments['least_satisfied'])
        response_data['most_expected'] = random.choice(sample_comments['most_expected'])
        response_data['other_comments'] = random.choice(sample_comments['other_comments'])
        
        # タイムスタンプ
        base_time = datetime.now() - timedelta(days=random.randint(1, 30))
        response_data['submission_time'] = base_time.isoformat()
        response_data['response_start_time'] = (base_time - timedelta(minutes=random.randint(15, 45))).isoformat()
        response_data['response_duration'] = random.randint(900000, 2700000)  # 15-45分
        response_data['user_agent'] = 'Mozilla/5.0 (Demo Browser)'
        response_data['page_load_time'] = random.randint(1000, 3000)
        
        demo_responses.append({
            'id': response_id,
            'submission_time': response_data['submission_time'],
            'user_agent': response_data['user_agent'],
            'page_load_time': response_data['page_load_time'],
            'response_data': json.dumps(response_data, ensure_ascii=False)
        })
    
    return demo_responses

def insert_demo_data():
    """データベースにデモデータを挿入"""
    conn = sqlite3.connect('survey_database.db')
    cursor = conn.cursor()
    
    demo_responses = generate_demo_data()
    
    for response in demo_responses:
        # メイン回答テーブルに挿入
        cursor.execute('''
            INSERT INTO survey_responses 
            (id, submission_time, user_agent, page_load_time, response_data)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            response['id'],
            response['submission_time'],
            response['user_agent'],
            response['page_load_time'],
            response['response_data']
        ))
        
        # 自由記述テーブルに挿入
        response_data = json.loads(response['response_data'])
        free_text_fields = {
            'most_satisfied': '最も満足度が高い項目について',
            'least_satisfied': '最も満足度が低い項目について', 
            'most_expected': '最も期待度が高い項目について',
            'other_comments': 'その他ご意見・ご要望'
        }
        
        for field_name, label in free_text_fields.items():
            if field_name in response_data and response_data[field_name]:
                response_text = response_data[field_name]
                character_count = len(response_text)
                
                cursor.execute('''
                    INSERT INTO free_text_responses 
                    (response_id, question_type, question_label, response_text, character_count)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    response['id'],
                    field_name,
                    label,
                    response_text,
                    character_count
                ))
    
    conn.commit()
    conn.close()
    print(f"✅ {len(demo_responses)}件のデモデータを挿入しました")

if __name__ == '__main__':
    insert_demo_data()