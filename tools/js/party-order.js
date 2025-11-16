/**
 * DQウォーク 行動順計算ツール
 * パーティメンバーの行動順が乱れない素早さを計算します
 */

// ========================================
// 定数定義
// ========================================

/**
 * 戦闘タイプごとの行動順安定係数
 * メガモン戦・魔王戦: ±1.2倍の範囲で行動順安定
 * その他の戦い: ±1.14倍の範囲で行動順安定
 */
const BATTLE_FACTORS = {
    NORMAL: 1.14,    // その他の戦い
    MEGAMON: 1.2     // メガモン戦・魔王戦
};

/**
 * パーティの人数
 */
const PARTY_SIZE = 4;

/**
 * デフォルトのバフ倍率（%）
 */
const DEFAULT_BUFF_PERCENT = 100;

/**
 * バフ倍率の最小値と最大値（%）
 */
const BUFF_PERCENT_MIN = 50;
const BUFF_PERCENT_MAX = 300;

/**
 * デフォルトの基準素早さ
 */
const DEFAULT_BASE_SPEED = 1000;

/**
 * デフォルトの基準番手
 */
const DEFAULT_BASE_POSITION = 3;

/**
 * アニメーション設定
 */
const ANIMATION = {
    SCROLL_BEHAVIOR: 'smooth'
};

// ========================================
// 計算ユーティリティ関数
// ========================================

/**
 * 除算の結果を切り捨てる
 * @param {number} a - 被除数
 * @param {number} f - 除数
 * @returns {number} 切り捨てた結果
 */
function floorDiv(a, f) {
    return Math.floor(a / f);
}

/**
 * 乗算の結果を切り捨てる
 * @param {number} a - 被乗数
 * @param {number} f - 乗数
 * @returns {number} 切り捨てた結果
 */
function floorMul(a, f) {
    return Math.floor(a * f);
}

// ========================================
// UI関数
// ========================================

/**
 * 折りたたみセクションの開閉を切り替える
 * @param {HTMLElement} header - クリックされたヘッダー要素
 */
function toggleCollapsible(header) {
    const content = header.nextElementSibling;
    const toggle = header.querySelector('.collapsible-toggle');

    content.classList.toggle('collapsed');
    content.classList.toggle('expanded');
    toggle.classList.toggle('collapsed');
}

// ========================================
// 計算ロジック
// ========================================

/**
 * 基準となる番手から各番手の基本素早さを計算
 *
 * 計算ロジック:
 * - 基準より上位の番手: 下の番手 × factor（切り捨て）+ 1
 * - 基準より下位の番手: 上の番手 ÷ factor（切り捨て）- 1
 *
 * @param {number} position - 基準となる番手 (1-4)
 * @param {number} baseSpeed - 基準となる素早さ
 * @param {number} factor - 戦闘タイプの係数 (1.14 or 1.2)
 * @returns {number[]} 各番手の基本素早さの配列 [s1, s2, s3, s4]
 */
function calculateBaseSpeeds(position, baseSpeed, factor) {
    const s = new Array(PARTY_SIZE + 1).fill(0); // 1-indexed array

    s[position] = baseSpeed;

    // 上方向の計算（より上位の番手）
    for (let i = position - 1; i >= 1; i--) {
        s[i] = floorMul(s[i + 1], factor) + 1;
    }

    // 下方向の計算（より下位の番手）
    const minCurr = floorDiv(s[position], factor);
    if (position + 1 <= PARTY_SIZE) {
        s[position + 1] = minCurr - 1;
    }
    for (let j = position + 2; j <= PARTY_SIZE; j++) {
        const minPrev = floorDiv(s[j - 1], factor);
        s[j] = minPrev - 1;
    }

    return s.slice(1, PARTY_SIZE + 1); // 0-indexed array [s1, s2, s3, s4]
}

/**
 * バフを考慮した各番手の基本素早さと実効素早さを計算
 *
 * @param {number} position - 基準となる番手 (1-4)
 * @param {number} baseSpeed - 基準となる素早さ（バフ適用前）
 * @param {number} factor - 戦闘タイプの係数
 * @param {number[]} buffs - 各番手のバフ倍率の配列（小数）[buff1, buff2, buff3, buff4]
 * @returns {Object} 計算結果 { baseSpeeds: number[], effectiveSpeeds: number[] }
 */
function calculateWithBuffs(position, baseSpeed, factor, buffs) {
    // 1. 基準メンバーの実効素早さを計算
    const baseEffectiveSpeed = baseSpeed * buffs[position - 1];

    // 2. 実効素早さベースで順序を計算
    const effectiveSpeeds = calculateBaseSpeeds(position, Math.floor(baseEffectiveSpeed), factor);

    // 3. 各メンバーの基本素早さを逆算
    const baseSpeeds = [];
    for (let i = 0; i < PARTY_SIZE; i++) {
        if (i === position - 1) {
            // 基準メンバーは入力値をそのまま使用
            baseSpeeds[i] = baseSpeed;
        } else {
            // その他のメンバーは実効素早さから基本素早さを逆算
            baseSpeeds[i] = Math.floor(effectiveSpeeds[i] / buffs[i]);
        }
    }

    // 4. 実効素早さを再計算（表示用）
    const finalEffectiveSpeeds = baseSpeeds.map((speed, i) => Math.floor(speed * buffs[i]));

    return {
        baseSpeeds: baseSpeeds,
        effectiveSpeeds: finalEffectiveSpeeds
    };
}

/**
 * 入力値を取得して素早さを計算する
 */
function calculateSpeeds() {
    // 入力値の取得
    const battleType = document.getElementById('battleType').value;
    const position = parseInt(document.getElementById('basePosition').value);
    const baseSpeed = parseInt(document.getElementById('baseSpeed').value);

    // バフ倍率の取得（パーセント値を小数に変換）
    const buffs = [
        parseFloat(document.getElementById('buff1').value) / 100,
        parseFloat(document.getElementById('buff2').value) / 100,
        parseFloat(document.getElementById('buff3').value) / 100,
        parseFloat(document.getElementById('buff4').value) / 100
    ];

    // 入力値の検証
    if (!baseSpeed || baseSpeed <= 0) {
        alert('正しい素早さを入力してください');
        return;
    }

    // 戦闘タイプに応じた係数を取得
    const factor = battleType === 'megamon' ? BATTLE_FACTORS.MEGAMON : BATTLE_FACTORS.NORMAL;

    // 計算実行
    const result = calculateWithBuffs(position, baseSpeed, factor, buffs);

    // 結果を表示
    displayResults(result.baseSpeeds, result.effectiveSpeeds, buffs);
}

/**
 * 計算結果を画面に表示する
 *
 * @param {number[]} baseSpeeds - 各番手の基本素早さ
 * @param {number[]} effectiveSpeeds - 各番手の実効素早さ
 * @param {number[]} buffs - 各番手のバフ倍率（小数）
 */
function displayResults(baseSpeeds, effectiveSpeeds, buffs) {
    const resultGrid = document.getElementById('resultGrid');
    const resultsDiv = document.getElementById('results');

    // 結果エリアをクリア
    resultGrid.innerHTML = '';

    // 各番手の結果を表示
    for (let i = 0; i < PARTY_SIZE; i++) {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        // バフ情報の表示（100%以外の場合のみ）
        const buffPercent = Math.round(buffs[i] * 100);
        const buffText = buffPercent !== DEFAULT_BUFF_PERCENT ? ` (${buffPercent}%)` : '';

        resultItem.innerHTML = `
            <h4>${i + 1}番手${buffText}</h4>
            <div class="base-speed">${baseSpeeds[i]}</div>
            <div class="effective-speed">実効: ${effectiveSpeeds[i]}</div>
        `;

        resultGrid.appendChild(resultItem);
    }

    // 結果エリアを表示してスクロール
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: ANIMATION.SCROLL_BEHAVIOR });
}

// ========================================
// 初期化
// ========================================

/**
 * ページ読み込み時の初期化処理
 */
window.onload = function() {
    // 初期計算を実行
    calculateSpeeds();

    // すべての入力要素に自動計算イベントを設定
    const inputIds = [
        'battleType',
        'basePosition',
        'baseSpeed',
        'buff1',
        'buff2',
        'buff3',
        'buff4'
    ];

    inputIds.forEach(id => {
        const element = document.getElementById(id);
        element.addEventListener('change', calculateSpeeds);
        element.addEventListener('input', calculateSpeeds);
    });
};
