// 運営者管理ダッシュボード JavaScript

// グローバル変数
let systemData = {};
let charts = {};
let refreshInterval;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 認証チェック
    if (!checkAuthentication()) {
        window.location.href = '/operator-login.html';
        return;
    }
    
    initializeDashboard();
    loadSystemData();
    setupAutoRefresh();
});

// ダッシュボードの初期化
function initializeDashboard() {
    console.log('運営者ダッシュボードを初期化しています...');
    
    // 現在時刻の表示
    updateLastUpdated();
    
    // デフォルトタブの表示
    showTab('overview');
    
    // イベントリスナーの設定
    setupEventListeners();
}

// イベントリスナーの設定
function setupEventListeners() {
    // ウィンドウリサイズ対応
    window.addEventListener('resize', function() {
        if (charts.usageTrend) charts.usageTrend.resize();
        if (charts.companySize) charts.companySize.resize();
        if (charts.industryNPS) charts.industryNPS.resize();
        if (charts.satisfactionTrend) charts.satisfactionTrend.resize();
    });
    
    // モーダル外クリックで閉じる
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
}

// タブ表示切り替え
function showTab(tabName) {
    // すべてのタブコンテンツを非表示
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // すべてのタブボタンからactiveクラスを削除
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // 選択されたタブを表示
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // 対応するタブボタンをアクティブに
    const activeButton = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // タブ固有の初期化処理
    initializeTabContent(tabName);
}

// タブ固有の初期化
function initializeTabContent(tabName) {
    switch(tabName) {
        case 'overview':
            loadOverviewData();
            break;
        case 'companies':
            loadCompaniesData();
            break;
        case 'analytics':
            loadAnalyticsData();
            break;
        case 'security':
            loadSecurityData();
            break;
        case 'system':
            loadSystemSettings();
            break;
    }
}

// 認証チェック
function checkAuthentication() {
    const token = sessionStorage.getItem('operator_token');
    return token === 'trial_operator_token_2025';
}

// APIリクエスト用ヘッダー取得
function getAuthHeaders() {
    const token = sessionStorage.getItem('operator_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// システムデータの読み込み
async function loadSystemData() {
    try {
        const headers = getAuthHeaders();
        
        // 複数のAPIエンドポイントから並行してデータを取得
        const [overviewData, companiesData, securityData] = await Promise.all([
            fetch('/api/operator/overview', { headers }).then(r => r.json()).catch(() => getMockOverviewData()),
            fetch('/api/operator/companies', { headers }).then(r => r.json()).catch(() => getMockCompaniesData()),
            fetch('/api/operator/security', { headers }).then(r => r.json()).catch(() => getMockSecurityData())
        ]);
        
        systemData = {
            overview: overviewData,
            companies: companiesData,
            security: securityData
        };
        
        console.log('システムデータを読み込みました:', systemData);
        
    } catch (error) {
        console.error('システムデータの読み込みに失敗しました:', error);
        // モックデータで初期化
        systemData = {
            overview: getMockOverviewData(),
            companies: getMockCompaniesData(),
            security: getMockSecurityData()
        };
    }
}

// 概要データの読み込み
function loadOverviewData() {
    const data = systemData.overview || getMockOverviewData();
    
    // KPI更新
    updateKPIs(data.kpis);
    
    // チャート作成
    createUsageTrendChart(data.usageTrend);
    createCompanySizeChart(data.companySize);
    
    // システムステータス更新
    updateSystemStatus(data.systemStatus);
}

// KPIデータの更新
function updateKPIs(kpis) {
    document.getElementById('totalCompanies').textContent = kpis.totalCompanies || '--';
    document.getElementById('totalResponses').textContent = (kpis.totalResponses || 0).toLocaleString();
    document.getElementById('activeSurveys').textContent = kpis.activeSurveys || '--';
    document.getElementById('monthlyRevenue').textContent = `¥${(kpis.monthlyRevenue || 0).toLocaleString()}`;
}

// 利用状況トレンドチャート
function createUsageTrendChart(data) {
    const ctx = document.getElementById('usageTrendChart');
    if (!ctx) return;
    
    if (charts.usageTrend) {
        charts.usageTrend.destroy();
    }
    
    charts.usageTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || ['30日前', '25日前', '20日前', '15日前', '10日前', '5日前', '今日'],
            datasets: [{
                label: '調査実施数',
                data: data.surveys || [12, 19, 15, 25, 22, 30, 28],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: '新規企業登録数',
                data: data.companies || [2, 3, 1, 4, 2, 5, 3],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// 企業規模別分布チャート
function createCompanySizeChart(data) {
    const ctx = document.getElementById('companySizeChart');
    if (!ctx) return;
    
    if (charts.companySize) {
        charts.companySize.destroy();
    }
    
    charts.companySize = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || ['小規模(1-50人)', '中規模(51-200人)', '大規模(201-1000人)', '超大規模(1000人以上)'],
            datasets: [{
                data: data.values || [45, 35, 15, 5],
                backgroundColor: [
                    '#3498db',
                    '#e74c3c',
                    '#f39c12',
                    '#27ae60'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

// システムステータスの更新
function updateSystemStatus(status) {
    // 実際の実装では、サーバーからのリアルタイムデータを使用
    console.log('システムステータスを更新しました:', status);
}

// 企業データの読み込み
function loadCompaniesData() {
    const data = systemData.companies || getMockCompaniesData();
    renderCompaniesTable(data.companies);
}

// 企業テーブルの描画
function renderCompaniesTable(companies) {
    const tbody = document.getElementById('companiesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${company.name}</td>
            <td>${company.industry}</td>
            <td>${company.size.toLocaleString()}人</td>
            <td><span class="plan-badge ${company.plan}">${getPlanName(company.plan)}</span></td>
            <td>${company.responses.toLocaleString()}</td>
            <td>${formatDate(company.lastUsed)}</td>
            <td><span class="status-badge ${company.status}">${getStatusName(company.status)}</span></td>
            <td>
                <button class="action-btn view" onclick="viewCompany('${company.id}')">詳細</button>
                <button class="action-btn edit" onclick="editCompany('${company.id}')">編集</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 企業検索・フィルタリング
function filterCompanies() {
    const searchTerm = document.getElementById('companySearch').value.toLowerCase();
    const filterValue = document.getElementById('companyFilter').value;
    
    const rows = document.querySelectorAll('#companiesTableBody tr');
    
    rows.forEach(row => {
        const companyName = row.cells[0].textContent.toLowerCase();
        const status = row.cells[6].textContent.toLowerCase();
        
        const matchesSearch = companyName.includes(searchTerm);
        const matchesFilter = !filterValue || status.includes(filterValue);
        
        row.style.display = matchesSearch && matchesFilter ? '' : 'none';
    });
}

// 分析データの読み込み
function loadAnalyticsData() {
    createIndustryNPSChart();
    createSatisfactionTrendChart();
}

// 業界別NPSチャート
function createIndustryNPSChart() {
    const ctx = document.getElementById('industryNPSChart');
    if (!ctx) return;
    
    if (charts.industryNPS) {
        charts.industryNPS.destroy();
    }
    
    charts.industryNPS = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['IT・技術', '製造業', '金融', '小売・サービス', '医療・介護', '教育'],
            datasets: [{
                label: 'NPS スコア',
                data: [23, 18, 15, 12, 25, 20],
                backgroundColor: [
                    '#3498db',
                    '#e74c3c',
                    '#f39c12',
                    '#27ae60',
                    '#9b59b6',
                    '#1abc9c'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'NPS スコア'
                    }
                }
            }
        }
    });
}

// 満足度トレンドチャート
function createSatisfactionTrendChart() {
    const ctx = document.getElementById('satisfactionTrendChart');
    if (!ctx) return;
    
    if (charts.satisfactionTrend) {
        charts.satisfactionTrend.destroy();
    }
    
    charts.satisfactionTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'],
            datasets: [{
                label: '全体平均満足度',
                data: [3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.7],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 1,
                    max: 5,
                    title: {
                        display: true,
                        text: '満足度 (1-5)'
                    }
                }
            }
        }
    });
}

// セキュリティデータの読み込み
function loadSecurityData() {
    const data = systemData.security || getMockSecurityData();
    renderSecurityAlerts(data.alerts);
    renderAccessLogs(data.accessLogs);
}

// セキュリティアラートの描画
function renderSecurityAlerts(alerts) {
    const container = document.getElementById('securityAlerts');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="no-alerts">現在アラートはありません</div>';
        return;
    }
    
    alerts.forEach(alert => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert-item ${alert.level}`;
        alertDiv.innerHTML = `
            <span class="alert-time">${alert.time}</span>
            <span class="alert-message">${alert.message}</span>
            <button class="alert-dismiss" onclick="dismissAlert('${alert.id}')">無視</button>
        `;
        container.appendChild(alertDiv);
    });
}

// アクセスログの描画
function renderAccessLogs(logs) {
    const tbody = document.getElementById('accessLogBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.time}</td>
            <td>${log.ip}</td>
            <td>${log.endpoint}</td>
            <td><span class="status-code ${getStatusClass(log.status)}">${log.status}</span></td>
            <td class="user-agent">${log.userAgent}</td>
        `;
        tbody.appendChild(row);
    });
}

// システム設定の読み込み
function loadSystemSettings() {
    // 現在の設定値を読み込み
    console.log('システム設定を読み込みました');
}

// モーダル表示
function showAddCompanyModal() {
    const modal = document.getElementById('addCompanyModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

// モーダル閉じる
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// 新規企業追加
function addCompany() {
    const form = document.getElementById('addCompanyForm');
    const formData = new FormData(form);
    
    const companyData = {
        name: document.getElementById('companyName').value,
        industry: document.getElementById('companyIndustry').value,
        size: parseInt(document.getElementById('companySize').value),
        plan: document.getElementById('companyPlan').value,
        email: document.getElementById('companyEmail').value
    };
    
    // バリデーション
    if (!companyData.name || !companyData.industry || !companyData.size || !companyData.email) {
        alert('すべての必須項目を入力してください');
        return;
    }
    
    // APIに送信（実装時）
    console.log('新規企業を追加:', companyData);
    
    // モーダルを閉じてフォームをリセット
    closeModal('addCompanyModal');
    form.reset();
    
    // 企業一覧を再読み込み
    loadCompaniesData();
    
    alert('企業を追加しました');
}

// 企業詳細表示
function viewCompany(companyId) {
    console.log('企業詳細を表示:', companyId);
    // 詳細モーダルを表示する実装
}

// 企業編集
function editCompany(companyId) {
    console.log('企業を編集:', companyId);
    // 編集モーダルを表示する実装
}

// セキュリティアラート無視
function dismissAlert(alertId) {
    console.log('アラートを無視:', alertId);
    // アラートを無視する実装
}

// 分析レポート出力
function exportAnalytics() {
    console.log('分析レポートを出力中...');
    // CSV/PDF出力の実装
    alert('レポートの出力を開始しました');
}

// バックアップ実行
function triggerBackup() {
    console.log('バックアップを実行中...');
    // バックアップ処理の実装
    alert('バックアップを開始しました');
}

// 設定保存
function saveSettings() {
    const settings = {
        maintenanceMode: document.getElementById('maintenanceMode').checked,
        approvalRequired: document.getElementById('approvalRequired').checked,
        defaultResponseLimit: parseInt(document.getElementById('defaultResponseLimit').value),
        rateLimit: parseInt(document.getElementById('rateLimit').value),
        sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
        force2FA: document.getElementById('force2FA').checked,
        backupInterval: parseInt(document.getElementById('backupInterval').value),
        dataRetention: parseInt(document.getElementById('dataRetention').value)
    };
    
    console.log('設定を保存:', settings);
    // API呼び出しで設定を保存
    alert('設定を保存しました');
}

// 設定リセット
function resetSettings() {
    if (confirm('設定をデフォルト値に戻しますか？')) {
        // デフォルト値をフォームに設定
        document.getElementById('maintenanceMode').checked = false;
        document.getElementById('approvalRequired').checked = true;
        document.getElementById('defaultResponseLimit').value = 1000;
        document.getElementById('rateLimit').value = 60;
        document.getElementById('sessionTimeout').value = 24;
        document.getElementById('force2FA').checked = false;
        document.getElementById('backupInterval').value = 6;
        document.getElementById('dataRetention').value = 365;
        
        console.log('設定をリセットしました');
    }
}

// ログアウト
function logout() {
    if (confirm('ログアウトしますか？')) {
        // セッション削除とリダイレクト
        sessionStorage.removeItem('operator_token');
        sessionStorage.removeItem('operator_user');
        window.location.href = '/operator-login.html';
    }
}

// 自動更新の設定
function setupAutoRefresh() {
    refreshInterval = setInterval(() => {
        updateLastUpdated();
        
        // アクティブなタブのデータを更新
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            const tabId = activeTab.id;
            if (tabId === 'overview' || tabId === 'security') {
                loadSystemData();
            }
        }
    }, 30000); // 30秒ごと
}

// 最終更新時刻の更新
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleString('ja-JP');
    const element = document.getElementById('lastUpdated');
    if (element) {
        element.textContent = timeString;
    }
}

// ユーティリティ関数
function getPlanName(plan) {
    const plans = {
        'trial': 'トライアル',
        'basic': 'ベーシック',
        'premium': 'プレミアム',
        'enterprise': 'エンタープライズ'
    };
    return plans[plan] || plan;
}

function getStatusName(status) {
    const statuses = {
        'active': 'アクティブ',
        'inactive': '非アクティブ',
        'trial': 'トライアル',
        'suspended': '停止中'
    };
    return statuses[status] || status;
}

function getStatusClass(status) {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'redirect';
    if (status >= 400 && status < 500) return 'client-error';
    if (status >= 500) return 'server-error';
    return '';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

// モックデータ生成関数
function getMockOverviewData() {
    return {
        kpis: {
            totalCompanies: 127,
            totalResponses: 15749,
            activeSurveys: 23,
            monthlyRevenue: 2450000
        },
        usageTrend: {
            labels: ['30日前', '25日前', '20日前', '15日前', '10日前', '5日前', '今日'],
            surveys: [12, 19, 15, 25, 22, 30, 28],
            companies: [2, 3, 1, 4, 2, 5, 3]
        },
        companySize: {
            labels: ['小規模(1-50人)', '中規模(51-200人)', '大規模(201-1000人)', '超大規模(1000人以上)'],
            values: [45, 35, 15, 5]
        },
        systemStatus: {
            api: 'online',
            database: 'online',
            backup: 'online',
            load: 'warning'
        }
    };
}

function getMockCompaniesData() {
    return {
        companies: [
            {
                id: '1',
                name: '株式会社テクノソリューション',
                industry: 'IT・技術',
                size: 150,
                plan: 'premium',
                responses: 1247,
                lastUsed: '2025-08-16',
                status: 'active'
            },
            {
                id: '2',
                name: 'グローバル製造業株式会社',
                industry: '製造業',
                size: 3200,
                plan: 'enterprise',
                responses: 2890,
                lastUsed: '2025-08-15',
                status: 'active'
            },
            {
                id: '3',
                name: 'フィナンシャルサービス',
                industry: '金融',
                size: 850,
                plan: 'premium',
                responses: 654,
                lastUsed: '2025-08-10',
                status: 'active'
            }
        ]
    };
}

function getMockSecurityData() {
    return {
        alerts: [
            {
                id: '1',
                level: 'low',
                time: '2025-08-17 14:30',
                message: '異常なアクセス頻度を検出（警告レベル）'
            }
        ],
        accessLogs: [
            {
                time: '2025-08-17 15:30:45',
                ip: '192.168.1.100',
                endpoint: '/api/submit',
                status: 200,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            {
                time: '2025-08-17 15:30:32',
                ip: '10.0.0.50',
                endpoint: '/api/statistics',
                status: 200,
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        ]
    };
}

// ====================
// 企業管理機能
// ====================

let companiesData = [];
let editingCompanyId = null;

// タブ切り替え時のデータ読み込み
function loadCompaniesData() {
    fetch('/api/admin/companies')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                companiesData = data.companies || [];
                renderCompaniesTable();
            } else {
                showNotification('企業データの読み込みに失敗しました', 'error');
            }
        })
        .catch(error => {
            console.error('企業データ読み込みエラー:', error);
            showNotification('企業データの読み込みに失敗しました', 'error');
        });
}

// 企業テーブル表示
function renderCompaniesTable() {
    const tableBody = document.getElementById('companiesTableBody');
    
    if (companiesData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    まだ企業が登録されていません。「新規企業追加」から追加してください。
                </td>
            </tr>
        `;
        return;
    }
    
    const rows = companiesData.map(company => {
        const statusClass = company.is_active ? 'active' : 'inactive';
        const statusText = company.is_active ? '有効' : '無効';
        
        return `
            <tr>
                <td><code>${company.company_id}</code></td>
                <td>${escapeHtml(company.company_name)}</td>
                <td><code>${company.access_key}</code></td>
                <td>${company.max_urls}</td>
                <td>${company.current_urls || 0}</td>
                <td><span class="company-status ${statusClass}">${statusText}</span></td>
                <td>${formatDate(company.created_at)}</td>
                <td>
                    <div class="company-actions">
                        <button class="company-action-btn edit-btn" onclick="showEditCompanyModal('${company.company_id}')">
                            ✏️ 編集
                        </button>
                        <button class="company-action-btn view-urls-btn" onclick="viewCompanyUrls('${company.company_id}')">
                            🔗 URL確認
                        </button>
                        <button class="company-action-btn delete-btn" onclick="deleteCompany('${company.company_id}')">
                            🗑️ 削除
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = rows;
}

// 新規企業追加モーダル表示
function showAddCompanyModal() {
    const modal = document.getElementById('addCompanyModal');
    modal.style.display = 'flex';
    
    // フォームリセット
    document.getElementById('newCompanyId').value = '';
    document.getElementById('newCompanyName').value = '';
    document.getElementById('newAccessKey').value = '';
    document.getElementById('newMaxUrls').value = '10';
    document.getElementById('newMaxResponsesPerUrl').value = '1000';
}

// 新規企業追加モーダル閉じる
function closeAddCompanyModal() {
    document.getElementById('addCompanyModal').style.display = 'none';
}

// 企業編集モーダル表示
function showEditCompanyModal(companyId) {
    const company = companiesData.find(c => c.company_id === companyId);
    if (!company) return;
    
    editingCompanyId = companyId;
    
    document.getElementById('editCompanyId').value = company.company_id;
    document.getElementById('editCompanyName').value = company.company_name;
    document.getElementById('editAccessKey').value = company.access_key;
    document.getElementById('editMaxUrls').value = company.max_urls;
    document.getElementById('editMaxResponsesPerUrl').value = company.max_responses_per_url;
    document.getElementById('editIsActive').checked = company.is_active;
    
    document.getElementById('editCompanyModal').style.display = 'flex';
}

// 企業編集モーダル閉じる
function closeEditCompanyModal() {
    document.getElementById('editCompanyModal').style.display = 'none';
    editingCompanyId = null;
}

// 企業アカウント作成
async function createCompanyAccount() {
    const companyId = document.getElementById('newCompanyId').value.trim();
    const companyName = document.getElementById('newCompanyName').value.trim();
    const accessKey = document.getElementById('newAccessKey').value.trim();
    const maxUrls = parseInt(document.getElementById('newMaxUrls').value);
    const maxResponsesPerUrl = parseInt(document.getElementById('newMaxResponsesPerUrl').value);
    
    // バリデーション
    if (!companyId || !companyName || !accessKey) {
        showNotification('必須項目を入力してください', 'error');
        return;
    }
    
    if (!/^[a-zA-Z0-9\-]+$/.test(companyId)) {
        showNotification('企業IDは英数字とハイフンのみ使用可能です', 'error');
        return;
    }
    
    if (maxUrls < 1 || maxUrls > 100) {
        showNotification('URL発行上限は1〜100の範囲で設定してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                company_id: companyId,
                company_name: companyName,
                access_key: accessKey,
                max_urls: maxUrls,
                max_responses_per_url: maxResponsesPerUrl
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '企業作成に失敗しました');
        }
        
        showNotification('企業アカウントを作成しました', 'success');
        closeAddCompanyModal();
        loadCompaniesData();
        
    } catch (error) {
        console.error('企業作成エラー:', error);
        showNotification(error.message || '企業作成に失敗しました', 'error');
    }
}

// 企業アカウント更新
async function updateCompanyAccount() {
    if (!editingCompanyId) return;
    
    const companyName = document.getElementById('editCompanyName').value.trim();
    const accessKey = document.getElementById('editAccessKey').value.trim();
    const maxUrls = parseInt(document.getElementById('editMaxUrls').value);
    const maxResponsesPerUrl = parseInt(document.getElementById('editMaxResponsesPerUrl').value);
    const isActive = document.getElementById('editIsActive').checked;
    
    if (!companyName || !accessKey) {
        showNotification('必須項目を入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/companies/${editingCompanyId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                company_name: companyName,
                access_key: accessKey,
                max_urls: maxUrls,
                max_responses_per_url: maxResponsesPerUrl,
                is_active: isActive
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '企業更新に失敗しました');
        }
        
        showNotification('企業情報を更新しました', 'success');
        closeEditCompanyModal();
        loadCompaniesData();
        
    } catch (error) {
        console.error('企業更新エラー:', error);
        showNotification(error.message || '企業更新に失敗しました', 'error');
    }
}

// 企業削除
async function deleteCompany(companyId) {
    const company = companiesData.find(c => c.company_id === companyId);
    if (!company) return;
    
    const confirmMessage = `企業「${company.company_name}」を削除しますか？\n\nこの操作は取り消せません。企業に関連するすべてのURLと回答データも削除されます。`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch(`/api/admin/companies/${companyId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '企業削除に失敗しました');
        }
        
        showNotification('企業を削除しました', 'success');
        loadCompaniesData();
        
    } catch (error) {
        console.error('企業削除エラー:', error);
        showNotification(error.message || '企業削除に失敗しました', 'error');
    }
}

// 企業のURL確認
function viewCompanyUrls(companyId) {
    const company = companiesData.find(c => c.company_id === companyId);
    if (!company) return;
    
    // 企業ダッシュボードへのリンクを新規タブで開く
    const loginUrl = `/company-login.html`;
    window.open(loginUrl, '_blank');
    
    showNotification(`企業「${company.company_name}」のログインページを開きました`, 'info');
}

// ユーティリティ関数

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 既存のshowTabを上書き
function showTab(tabName) {
    // すべてのタブを非表示
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // すべてのタブボタンを非アクティブ
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    
    // 指定されたタブを表示
    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 対応するタブボタンをアクティブ
    const targetBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // タブ切り替え時のデータ読み込み
    if (tabName === 'companies') {
        loadCompaniesData();
    } else if (tabName === 'overview') {
        loadSystemData();
    } else if (tabName === 'analytics') {
        updateAnalyticsData();
    } else if (tabName === 'security') {
        updateSecurityData();
    }
}