// 企業管理ダッシュボード用JavaScript

// グローバル変数
let currentCompany = null;
let companyToken = null;
let urlData = [];
let selectedUrlToken = null;

// ページ初期化
document.addEventListener('DOMContentLoaded', function() {
    // 認証チェック
    companyToken = sessionStorage.getItem('companyToken');
    const companyId = sessionStorage.getItem('companyId');
    
    if (!companyToken || !companyId) {
        window.location.href = '/company-login.html';
        return;
    }
    
    // 企業名表示
    document.getElementById('companyName').textContent = companyId;
    
    // データ読み込み
    loadDashboardData();
});

// 認証ヘッダー取得
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${companyToken}`,
        'Content-Type': 'application/json'
    };
}

// ダッシュボードデータ読み込み
async function loadDashboardData() {
    try {
        // サマリーデータ取得
        await Promise.all([
            loadSummaryData(),
            loadUrlList(),
            loadAnalyticsData()
        ]);
    } catch (error) {
        console.error('データ読み込みエラー:', error);
        showError('データの読み込みに失敗しました');
    }
}

// サマリーデータ読み込み
async function loadSummaryData() {
    try {
        const response = await fetch('/api/company/summary', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('サマリーデータの取得に失敗');
        }
        
        const data = await response.json();
        
        // サマリーカード更新
        document.getElementById('totalUrls').textContent = data.totalUrls || 0;
        document.getElementById('totalResponses').textContent = data.totalResponses || 0;
        document.getElementById('avgSatisfaction').textContent = data.avgSatisfaction ? data.avgSatisfaction.toFixed(1) : '-';
        document.getElementById('completionRate').textContent = data.completionRate ? `${data.completionRate.toFixed(1)}%` : '-';
        
    } catch (error) {
        console.error('サマリーデータ読み込みエラー:', error);
    }
}

// URL一覧読み込み
async function loadUrlList() {
    try {
        const response = await fetch('/api/company/urls', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('URL一覧の取得に失敗');
        }
        
        const data = await response.json();
        urlData = data.urls || [];
        
        renderUrlList();
        
    } catch (error) {
        console.error('URL一覧読み込みエラー:', error);
        showEmptyUrlList();
    }
}

// URL一覧表示
function renderUrlList() {
    const urlList = document.getElementById('urlList');
    
    if (urlData.length === 0) {
        showEmptyUrlList();
        return;
    }
    
    const urlCards = urlData.map(url => createUrlCard(url)).join('');
    urlList.innerHTML = urlCards;
}

// URLカード作成
function createUrlCard(url) {
    const now = new Date();
    const expiryDate = new Date(url.expires_at);
    const isExpired = now > expiryDate;
    const isFull = url.current_responses >= url.max_responses;
    
    let status, statusClass;
    if (isExpired) {
        status = '期限切れ';
        statusClass = 'expired';
    } else if (isFull) {
        status = '回答上限';
        statusClass = 'full';
    } else {
        status = '利用可能';
        statusClass = 'active';
    }
    
    const responseRate = url.max_responses > 0 ? (url.current_responses / url.max_responses * 100).toFixed(1) : 0;
    
    return `
        <div class="url-card ${statusClass}">
            <div class="url-header">
                <div>
                    <div class="url-title">${escapeHtml(url.description || 'タイトルなし')}</div>
                    <div class="url-status ${statusClass}">${status}</div>
                </div>
            </div>
            
            <div class="url-info">
                <div class="url-info-item">
                    <span class="icon">📊</span>
                    <span class="label">回答数:</span>
                    <span class="value">${url.current_responses}/${url.max_responses}</span>
                </div>
                <div class="url-info-item">
                    <span class="icon">📅</span>
                    <span class="label">作成日:</span>
                    <span class="value">${formatDate(url.created_at)}</span>
                </div>
                <div class="url-info-item">
                    <span class="icon">⏰</span>
                    <span class="label">期限:</span>
                    <span class="value">${formatDate(url.expires_at)}</span>
                </div>
                <div class="url-info-item">
                    <span class="icon">🎯</span>
                    <span class="label">回答率:</span>
                    <span class="value">${responseRate}%</span>
                </div>
            </div>
            
            <div class="url-actions">
                <button class="view-btn" onclick="showUrlDetail('${url.token}')">📋 詳細</button>
                <button class="copy-btn" onclick="copyUrlToClipboard('${url.token}')">📋 URL コピー</button>
                ${!isExpired && url.is_active ? `<button class="disable-btn" onclick="disableUrl('${url.token}')">🚫 無効化</button>` : ''}
            </div>
        </div>
    `;
}

// 空のURL一覧表示
function showEmptyUrlList() {
    const urlList = document.getElementById('urlList');
    urlList.innerHTML = `
        <div class="empty-state">
            <div class="icon">🔗</div>
            <h3>調査URLが作成されていません</h3>
            <p>「新しいURLを発行」ボタンから最初の調査URLを作成してください。</p>
            <button class="create-btn" onclick="showCreateModal()">+ 新しいURLを発行</button>
        </div>
    `;
}

// 分析データ読み込み
async function loadAnalyticsData() {
    try {
        const response = await fetch('/api/company/analytics', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('分析データの取得に失敗');
        }
        
        const data = await response.json();
        
        // 満足度分布表示
        renderSatisfactionBars(data.satisfactionDistribution || []);
        
        // 最近の回答表示
        renderRecentResponses(data.recentResponses || []);
        
    } catch (error) {
        console.error('分析データ読み込みエラー:', error);
    }
}

// 満足度バー表示
function renderSatisfactionBars(distribution) {
    const labels = ['とても満足', '満足', 'どちらでもない', '不満', 'とても不満'];
    const colors = ['very-satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very-dissatisfied'];
    const total = distribution.reduce((a, b) => a + b, 0) || 1;
    
    const bars = labels.map((label, index) => {
        const count = distribution[index] || 0;
        const percentage = (count / total * 100);
        
        return `
            <div class="satisfaction-bar">
                <div class="bar-label">${label}</div>
                <div class="bar-fill">
                    <div class="bar-progress ${colors[index]}" style="width: ${percentage}%"></div>
                </div>
                <div class="bar-count">${count}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('satisfactionBars').innerHTML = bars;
}

// 最近の回答表示
function renderRecentResponses(responses) {
    if (responses.length === 0) {
        document.getElementById('recentResponses').innerHTML = '<p style="color: #666; text-align: center;">まだ回答がありません</p>';
        return;
    }
    
    const responseItems = responses.map(response => {
        let satisfactionClass = 'medium';
        if (response.satisfaction >= 4) satisfactionClass = 'high';
        else if (response.satisfaction <= 2) satisfactionClass = 'low';
        
        return `
            <div class="response-item">
                <div class="response-header">
                    <span class="response-time">${formatDateTime(response.timestamp)}</span>
                    <span class="response-satisfaction ${satisfactionClass}">満足度 ${response.satisfaction}/5</span>
                </div>
                <div class="response-department">${response.department || '部署不明'} - ${response.position || '役職不明'}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('recentResponses').innerHTML = responseItems;
}

// 新規URL作成モーダル表示
function showCreateModal() {
    // 発行制限チェック
    if (!canCreateMoreUrls()) {
        showError('URL発行数の上限に達しています。管理者にお問い合わせください。');
        return;
    }
    
    const modal = document.getElementById('createModal');
    modal.classList.add('show');
}

// URL作成可能かチェック
function canCreateMoreUrls() {
    const totalUrls = parseInt(document.getElementById('totalUrls').textContent) || 0;
    // 企業の制限情報は別途APIで取得する必要がありますが、
    // 現在は企業側APIレスポンスに含める想定
    return true; // 実際のチェックはサーバー側で行われます
}

// モーダル閉じる
function closeModal() {
    const modal = document.getElementById('createModal');
    modal.classList.remove('show');
    
    // フォームリセット
    document.getElementById('createUrlForm').reset();
    document.getElementById('maxResponses').value = 50;
    document.getElementById('expiryHours').value = 720;
}

// URL作成
async function createUrl() {
    const description = document.getElementById('urlDescription').value.trim();
    const maxResponses = parseInt(document.getElementById('maxResponses').value);
    const expiryHours = parseInt(document.getElementById('expiryHours').value);
    
    if (!description) {
        showError('調査名・説明を入力してください');
        return;
    }
    
    if (maxResponses < 1 || maxResponses > 1000) {
        showError('最大回答数は1〜1000の範囲で設定してください');
        return;
    }
    
    try {
        const response = await fetch('/api/company/urls', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                description: description,
                max_responses: maxResponses,
                expires_hours: expiryHours
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'URL作成に失敗');
        }
        
        const result = await response.json();
        
        showSuccess('調査URLが作成されました！');
        closeModal();
        
        // データ再読み込み
        await loadUrlList();
        await loadSummaryData();
        
        // 作成されたURLの詳細を表示
        setTimeout(() => {
            showUrlDetail(result.token);
        }, 500);
        
    } catch (error) {
        console.error('URL作成エラー:', error);
        showError(error.message || 'URL作成に失敗しました');
    }
}

// URL詳細表示
function showUrlDetail(token) {
    const url = urlData.find(u => u.token === token);
    if (!url) {
        showError('URL情報が見つかりません');
        return;
    }
    
    selectedUrlToken = token;
    
    const surveyUrl = `${window.location.origin}/survey/${token}`;
    
    const detailHtml = `
        <div class="detail-item">
            <span class="detail-label">調査URL</span>
            <span class="detail-value" id="surveyUrl">${surveyUrl}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">トークン</span>
            <span class="detail-value">${token}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">説明</span>
            <span class="detail-value">${escapeHtml(url.description || 'なし')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">回答数</span>
            <span class="detail-value">${url.current_responses} / ${url.max_responses}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">作成日時</span>
            <span class="detail-value">${formatDateTime(url.created_at)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">有効期限</span>
            <span class="detail-value">${formatDateTime(url.expires_at)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">ステータス</span>
            <span class="detail-value">${url.is_active ? '有効' : '無効'}</span>
        </div>
    `;
    
    document.getElementById('urlDetailContent').innerHTML = detailHtml;
    document.getElementById('detailModal').classList.add('show');
}

// URL詳細モーダル閉じる
function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
    selectedUrlToken = null;
}

// URLコピー
function copyUrl() {
    if (!selectedUrlToken) return;
    
    const surveyUrl = `${window.location.origin}/survey/${selectedUrlToken}`;
    copyToClipboard(surveyUrl, '調査URLをコピーしました！');
}

// URL無効化
async function disableUrl() {
    if (!selectedUrlToken) return;
    
    if (!confirm('このURLを無効化しますか？無効化すると再度有効にすることはできません。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/company/urls/${selectedUrlToken}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'URL無効化に失敗');
        }
        
        showSuccess('URLを無効化しました');
        closeDetailModal();
        
        // データ再読み込み
        await loadUrlList();
        await loadSummaryData();
        
    } catch (error) {
        console.error('URL無効化エラー:', error);
        showError(error.message || 'URL無効化に失敗しました');
    }
}

// URLクリップボードコピー（一覧から）
function copyUrlToClipboard(token) {
    const surveyUrl = `${window.location.origin}/survey/${token}`;
    copyToClipboard(surveyUrl, '調査URLをコピーしました！');
}

// URLリスト内無効化
async function disableUrl(token) {
    if (!confirm('このURLを無効化しますか？')) return;
    
    try {
        const response = await fetch(`/api/company/urls/${token}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'URL無効化に失敗');
        }
        
        showSuccess('URLを無効化しました');
        
        // データ再読み込み
        await loadUrlList();
        await loadSummaryData();
        
    } catch (error) {
        console.error('URL無効化エラー:', error);
        showError(error.message || 'URL無効化に失敗しました');
    }
}

// データ更新
async function refreshData() {
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.textContent = '🔄 更新中...';
    refreshBtn.disabled = true;
    
    try {
        await loadDashboardData();
        showSuccess('データを更新しました');
    } catch (error) {
        showError('データ更新に失敗しました');
    } finally {
        refreshBtn.textContent = '🔄 更新';
        refreshBtn.disabled = false;
    }
}

// 結果エクスポート
async function exportResults() {
    try {
        const response = await fetch('/api/company/export', {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('エクスポートに失敗');
        }
        
        const data = await response.json();
        
        // CSVダウンロード
        const csvContent = data.csvData;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `survey_results_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('データをエクスポートしました');
        
    } catch (error) {
        console.error('エクスポートエラー:', error);
        showError('エクスポートに失敗しました');
    }
}

// ログアウト
function logout() {
    if (confirm('ログアウトしますか？')) {
        sessionStorage.removeItem('companyToken');
        sessionStorage.removeItem('companyId');
        window.location.href = '/company-login.html';
    }
}

// ユーティリティ関数

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}

// 日時フォーマット
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'});
}

// クリップボードコピー
function copyToClipboard(text, successMessage = 'コピーしました！') {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showSuccess(successMessage);
        }).catch(err => {
            fallbackCopyTextToClipboard(text, successMessage);
        });
    } else {
        fallbackCopyTextToClipboard(text, successMessage);
    }
}

// フォールバッククリップボードコピー
function fallbackCopyTextToClipboard(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showSuccess(successMessage);
    } catch (err) {
        console.error('コピーに失敗:', err);
        showError('コピーに失敗しました');
    }
    
    document.body.removeChild(textArea);
}

// 成功メッセージ表示
function showSuccess(message) {
    showNotification(message, 'success');
}

// エラーメッセージ表示
function showError(message) {
    showNotification(message, 'error');
}

// 通知表示
function showNotification(message, type = 'info') {
    // 既存の通知を削除
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    // 通知要素作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // スタイル設定
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 25px',
        borderRadius: '25px',
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        zIndex: '9999',
        transform: 'translateX(400px)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // タイプ別色設定
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)';
    }
    
    // DOM追加
    document.body.appendChild(notification);
    
    // アニメーション
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 自動削除
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// モーダル外クリックで閉じる
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'createModal') {
            closeModal();
        } else if (e.target.id === 'detailModal') {
            closeDetailModal();
        }
    }
});