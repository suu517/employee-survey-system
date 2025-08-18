// 管理者ダッシュボード JavaScript

let charts = {};
let currentData = {
    responses: 150,
    completionRate: 87,
    avgSatisfaction: 3.6,
    npsScore: 23
};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    loadDashboardData();
    setupEventListeners();
    console.log('📊 管理者ダッシュボードが開始されました');
});

// イベントリスナーの設定
function setupEventListeners() {
    // リアルタイムでのフィルター更新
    document.addEventListener('change', function(e) {
        if (e.target.closest('.filters-container')) {
            applyFilters();
        }
    });
}

// チャートの初期化
function initializeCharts() {
    // 総合評価分布チャート
    const overallCtx = document.getElementById('overallSatisfactionChart').getContext('2d');
    charts.overallSatisfaction = new Chart(overallCtx, {
        type: 'doughnut',
        data: {
            labels: ['非常に満足', '満足', '普通', '不満', '非常に不満'],
            datasets: [{
                data: [18, 32, 35, 12, 3],
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444',
                    '#7f1d1d'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });

    // 部署別満足度チャート
    const deptCtx = document.getElementById('departmentSatisfactionChart').getContext('2d');
    charts.departmentSatisfaction = new Chart(deptCtx, {
        type: 'bar',
        data: {
            labels: ['営業部', 'マーケティング部', '開発部', '人事部', '経理・財務部', '総務部'],
            datasets: [{
                label: '平均満足度',
                data: [3.2, 3.8, 4.1, 3.5, 3.4, 3.7],
                backgroundColor: '#3730a3',
                borderColor: '#1e40af',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5
                }
            }
        }
    });

    // 満足度vs期待度分析チャート
    const satExpCtx = document.getElementById('satisfactionExpectationChart').getContext('2d');
    charts.satisfactionExpectation = new Chart(satExpCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '各評価項目',
                data: [
                    {x: 4.2, y: 4.0, label: '人間関係'},
                    {x: 4.1, y: 3.8, label: '有給休暇'},
                    {x: 4.0, y: 3.9, label: '福利厚生'},
                    {x: 3.9, y: 4.2, label: '事業基盤'},
                    {x: 3.8, y: 3.7, label: '法令遵守'},
                    {x: 2.4, y: 4.2, label: '昇給・昇格'},
                    {x: 2.6, y: 4.2, label: '正当な評価'},
                    {x: 2.8, y: 4.2, label: '残業代'},
                    {x: 2.9, y: 3.8, label: '業務量'},
                    {x: 3.0, y: 4.0, label: '教育体制'}
                ],
                backgroundColor: function(context) {
                    const point = context.parsed;
                    const gap = point.y - point.x;
                    if (gap > 1.0) return '#ef4444'; // 大きなギャップ
                    if (gap > 0.5) return '#f59e0b'; // 中程度のギャップ
                    return '#10b981'; // 小さなギャップ
                },
                pointRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '現在の満足度'
                    },
                    min: 0,
                    max: 5
                },
                y: {
                    title: {
                        display: true,
                        text: '期待度'
                    },
                    min: 0,
                    max: 5
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].raw.label || '';
                        },
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `満足度: ${point.x}`,
                                `期待度: ${point.y}`,
                                `ギャップ: ${(point.y - point.x).toFixed(1)}`
                            ];
                        }
                    }
                }
            }
        }
    });

    // トレンド分析チャート
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    charts.trend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
            datasets: [{
                label: '総合満足度',
                data: [3.2, 3.3, 3.4, 3.5, 3.5, 3.6],
                borderColor: '#3730a3',
                backgroundColor: 'rgba(55, 48, 163, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'NPS スコア',
                data: [15, 17, 18, 20, 21, 23],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ダッシュボードデータの読み込み
async function loadDashboardData() {
    try {
        // APIから統計データを取得
        const response = await fetch('/api/statistics');
        
        if (!response.ok) {
            throw new Error('統計データの取得に失敗しました');
        }
        
        const data = await response.json();
        
        // サマリーカードの更新
        updateSummaryCards(data);
        
        // チャートデータの更新
        updateChartsWithRealData(data);
        
        // 分析データの更新
        updateAnalysisData(data);
        
        console.log('📈 ダッシュボードデータを読み込みました:', data);
        
    } catch (error) {
        console.error('❌ データ読み込みエラー:', error);
        // フォールバック: サンプルデータを使用
        updateSummaryCards();
        updateAnalysisData();
    }
}

// サマリーカードの更新
function updateSummaryCards(data = currentData) {
    document.getElementById('totalResponses').textContent = data.total_responses || data.responses;
    document.getElementById('completionRate').textContent = (data.completion_rate || data.completionRate) + '%';
    document.getElementById('avgSatisfaction').textContent = data.avg_satisfaction || data.avgSatisfaction;
    document.getElementById('npsScore').textContent = '+' + (data.nps_score || data.npsScore);
}

// 分析データの更新
function updateAnalysisData(data) {
    if (data && data.department_data) {
        updateDepartmentAnalysis(data.department_data);
    }
    
    if (data && data.category_satisfaction) {
        updateCategorySatisfaction(data.category_satisfaction);
    }
    
    console.log('📊 分析データを更新しました');
}

// チャートデータをリアルデータで更新
function updateChartsWithRealData(data) {
    try {
        // 満足度分布チャートの更新
        if (data.satisfaction_distribution && charts.overallSatisfaction) {
            charts.overallSatisfaction.data.datasets[0].data = data.satisfaction_distribution;
            charts.overallSatisfaction.update();
        }
        
        // 回答トレンドチャートの更新
        if (data.response_trend && charts.responseTrend) {
            charts.responseTrend.data.datasets[0].data = data.response_trend;
            charts.responseTrend.update();
        }
        
        console.log('📈 チャートデータを更新しました');
        
    } catch (error) {
        console.error('チャート更新エラー:', error);
    }
}

// 部署別分析データの更新
function updateDepartmentAnalysis(departmentData) {
    const container = document.querySelector('.department-analysis');
    if (!container) return;
    
    // 部署別データの表示更新
    console.log('📊 部署別分析を更新:', departmentData);
}

// カテゴリ別満足度の更新
function updateCategorySatisfaction(categoryData) {
    const container = document.querySelector('.category-satisfaction');
    if (!container) return;
    
    // カテゴリ別満足度の表示更新
    console.log('📊 カテゴリ別満足度を更新:', categoryData);
}

// フィルターの適用
function applyFilters() {
    const department = document.getElementById('departmentFilter').value;
    const position = document.getElementById('positionFilter').value;
    const employment = document.getElementById('employmentFilter').value;
    const period = document.getElementById('periodFilter').value;
    
    console.log('🔍 フィルター適用中...', {
        department,
        position,
        employment,
        period
    });
    
    // ローディング状態を表示
    showLoading();
    
    // フィルター処理のシミュレート
    setTimeout(() => {
        updateChartsWithFilter({department, position, employment, period});
        hideLoading();
        console.log('✅ フィルター適用完了');
    }, 800);
}

// チャートをフィルターで更新
function updateChartsWithFilter(filters) {
    // 実際の実装では、フィルターに基づいてデータを再取得し、チャートを更新
    // ここではデモ用にランダムなデータ変更をシミュレート
    
    if (charts.departmentSatisfaction && filters.department !== 'all') {
        // 特定部署のみのデータを表示するロジック
        console.log(`📊 ${filters.department} のデータに絞り込みました`);
    }
    
    // チャートを再描画
    Object.values(charts).forEach(chart => {
        if (chart && chart.update) {
            chart.update('none'); // アニメーションなしで即座に更新
        }
    });
}

// データの更新
function refreshData() {
    console.log('🔄 データを更新中...');
    showLoading();
    
    // API からデータを取得するシミュレーション
    setTimeout(() => {
        // ランダムな値でデータを更新（デモ用）
        currentData.responses = Math.floor(Math.random() * 50) + 120;
        currentData.completionRate = Math.floor(Math.random() * 20) + 75;
        currentData.avgSatisfaction = (Math.random() * 2 + 2.5).toFixed(1);
        currentData.npsScore = Math.floor(Math.random() * 40) + 5;
        
        updateSummaryCards();
        hideLoading();
        
        // 成功メッセージを表示
        showNotification('✅ データが更新されました', 'success');
        console.log('✅ データ更新完了');
    }, 1500);
}

// データのエクスポート
async function exportData() {
    console.log('📥 データをエクスポート中...');
    showNotification('📥 データをエクスポートしています...', 'info');
    
    try {
        // APIからエクスポートデータを取得
        const response = await fetch('/api/export');
        
        if (!response.ok) {
            throw new Error('エクスポートに失敗しました');
        }
        
        const result = await response.json();
        
        if (result.success) {
            // CSVデータを取得してダウンロード
            const csvData = result.data;
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `survey_responses_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            showNotification(`✅ ${result.count}件のデータをエクスポートしました`, 'success');
            console.log('📥 エクスポート完了');
        } else {
            throw new Error('エクスポートデータの生成に失敗しました');
        }
        
    } catch (error) {
        console.error('エクスポートエラー:', error);
        showNotification('❌ エクスポートに失敗しました', 'error');
        
        // フォールバック: 従来の方法でエクスポート
        exportDataFallback();
    }
}

// エクスポートのフォールバック処理
function exportDataFallback() {
    const exportData = {
        summary: currentData,
        timestamp: new Date().toISOString(),
        filters: {
            department: document.getElementById('departmentFilter').value,
            position: document.getElementById('positionFilter').value,
            employment: document.getElementById('employmentFilter').value,
            period: document.getElementById('periodFilter').value
        }
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('✅ データをエクスポートしました（JSON形式）', 'success');
}

// ローディング状態の表示
function showLoading() {
    document.querySelectorAll('.chart-container').forEach(container => {
        container.classList.add('loading');
    });
}

// ローディング状態の非表示
function hideLoading() {
    document.querySelectorAll('.chart-container').forEach(container => {
        container.classList.remove('loading');
    });
}

// 通知の表示
function showNotification(message, type = 'info') {
    // 既存の通知があれば削除
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    // 通知要素を作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-weight: 600;
            max-width: 300px;
            animation: slideInRight 0.3s ease;
        ">
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒後に自動削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// ウィンドウリサイズ時のチャート調整
window.addEventListener('resize', function() {
    Object.values(charts).forEach(chart => {
        if (chart && chart.resize) {
            chart.resize();
        }
    });
});

// デバッグ用: チャートデータの表示
function debugShowChartData() {
    console.log('🔍 現在のチャートデータ:', charts);
    console.log('🔍 現在のダッシュボードデータ:', currentData);
}

// アニメーション用CSS追加
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .chart-container.loading {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .notification {
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
});


// ====================
// 15カテゴリ詳細分析機能
// ====================

// カテゴリデータ定義
const CATEGORY_DATA = {
    worklife_balance: {
        name: '勤務時間・働き方',
        icon: '🕒',
        satisfaction: 3.4,
        expectation: 4.2,
        items: [
            { name: '残業時間の適正さ', satisfaction: 3.8, expectation: 4.1 },
            { name: '有給休暇の取りやすさ', satisfaction: 3.6, expectation: 4.3 },
            { name: 'フレキシブルな働き方', satisfaction: 2.9, expectation: 4.0 },
            { name: '勤務地の利便性', satisfaction: 3.3, expectation: 3.8 }
        ]
    },
    compensation: {
        name: '待遇・評価',
        icon: '💰',
        satisfaction: 3.1,
        expectation: 4.5,
        items: [
            { name: '昇給・昇格制度', satisfaction: 2.4, expectation: 4.7 },
            { name: '正当な評価', satisfaction: 2.8, expectation: 4.6 },
            { name: '残業代の適正支払い', satisfaction: 3.2, expectation: 4.4 },
            { name: '福利厚生の充実', satisfaction: 3.6, expectation: 4.3 }
        ]
    },
    workload_stress: {
        name: '業務量・ストレス',
        icon: '⚡',
        satisfaction: 3.2,
        expectation: 4.1,
        items: [
            { name: '業務量の適正さ', satisfaction: 2.8, expectation: 4.2 },
            { name: '身体的負荷の適正さ', satisfaction: 3.3, expectation: 3.9 },
            { name: '精神的負荷の適正さ', satisfaction: 3.5, expectation: 4.3 },
            { name: '目標設定の妥当性', satisfaction: 3.2, expectation: 4.0 }
        ]
    },
    growth_development: {
        name: '成長・能力開発',
        icon: '📈',
        satisfaction: 3.0,
        expectation: 4.3,
        items: [
            { name: '専門スキルの習得機会', satisfaction: 3.2, expectation: 4.5 },
            { name: 'コミュニケーション能力向上', satisfaction: 3.1, expectation: 4.2 },
            { name: '教育研修制度', satisfaction: 2.5, expectation: 4.4 },
            { name: 'キャリアパス設計', satisfaction: 2.8, expectation: 4.1 },
            { name: '実務経験による成長', satisfaction: 3.4, expectation: 4.3 },
            { name: 'ロールモデルの存在', satisfaction: 3.0, expectation: 4.0 }
        ]
    },
    job_satisfaction: {
        name: '仕事のやりがい',
        icon: '⭐',
        satisfaction: 3.6,
        expectation: 4.1,
        items: [
            { name: '仕事への誇り・プライド', satisfaction: 3.7, expectation: 4.2 },
            { name: '社会貢献実感', satisfaction: 4.0, expectation: 4.1 },
            { name: 'やりがいの実感', satisfaction: 3.5, expectation: 4.0 },
            { name: '裁量の大きさ', satisfaction: 3.1, expectation: 3.9 },
            { name: '成長実感', satisfaction: 3.4, expectation: 4.3 },
            { name: '達成感', satisfaction: 3.6, expectation: 4.1 },
            { name: 'プロジェクト規模', satisfaction: 3.8, expectation: 3.8 },
            { name: '強みの活用', satisfaction: 3.5, expectation: 4.2 }
        ]
    },
    relationships_culture: {
        name: '人間関係・企業文化',
        icon: '👥',
        satisfaction: 3.8,
        expectation: 4.0,
        items: [
            { name: '同僚との関係性', satisfaction: 4.1, expectation: 4.0 },
            { name: 'ハラスメントのない環境', satisfaction: 3.9, expectation: 4.8 },
            { name: '価値観・文化の共感', satisfaction: 3.7, expectation: 3.8 },
            { name: '風通しの良さ', satisfaction: 3.4, expectation: 4.1 },
            { name: '学び合う環境', satisfaction: 3.6, expectation: 4.0 },
            { name: '働きやすい環境', satisfaction: 3.8, expectation: 4.2 },
            { name: '女性が働きやすい環境', satisfaction: 3.7, expectation: 4.0 }
        ]
    },
    company_business: {
        name: '会社・事業',
        icon: '🏢',
        satisfaction: 3.7,
        expectation: 3.9,
        items: [
            { name: '事業基盤の安定性', satisfaction: 4.0, expectation: 4.1 },
            { name: '経営戦略の信頼性', satisfaction: 3.6, expectation: 3.9 },
            { name: '競合優位性・独自性', satisfaction: 3.3, expectation: 3.8 },
            { name: 'ブランド力・知名度', satisfaction: 3.8, expectation: 3.7 },
            { name: 'ミッション・バリュー', satisfaction: 3.7, expectation: 3.9 },
            { name: '法令遵守体制', satisfaction: 3.9, expectation: 4.0 }
        ]
    }
};

// ビュー切り替え機能
function switchCategoryView(viewType) {
    // すべてのビューを非表示
    document.querySelectorAll('.category-view').forEach(view => {
        view.classList.remove('active');
    });
    
    // すべてのトグルボタンを非アクティブ
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 選択されたビューを表示
    const targetView = document.getElementById(`category${viewType.charAt(0).toUpperCase() + viewType.slice(1)}View`);
    const targetToggle = document.getElementById(`${viewType}Toggle`);
    
    if (targetView && targetToggle) {
        targetView.classList.add('active');
        targetToggle.classList.add('active');
        
        // ビュー固有の初期化処理
        initializeCategoryView(viewType);
    }
}

// カテゴリビューの初期化
function initializeCategoryView(viewType) {
    switch(viewType) {
        case 'overview':
            initializeCategoryOverview();
            break;
        case 'detailed':
            initializeCategoryDetailed();
            break;
        case 'comparison':
            initializeCategoryComparison();
            break;
    }
}

// カテゴリ概要ビューの初期化
function initializeCategoryOverview() {
    // ミニチャートを作成
    Object.keys(CATEGORY_DATA).forEach(categoryKey => {
        createCategoryMiniChart(categoryKey);
    });
}

// カテゴリミニチャートの作成
function createCategoryMiniChart(categoryKey) {
    const canvas = document.getElementById(`${categoryKey}Chart`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const data = CATEGORY_DATA[categoryKey];
    
    // 既存のチャートを破棄
    if (charts[`${categoryKey}Mini`]) {
        charts[`${categoryKey}Mini`].destroy();
    }
    
    charts[`${categoryKey}Mini`] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['満足度', '期待度'],
            datasets: [{
                data: [data.satisfaction, data.expectation],
                backgroundColor: ['#3b82f6', '#f59e0b'],
                borderRadius: 4,
                maxBarThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    display: false
                },
                x: {
                    display: false
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}

// カテゴリ詳細ビューの初期化
function initializeCategoryDetailed() {
    createSatisfactionExpectationScatter();
    createCategoryRadarChart();
    createCategoryHeatmap();
    createImprovementMatrix();
    createCategoryTrendChart();
}

// 満足度vs期待度散布図
function createSatisfactionExpectationScatter() {
    const canvas = document.getElementById('satisfactionExpectationScatter');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // データポイントを作成
    const scatterData = Object.entries(CATEGORY_DATA).map(([key, data]) => ({
        x: data.satisfaction,
        y: data.expectation,
        label: data.name,
        category: key
    }));
    
    if (charts.satisfactionScatter) {
        charts.satisfactionScatter.destroy();
    }
    
    charts.satisfactionScatter = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'カテゴリ',
                data: scatterData,
                backgroundColor: scatterData.map(point => {
                    // 象限に基づく色分け
                    if (point.x >= 3.5 && point.y >= 4.0) return '#22c55e'; // 維持
                    if (point.x < 3.5 && point.y >= 4.0) return '#ef4444';  // 高優先
                    if (point.x < 3.5 && point.y < 4.0) return '#f59e0b';   // 監視
                    return '#3b82f6'; // 安定
                }),
                borderColor: '#ffffff',
                borderWidth: 2,
                pointRadius: 8,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return `${point.label}: 満足度${point.x}, 期待度${point.y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: '満足度' },
                    min: 2,
                    max: 5,
                    grid: { color: '#e5e7eb' }
                },
                y: {
                    title: { display: true, text: '期待度' },
                    min: 3,
                    max: 5,
                    grid: { color: '#e5e7eb' }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutBounce'
            }
        }
    });
}

// カテゴリ別レーダーチャート
function createCategoryRadarChart() {
    const canvas = document.getElementById('categoryRadarChart');
    if (!canvas) return;
    
    updateRadarChart();
}

function updateRadarChart() {
    const canvas = document.getElementById('categoryRadarChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const showSatisfaction = document.getElementById('showSatisfaction')?.checked !== false;
    const showExpectation = document.getElementById('showExpectation')?.checked !== false;
    
    const labels = Object.values(CATEGORY_DATA).map(data => data.name);
    const satisfactionData = Object.values(CATEGORY_DATA).map(data => data.satisfaction);
    const expectationData = Object.values(CATEGORY_DATA).map(data => data.expectation);
    
    const datasets = [];
    
    if (showSatisfaction) {
        datasets.push({
            label: '満足度',
            data: satisfactionData,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        });
    }
    
    if (showExpectation) {
        datasets.push({
            label: '期待度',
            data: expectationData,
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2
        });
    }
    
    if (charts.categoryRadar) {
        charts.categoryRadar.destroy();
    }
    
    charts.categoryRadar = new Chart(ctx, {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                r: {
                    angleLines: { color: '#e5e7eb' },
                    grid: { color: '#e5e7eb' },
                    pointLabels: { font: { size: 12 } },
                    ticks: {
                        beginAtZero: true,
                        max: 5,
                        stepSize: 1,
                        font: { size: 10 }
                    }
                }
            },
            animation: {
                duration: 1200,
                easing: 'easeOutCubic'
            }
        }
    });
}

// カテゴリヒートマップの作成
function createCategoryHeatmap() {
    const container = document.getElementById('categoryHeatmap');
    if (!container) return;
    
    const categories = Object.entries(CATEGORY_DATA);
    
    let heatmapHTML = '<div class="heatmap-grid">';
    
    categories.forEach(([key, data]) => {
        const gap = data.satisfaction - data.expectation;
        const intensity = Math.abs(gap);
        const colorClass = gap >= 0 ? 'positive' : 'negative';
        
        heatmapHTML += `
            <div class="heatmap-cell ${colorClass}" style="opacity: ${intensity / 2}" title="${data.name}: ${gap.toFixed(1)}">
                <div class="cell-icon">${data.icon}</div>
                <div class="cell-name">${data.name}</div>
                <div class="cell-value">${gap >= 0 ? '+' : ''}${gap.toFixed(1)}</div>
            </div>
        `;
    });
    
    heatmapHTML += '</div>';
    container.innerHTML = heatmapHTML;
}

// カテゴリビューの更新
function updateCategoryView() {
    const filter = document.getElementById('categoryFilter')?.value;
    // フィルタリング機能の実装
    console.log('カテゴリフィルター適用:', filter);
}

// カテゴリデータのエクスポート
function exportCategoryData() {
    const csvData = generateCategoryCsvData();
    downloadCsv(csvData, '15カテゴリ詳細分析.csv');
    showNotification('📊 カテゴリデータをエクスポートしました', 'success');
}

function generateCategoryCsvData() {
    let csv = 'カテゴリ,満足度,期待度,ギャップ\n';
    
    Object.entries(CATEGORY_DATA).forEach(([key, data]) => {
        const gap = (data.satisfaction - data.expectation).toFixed(1);
        csv += `${data.name},${data.satisfaction},${data.expectation},${gap}\n`;
    });
    
    return csv;
}

function downloadCsv(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// 初期化時に15カテゴリ機能を有効化
document.addEventListener('DOMContentLoaded', function() {
    // 既存の初期化後に15カテゴリ機能を初期化
    setTimeout(() => {
        initializeCategoryOverview();
    }, 1000);
    
});


// ユーティリティ関数

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}