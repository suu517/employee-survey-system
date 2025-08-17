// 調査システムのJavaScript

let currentPage = 1;
const totalPages = 12;
let surveyData = {};

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 調査開始時刻を記録
    if (!sessionStorage.getItem('survey_start_time')) {
        sessionStorage.setItem('survey_start_time', new Date().toISOString());
        sessionStorage.setItem('survey_start_timestamp', Date.now().toString());
    }
    
    updateProgress();
    setupEventListeners();
    loadFromLocalStorage();
    initializeCharCounters();
    console.log('📊 従業員満足度調査システムが開始されました');
});

// 文字数カウンターの初期化
function initializeCharCounters() {
    document.querySelectorAll('textarea').forEach(textarea => {
        updateCharCounter(textarea);
    });
}

// イベントリスナーの設定
function setupEventListeners() {
    // ラジオボタンとチェックボックスの選択時ハイライト
    document.addEventListener('change', function(e) {
        if (e.target.type === 'radio') {
            highlightSelectedOption(e.target);
        }
    });

    // 評価スケールのホバーエフェクト
    document.querySelectorAll('.scale-option').forEach(option => {
        option.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
        });
        
        option.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });

    // 自動保存機能（ローカルストレージ）
    document.addEventListener('input', function(e) {
        if (e.target.name) {
            saveToLocalStorage(e.target.name, e.target.value);
            
            // テキストエリアの文字数カウント
            if (e.target.tagName.toLowerCase() === 'textarea') {
                updateCharCounter(e.target);
            }
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.name) {
            saveToLocalStorage(e.target.name, e.target.value);
        }
    });

    // ページ離脱時の警告
    window.addEventListener('beforeunload', function(e) {
        if (currentPage > 1 && currentPage < totalPages) {
            e.preventDefault();
            e.returnValue = '調査が完了していません。ページを離脱しますか？';
        }
    });
}

// 選択されたオプションのハイライト
function highlightSelectedOption(input) {
    const container = input.closest('.radio-group') || input.closest('.scale-options');
    if (container) {
        container.querySelectorAll('.radio-option, .scale-option').forEach(option => {
            option.classList.remove('selected');
        });
        input.closest('.radio-option, .scale-option').classList.add('selected');
    }
}

// ローカルストレージへの保存
function saveToLocalStorage(key, value) {
    try {
        let savedData = JSON.parse(localStorage.getItem('surveyData')) || {};
        savedData[key] = value;
        savedData.last_updated = new Date().toISOString();
        localStorage.setItem('surveyData', JSON.stringify(savedData));
    } catch (error) {
        console.warn('ローカルストレージへの保存に失敗しました:', error);
    }
}

// 文字数カウンターの更新
function updateCharCounter(textarea) {
    const container = textarea.closest('.textarea-container');
    if (!container) return;
    
    const counter = container.querySelector('.char-counter');
    if (!counter) return;
    
    const currentCharsSpan = counter.querySelector('.current-chars');
    const minCharsSpan = counter.querySelector('.min-chars');
    
    const currentLength = textarea.value.length;
    const minLength = parseInt(textarea.getAttribute('minlength')) || 0;
    const maxLength = parseInt(textarea.getAttribute('maxlength')) || 1000;
    
    if (currentCharsSpan) {
        currentCharsSpan.textContent = currentLength;
    }
    
    // カウンターの色分け
    counter.className = 'char-counter';
    if (minLength > 0) {
        if (currentLength < minLength) {
            counter.classList.add('error');
        } else if (currentLength >= minLength && currentLength <= maxLength * 0.8) {
            counter.classList.add('valid');
        } else if (currentLength > maxLength * 0.8) {
            counter.classList.add('warning');
        }
    } else {
        if (currentLength > maxLength * 0.8) {
            counter.classList.add('warning');
        }
    }
}

// ローカルストレージからの復元
function loadFromLocalStorage() {
    try {
        const savedData = JSON.parse(localStorage.getItem('surveyData')) || {};
        
        Object.keys(savedData).forEach(key => {
            const elements = document.querySelectorAll(`[name="${key}"]`);
            elements.forEach(element => {
                if (element.type === 'radio') {
                    if (element.value === savedData[key]) {
                        element.checked = true;
                        highlightSelectedOption(element);
                    }
                } else {
                    element.value = savedData[key];
                }
            });
        });
        
        console.log('💾 保存されたデータを復元しました');
    } catch (error) {
        console.warn('ローカルストレージからの復元に失敗しました:', error);
    }
}

// プログレスの更新
function updateProgress() {
    const progress = (currentPage / totalPages) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = Math.round(progress) + '%';
    document.getElementById('pageIndicator').textContent = `${currentPage}/${totalPages}`;
}

// 次のページへ
function nextPage() {
    if (!validateCurrentPage()) {
        showValidationError();
        return;
    }

    saveCurrentPageData();
    
    if (currentPage < totalPages) {
        // 現在のページを非表示
        document.getElementById(`page${currentPage}`).classList.remove('active');
        
        currentPage++;
        
        // 次のページを表示
        document.getElementById(`page${currentPage}`).classList.add('active');
        
        // データ復元
        loadFromLocalStorage();
        
        // ページ12の場合は動的ラベルを更新
        if (currentPage === 12) {
            updatePage9Labels();
        }
        
        updateProgress();
        updateNavigationButtons();
        scrollToTop();
        
        console.log(`📄 ページ ${currentPage} に移動しました`);
    }
}

// 前のページへ
function previousPage() {
    if (currentPage > 1) {
        // 現在のページを非表示
        document.getElementById(`page${currentPage}`).classList.remove('active');
        
        currentPage--;
        
        // 前のページを表示
        document.getElementById(`page${currentPage}`).classList.add('active');
        
        // データ復元
        loadFromLocalStorage();
        
        // ページ12の場合は動的ラベルを更新
        if (currentPage === 12) {
            updatePage9Labels();
        }
        
        updateProgress();
        updateNavigationButtons();
        scrollToTop();
        
        console.log(`📄 ページ ${currentPage} に戻りました`);
    }
}

// ナビゲーションボタンの表示制御
function updateNavigationButtons() {
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const submitButton = document.getElementById('submitButton');
    
    // 前へボタン
    prevButton.style.display = currentPage > 1 ? 'block' : 'none';
    
    // 次へボタンと送信ボタン
    if (currentPage === totalPages) {
        nextButton.style.display = 'none';
        submitButton.style.display = 'block';
    } else {
        nextButton.style.display = 'block';
        submitButton.style.display = 'none';
    }
}

// 現在のページの入力検証
function validateCurrentPage() {
    const currentPageElement = document.getElementById(`page${currentPage}`);
    const requiredInputs = currentPageElement.querySelectorAll('[required]');
    
    let isValid = true;
    
    requiredInputs.forEach(input => {
        if (input.type === 'radio') {
            const radioGroup = currentPageElement.querySelectorAll(`[name="${input.name}"]`);
            const isChecked = Array.from(radioGroup).some(radio => radio.checked);
            if (!isChecked) {
                isValid = false;
                highlightError(input);
            }
        } else if (!input.value.trim()) {
            isValid = false;
            highlightError(input);
        }
    });
    
    return isValid;
}

// エラーハイライト
function highlightError(input) {
    if (input.type === 'radio') {
        const container = input.closest('.question-group');
        container.style.borderColor = '#ef4444';
        container.style.backgroundColor = '#fef2f2';
    } else {
        input.style.borderColor = '#ef4444';
        input.style.backgroundColor = '#fef2f2';
    }
    
    setTimeout(() => {
        if (input.type === 'radio') {
            const container = input.closest('.question-group');
            container.style.borderColor = '#e5e7eb';
            container.style.backgroundColor = '#fafafa';
        } else {
            input.style.borderColor = '#d1d5db';
            input.style.backgroundColor = 'white';
        }
    }, 3000);
}

// バリデーションエラー表示
function showValidationError() {
    // 既存のエラーメッセージを削除
    const existingError = document.querySelector('.validation-error');
    if (existingError) {
        existingError.remove();
    }
    
    // エラーメッセージを作成
    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-error';
    errorDiv.innerHTML = `
        <div style="
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
            animation: shake 0.5s ease-in-out;
        ">
            ⚠️ 必須項目が未入力です。すべての項目にご回答ください。
        </div>
    `;
    
    const navigationButtons = document.querySelector('.navigation-buttons');
    navigationButtons.parentNode.insertBefore(errorDiv, navigationButtons);
    
    // 3秒後に自動削除
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// 現在のページのデータを保存
function saveCurrentPageData() {
    const currentPageElement = document.getElementById(`page${currentPage}`);
    const inputs = currentPageElement.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.type === 'radio') {
            if (input.checked) {
                surveyData[input.name] = input.value;
            }
        } else {
            surveyData[input.name] = input.value;
        }
    });
}

// ページトップにスクロール
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 調査の送信
async function submitSurvey() {
    if (!validateCurrentPage()) {
        showValidationError();
        return;
    }

    // 最終ページのデータを保存
    saveCurrentPageData();
    
    // 送信確認
    const confirmSubmit = confirm('調査を送信しますか？送信後は回答内容を変更できません。');
    if (!confirmSubmit) {
        return;
    }
    
    // 送信ボタンを無効化
    const submitButton = document.getElementById('submitButton');
    const originalText = submitButton.textContent;
    submitButton.textContent = '送信中...';
    submitButton.disabled = true;
    
    try {
        // 送信データの準備
        const submissionData = {
            ...surveyData,
            submission_time: new Date().toISOString(),
            user_agent: navigator.userAgent,
            page_load_time: Date.now(),
            response_start_time: sessionStorage.getItem('survey_start_time') || new Date().toISOString(),
            response_duration: Date.now() - (parseInt(sessionStorage.getItem('survey_start_timestamp')) || Date.now()),
            last_updated: surveyData.last_updated || new Date().toISOString()
        };
        
        console.log('📤 調査データを送信中:', submissionData);
        
        // 実際のAPI送信
        await submitToServer(submissionData);
        
        // ローカルストレージをクリア
        localStorage.removeItem('surveyData');
        
        // 完了モーダルを表示
        document.getElementById('completionModal').style.display = 'flex';
        
        console.log('✅ 調査が正常に送信されました');
        
    } catch (error) {
        console.error('❌ 調査の送信に失敗しました:', error);
        alert('送信に失敗しました。もう一度お試しください。');
        
        // ボタンを復元
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// 実際のAPI送信
async function submitToServer(data) {
    try {
        // トークンがある場合は追加
        if (window.SURVEY_TOKEN) {
            data.survey_token = window.SURVEY_TOKEN;
        }
        
        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('送信エラー:', error);
        throw error;
    }
}

// 送信のシミュレーション（開発用フォールバック）
async function simulateSubmission(data) {
    // 2秒の遅延でAPI送信をシミュレート
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 90%の確率で成功
            if (Math.random() > 0.1) {
                resolve({ success: true, id: Date.now() });
            } else {
                reject(new Error('Network error'));
            }
        }, 2000);
    });
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('completionModal').style.display = 'none';
    
    // 5秒後にページをリロード
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// ページ読み込み完了後の初期設定
window.addEventListener('load', function() {
    loadFromLocalStorage();
    updateNavigationButtons();
    
    // CSSアニメーションの追加
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        
        .scale-option {
            transition: transform 0.2s ease, border-color 0.3s ease;
        }
        
        .validation-error {
            animation: fadeInDown 0.5s ease;
        }
        
        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
});

// デバッグ用: 現在の調査データを表示
function debugShowData() {
    console.log('🔍 現在の調査データ:', surveyData);
    console.log('🔍 ローカルストレージ:', JSON.parse(localStorage.getItem('surveyData') || '{}'));
}

// その他入力欄の表示/非表示を制御
function toggleOtherInput(selectElement, otherInputId) {
    const otherInput = document.getElementById(otherInputId);
    if (selectElement.value === 'その他') {
        otherInput.style.display = 'block';
        otherInput.required = true;
    } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

// 管理者用: 特定のページにジャンプ（開発・テスト用）
function jumpToPage(pageNumber) {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
        document.getElementById(`page${currentPage}`).classList.remove('active');
        currentPage = pageNumber;
        document.getElementById(`page${currentPage}`).classList.add('active');
        updateProgress();
        updateNavigationButtons();
        loadFromLocalStorage();
        console.log(`🔧 ページ ${pageNumber} にジャンプしました（デバッグ機能）`);
    }
}

// 項目名の日本語表示マッピング
const itemDisplayNames = {
    // ページ5: 働き方・時間の柔軟性
    'vacation_satisfaction': '有給休暇がちゃんと取れる職場',
    'flexible_work_satisfaction': '時間や場所など働き方に柔軟性のある職場',
    'commute_satisfaction': '自宅から適切な距離で働ける職場',
    
    // ページ6: 労働条件・待遇
    'overtime_pay_satisfaction': '残業したらその分しっかり給与が支払われる職場',
    'workload_satisfaction': '自分のキャパシティに合った量の仕事で働ける職場',
    'physical_load_satisfaction': '仕事内容や量に対する身体的な負荷が少ない職場',
    'mental_load_satisfaction': '仕事内容や量に対する精神的な負荷が少ない職場',
    'benefits_satisfaction': '充実した福利厚生がある職場',
    'promotion_satisfaction': '成果に応じて早期の昇給・昇格が望める職場',
    'fair_evaluation_satisfaction': '自身の行った仕事が正当に評価される職場',
    'fair_salary_satisfaction': '同年代や同じ能力の人と比べて妥当な給与がもらえる職場',
    
    // ページ7: キャリア・スキル形成
    'professional_skill_satisfaction': '専門的なスキルや技術・知識や経験を獲得できる職場',
    'general_skill_satisfaction': '汎用的なスキル（コミュニケーション能力や論理的思考力など）や技術・知識・経験を獲得できる職場',
    'education_satisfaction': '整った教育体制がある職場',
    'career_path_satisfaction': '自分に合った将来のキャリアパスをしっかり設計している職場',
    'career_direction_satisfaction': '将来自分のなりたいもしくはやりたい方向性とマッチした仕事を任せてもらえる職場',
    'role_model_satisfaction': '身近にロールモデルとなるような人がいる職場',
    
    // ページ8: 仕事内容・やりがい、人間関係・組織・経営基盤
    'pride_satisfaction': '誇りやプライドを持てるような仕事内容を提供してくれる職場',
    'social_contribution_satisfaction': '社会に対して貢献実感を持てるような仕事を任せてもらえる職場',
    'fulfillment_satisfaction': 'やりがいを感じられるような仕事を任せてもらえる職場',
    'autonomy_satisfaction': '自分の判断で進められる裁量のある仕事ができる職場',
    'relationship_satisfaction': '人間関係が良好な職場',
    'harassment_prevention_satisfaction': 'セクハラやパワハラがないような職場',
    'open_communication_satisfaction': '意見や考え方などについて自由に言い合える風通しの良い職場',
    'company_stability_satisfaction': '事業基盤について安心感のある職場',
    'compliance_satisfaction': '法令遵守が整った職場',
    'work_environment_satisfaction': '働きやすい仕事環境やオフィス環境の職場',
    'gender_friendly_satisfaction': '女性が働きやすい職場'
};

// 期待度項目の日本語表示マッピング
const expectationDisplayNames = {
    // ページ5: 働き方・時間の柔軟性
    'vacation_expectation': '有給休暇がちゃんと取れる職場',
    'flexible_work_expectation': '時間や場所など働き方に柔軟性のある職場',
    'commute_expectation': '自宅から適切な距離で働ける職場',
    
    // ページ6: 労働条件・待遇
    'overtime_pay_expectation': '残業したらその分しっかり給与が支払われる職場',
    'workload_expectation': '自分のキャパシティに合った量の仕事で働ける職場',
    'physical_load_expectation': '仕事内容や量に対する身体的な負荷が少ない職場',
    'mental_load_expectation': '仕事内容や量に対する精神的な負荷が少ない職場',
    'benefits_expectation': '充実した福利厚生がある職場',
    'promotion_expectation': '成果に応じて早期の昇給・昇格が望める職場',
    'fair_evaluation_expectation': '自身の行った仕事が正当に評価される職場',
    'fair_salary_expectation': '同年代や同じ能力の人と比べて妥当な給与がもらえる職場',
    
    // ページ7: キャリア・スキル形成
    'professional_skill_expectation': '専門的なスキルや技術・知識や経験を獲得できる職場',
    'general_skill_expectation': '汎用的なスキル（コミュニケーション能力や論理的思考力など）や技術・知識・経験を獲得できる職場',
    'education_expectation': '整った教育体制がある職場',
    'career_path_expectation': '自分に合った将来のキャリアパスをしっかり設計している職場',
    'career_direction_expectation': '将来自分のなりたいもしくはやりたい方向性とマッチした仕事を任せてもらえる職場',
    'role_model_expectation': '身近にロールモデルとなるような人がいる職場',
    
    // ページ8: 仕事内容・やりがい、人間関係・組織・経営基盤
    'pride_expectation': '誇りやプライドを持てるような仕事内容を提供してくれる職場',
    'social_contribution_expectation': '社会に対して貢献実感を持てるような仕事を任せてもらえる職場',
    'fulfillment_expectation': 'やりがいを感じられるような仕事を任せてもらえる職場',
    'autonomy_expectation': '自分の判断で進められる裁量のある仕事ができる職場',
    'relationship_expectation': '人間関係が良好な職場',
    'harassment_prevention_expectation': 'セクハラやパワハラがないような職場',
    'open_communication_expectation': '意見や考え方などについて自由に言い合える風通しの良い職場',
    'company_stability_expectation': '事業基盤について安心感のある職場',
    'compliance_expectation': '法令遵守が整った職場',
    'work_environment_expectation': '働きやすい仕事環境やオフィス環境の職場',
    'gender_friendly_expectation': '女性が働きやすい職場'
};

// 満足度・期待度のスコアを数値に変換
function getScoreFromValue(value) {
    if (!value) return 0;
    
    // 満足度の場合
    if (value === '満足していない') return 1;
    if (value === 'どちらかと言えば満足していない') return 2;
    if (value === 'どちらとも言えない') return 3;
    if (value === 'どちらかと言えば満足している') return 4;
    if (value === '満足している') return 5;
    
    // 期待度の場合
    if (value === '今の会社には期待していない') return 1;
    if (value === '今の会社にはどちらかと言えば期待していない') return 2;
    if (value === 'どちらとも言えない') return 3;
    if (value === '今の会社にはどちらかと言えば期待している') return 4;
    if (value === '今の会社には期待している') return 5;
    
    return 0;
}

// 最高・最低評価の項目を取得
function getTopRatedItems() {
    const satisfactionScores = {};
    const expectationScores = {};
    
    // ローカルストレージから最新のデータを取得
    const savedData = JSON.parse(localStorage.getItem('surveyData')) || {};
    
    // 満足度スコアを収集
    Object.keys(savedData).forEach(key => {
        if (key.includes('_satisfaction') && itemDisplayNames[key]) {
            const score = getScoreFromValue(savedData[key]);
            if (score > 0) {
                satisfactionScores[key] = {
                    score: score,
                    name: itemDisplayNames[key]
                };
            }
        }
        if (key.includes('_expectation') && expectationDisplayNames[key]) {
            const score = getScoreFromValue(savedData[key]);
            if (score > 0) {
                expectationScores[key] = {
                    score: score,
                    name: expectationDisplayNames[key]
                };
            }
        }
    });
    
    // 最高・最低を見つける
    let highestSatisfaction = null;
    let lowestSatisfaction = null;
    let highestExpectation = null;
    
    let maxSatisfactionScore = 0;
    let minSatisfactionScore = 6;
    let maxExpectationScore = 0;
    
    // 満足度の最高・最低を特定
    Object.keys(satisfactionScores).forEach(key => {
        const item = satisfactionScores[key];
        if (item.score > maxSatisfactionScore) {
            maxSatisfactionScore = item.score;
            highestSatisfaction = item;
        }
        if (item.score < minSatisfactionScore) {
            minSatisfactionScore = item.score;
            lowestSatisfaction = item;
        }
    });
    
    // 期待度の最高を特定
    Object.keys(expectationScores).forEach(key => {
        const item = expectationScores[key];
        if (item.score > maxExpectationScore) {
            maxExpectationScore = item.score;
            highestExpectation = item;
        }
    });
    
    return {
        highestSatisfaction,
        lowestSatisfaction,
        highestExpectation
    };
}

// ページ9の質問ラベルを動的に更新
function updatePage9Labels() {
    const topItems = getTopRatedItems();
    
    // 最も満足度が高い項目
    const highestSatisfactionLabel = document.getElementById('highestSatisfactionLabel');
    if (topItems.highestSatisfaction) {
        highestSatisfactionLabel.innerHTML = `最も満足度が高い項目「${topItems.highestSatisfaction.name}」（満足度：${topItems.highestSatisfaction.score}）について、具体的にお聞かせください`;
    } else {
        highestSatisfactionLabel.innerHTML = '最も満足度が高い項目について、具体的にお聞かせください';
    }
    
    // 最も満足度が低い項目
    const lowestSatisfactionLabel = document.getElementById('lowestSatisfactionLabel');
    if (topItems.lowestSatisfaction) {
        lowestSatisfactionLabel.innerHTML = `最も満足度が低い項目「${topItems.lowestSatisfaction.name}」（満足度：${topItems.lowestSatisfaction.score}）について、改善を求める理由を具体的にお聞かせください`;
    } else {
        lowestSatisfactionLabel.innerHTML = '最も満足度が低い項目について、具体的にお聞かせください';
    }
    
    // 最も期待度が高い項目
    const highestExpectationLabel = document.getElementById('highestExpectationLabel');
    if (topItems.highestExpectation) {
        highestExpectationLabel.innerHTML = `最も期待度が高い項目「${topItems.highestExpectation.name}」（期待度：${topItems.highestExpectation.score}）について、具体的にお聞かせください`;
    } else {
        highestExpectationLabel.innerHTML = '最も期待度が高い項目について、具体的にお聞かせください';
    }
}