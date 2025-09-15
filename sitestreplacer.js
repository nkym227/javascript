/**
 * SiTest代替DOM差し替えスニペット
 * SiTestを使わずに同様のDOM差し替えを再現するためのJavaScript
 */

class SiTestReplacer {
  constructor(options = {}) {
    this.options = {
      // デフォルト設定
      attributeName: 'data-sitest-type',
      baseUrl: options.baseUrl || '', // HTMLファイルのベースURL
      waitTime: options.waitTime || 500, // 追加待機時間（ミリ秒）
      debug: options.debug || false,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      previewMode: options.previewMode || this.getPreviewModeFromURL(),
      previewPosition: options.previewPosition || 'top-right', // top-left, top-right, center, bottom-left, bottom-right
      ...options
    };
    
    this.isProcessing = false;
    this.processedElements = new Set();
    this.previewOverlays = new Set();
    
    // プレビューモード用のスタイルを追加
    if (this.options.previewMode) {
      this.addPreviewStyles();
    }
  }

  /**
   * URLパラメータからプレビューモードを判定
   */
  getPreviewModeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('preview') || urlParams.has('delivery') || urlParams.has('sitest-preview');
  }

  /**
   * プレビューモード用のスタイルを追加
   */
  addPreviewStyles() {
    const style = document.createElement('style');
    style.id = 'sitest-preview-styles';
    style.textContent = `
      .sitest-preview-highlight {
        position: relative !important;
        outline: 3px dashed #ff6b35 !important;
        background-color: rgba(255, 107, 53, 0.1) !important;
        animation: sitest-pulse 2s infinite !important;
      }
      
      .sitest-preview-highlight.remove-target {
        outline-color: #e74c3c !important;
        background-color: rgba(231, 76, 60, 0.1) !important;
      }
      
      @keyframes sitest-pulse {
        0%, 100% { outline-width: 3px; }
        50% { outline-width: 5px; }
      }
      
      .sitest-preview-overlay {
        position: fixed !important;
        z-index: 10000 !important;
        background: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 12px 16px !important;
        border-radius: 8px !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        max-width: 300px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
        border: 2px solid #ff6b35 !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
      }
      
      .sitest-preview-overlay:hover {
        background: rgba(0, 0, 0, 0.95) !important;
        transform: scale(1.02) !important;
      }
      
      .sitest-preview-overlay.remove-type {
        border-color: #e74c3c !important;
      }
      
      .sitest-preview-overlay-header {
        font-weight: bold !important;
        margin-bottom: 8px !important;
        color: #ff6b35 !important;
        font-size: 12px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      .sitest-preview-overlay.remove-type .sitest-preview-overlay-header {
        color: #e74c3c !important;
      }
      
      .sitest-preview-overlay-content {
        margin-bottom: 8px !important;
      }
      
      .sitest-preview-overlay-url {
        font-size: 12px !important;
        color: #bbb !important;
        word-break: break-all !important;
      }
      
      .sitest-preview-overlay-close {
        position: absolute !important;
        top: 4px !important;
        right: 8px !important;
        color: #ccc !important;
        font-weight: bold !important;
        cursor: pointer !important;
        font-size: 16px !important;
        line-height: 1 !important;
      }
      
      .sitest-preview-overlay-close:hover {
        color: white !important;
      }
      
      /* 位置クラス */
      .sitest-preview-top-left { top: 20px !important; left: 20px !important; }
      .sitest-preview-top-right { top: 20px !important; right: 20px !important; }
      .sitest-preview-center { 
        top: 50% !important; 
        left: 50% !important; 
        transform: translate(-50%, -50%) !important; 
      }
      .sitest-preview-center:hover {
        transform: translate(-50%, -50%) scale(1.02) !important;
      }
      .sitest-preview-bottom-left { bottom: 20px !important; left: 20px !important; }
      .sitest-preview-bottom-right { bottom: 20px !important; right: 20px !important; }
    `;
    document.head.appendChild(style);
    this.log('Preview styles added');
  }

  /**
   * ログ出力（デバッグモード時のみ）
   */
  log(...args) {
    if (this.options.debug) {
      console.log('[SiTestReplacer]', ...args);
    }
  }

  /**
   * エラーログ出力
   */
  error(...args) {
    console.error('[SiTestReplacer]', ...args);
  }

  /**
   * HTMLファイルを取得
   */
  async fetchHTML(url, retryCount = 0) {
    try {
      const fullUrl = this.options.baseUrl + url;
      this.log(`Fetching HTML from: ${fullUrl}`);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/html; charset=utf-8'
        },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      this.log(`Successfully fetched HTML (${html.length} characters)`);
      return html;

    } catch (error) {
      this.error(`Failed to fetch HTML from ${url}:`, error);
      
      // リトライ処理
      if (retryCount < this.options.retryCount) {
        this.log(`Retrying... (${retryCount + 1}/${this.options.retryCount})`);
        await this.delay(this.options.retryDelay);
        return this.fetchHTML(url, retryCount + 1);
      }
      
      throw error;
    }
  }

  /**
   * 遅延処理
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * プレビューモード用のハイライトとオーバーレイを作成
   */
  createPreviewHighlight(element, type, htmlUrl) {
    // 要素をハイライト
    element.classList.add('sitest-preview-highlight');
    if (type.toLowerCase() === 'remove') {
      element.classList.add('remove-target');
    }

    // オーバーレイを作成
    const overlay = document.createElement('div');
    overlay.className = `sitest-preview-overlay sitest-preview-${this.options.previewPosition}`;
    
    if (type.toLowerCase() === 'remove') {
      overlay.classList.add('remove-type');
    }

    const typeText = this.getTypeDisplayText(type);
    const actionText = type.toLowerCase() === 'remove' ? '削除予定' : '差し替え予定';
    
    overlay.innerHTML = `
      <div class="sitest-preview-overlay-close">&times;</div>
      <div class="sitest-preview-overlay-header">${actionText}</div>
      <div class="sitest-preview-overlay-content">
        <strong>タイプ:</strong> ${typeText}<br>
        ${htmlUrl ? `<strong>ファイル:</strong> ${htmlUrl.split('/').pop()}` : '<strong>アクション:</strong> 要素を削除'}
      </div>
      ${htmlUrl ? `<div class="sitest-preview-overlay-url">${htmlUrl}</div>` : ''}
    `;

    // クローズボタンのイベント
    const closeBtn = overlay.querySelector('.sitest-preview-overlay-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removePreviewOverlay(overlay, element);
    });

    // オーバーレイクリックでHTMLプレビュー（削除以外）
    if (htmlUrl && type.toLowerCase() !== 'remove') {
      overlay.addEventListener('click', () => {
        this.showHTMLPreview(htmlUrl, type);
      });
      overlay.style.cursor = 'pointer';
      overlay.title = 'クリックでHTMLプレビューを表示';
    }

    // 要素クリックでオーバーレイ表示/非表示
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = overlay.style.display !== 'none';
      overlay.style.display = isVisible ? 'none' : 'block';
    });

    document.body.appendChild(overlay);
    this.previewOverlays.add(overlay);
    
    this.log(`Preview highlight created for ${type} element`);
  }

  /**
   * タイプの表示テキストを取得
   */
  getTypeDisplayText(type) {
    const typeMap = {
      'outerhtml': 'outerHTML（要素全体置換）',
      'outer': 'outerHTML（要素全体置換）',
      'innerhtml': 'innerHTML（内容置換）',
      'inner': 'innerHTML（内容置換）',
      'insertafter': 'insertAfter（後に挿入）',
      'after': 'insertAfter（後に挿入）',
      'insertbefore': 'insertBefore（前に挿入）',
      'before': 'insertBefore（前に挿入）',
      'remove': 'remove（要素削除）'
    };
    return typeMap[type.toLowerCase()] || type;
  }

  /**
   * HTMLプレビューを表示
   */
  async showHTMLPreview(htmlUrl, type) {
    try {
      const html = await this.fetchHTML(htmlUrl);
      const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HTMLプレビュー - ${htmlUrl}</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              background: #f5f5f5;
            }
            .preview-header { 
              background: #333; 
              color: white; 
              padding: 15px; 
              margin-bottom: 20px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .preview-info {
              font-size: 14px;
              margin-bottom: 10px;
            }
            .preview-content { 
              padding: 20px; 
              background: white;
              margin: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
          </style>
        </head>
        <body>
          <div class="preview-header">
            <h2>📄 HTMLプレビュー</h2>
            <div class="preview-info">
              <strong>ファイル:</strong> ${htmlUrl}<br>
              <strong>差し替えタイプ:</strong> ${this.getTypeDisplayText(type)}
            </div>
          </div>
          <div class="preview-content">
            ${html}
          </div>
        </body>
        </html>
      `);
      previewWindow.document.close();
    } catch (error) {
      alert(`HTMLプレビューの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * プレビューオーバーレイを削除
   */
  removePreviewOverlay(overlay, element) {
    overlay.remove();
    this.previewOverlays.delete(overlay);
    element.classList.remove('sitest-preview-highlight', 'remove-target');
  }

  /**
   * DOM要素を差し替え（プレビューモード対応）
   */
  async replaceElement(element, type, htmlUrl) {
    try {
      // 重複処理防止
      const elementId = element.dataset.sitestId || Math.random().toString(36);
      if (this.processedElements.has(elementId)) {
        this.log('Element already processed, skipping:', elementId);
        return;
      }
      element.dataset.sitestId = elementId;

      this.log(`Processing element with type: ${type}${htmlUrl ? ', URL: ' + htmlUrl : ' (remove)'}`);
      
      // プレビューモードの場合はハイライト表示のみ
      if (this.options.previewMode) {
        this.createPreviewHighlight(element, type, htmlUrl);
        this.processedElements.add(elementId);
        return;
      }
      
      // HTMLを取得（削除タイプ以外）
      const html = htmlUrl ? await this.fetchHTML(htmlUrl) : null;

      // 削除タイプの場合はHTMLファイル不要
      if (type.toLowerCase() === 'remove') {
        this.log('Removing element');
        element.remove();
        this.processedElements.add(elementId);
        this.log(`Successfully removed element: ${elementId}`);
        return;
      }

      // 差し替え実行（HTMLをそのまま使用）
      switch (type.toLowerCase()) {
        case 'outerhtml':
        case 'outer':
          this.log('Replacing with outerHTML');
          element.outerHTML = html;
          break;
          
        case 'innerhtml':
        case 'inner':
          this.log('Replacing with innerHTML');
          element.innerHTML = html;
          break;
          
        case 'insertafter':
        case 'after':
          this.log('Inserting after element');
          element.insertAdjacentHTML('afterend', html);
          break;
          
        case 'insertbefore':
        case 'before':
          this.log('Inserting before element');
          element.insertAdjacentHTML('beforebegin', html);
          break;
          
        default:
          throw new Error(`Unknown replacement type: ${type}`);
      }
      
      this.processedElements.add(elementId);
      this.log(`Successfully processed element: ${elementId}`);
      
    } catch (error) {
      this.error(`Failed to replace element:`, error);
      // エラー時も処理済みとしてマーク（無限ループ防止）
      const elementId = element.dataset.sitestId || Math.random().toString(36);
      this.processedElements.add(elementId);
    }
  }

  /**
   * 対象要素を検索・処理（DOM上の順序で実行）
   */
  async processElements() {
    if (this.isProcessing) {
      this.log('Already processing, skipping...');
      return;
    }

    this.isProcessing = true;
    this.log(`Starting DOM ${this.options.previewMode ? 'preview' : 'replacement'} process`);

    try {
      // 対象要素を検索（DOM上の順序で取得）
      const elements = document.querySelectorAll(`[${this.options.attributeName}]`);
      this.log(`Found ${elements.length} elements to process`);

      // プレビューモードの場合は情報表示
      if (this.options.previewMode && elements.length > 0) {
        this.showPreviewModeInfo(elements.length);
      }

      // 順次処理で差し替え実行（DOM上の順序を保持）
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const type = element.getAttribute(this.options.attributeName);
        const htmlUrl = element.getAttribute('data-sitest-url') || element.getAttribute('data-html-url');
        
        // 削除タイプの場合はHTMLファイル不要
        if (type && type.toLowerCase() === 'remove') {
          await this.replaceElement(element, type, null);
          continue;
        }
        
        if (!htmlUrl) {
          this.error('No HTML URL specified for element:', element);
          continue;
        }
        
        await this.replaceElement(element, type, htmlUrl);
      }

      this.log(`DOM ${this.options.previewMode ? 'preview' : 'replacement'} process completed`);
      
    } catch (error) {
      this.error('Error during processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * プレビューモードの情報を表示
   */
  showPreviewModeInfo(elementCount) {
    const infoOverlay = document.createElement('div');
    infoOverlay.className = 'sitest-preview-overlay sitest-preview-top-left';
    infoOverlay.style.background = 'rgba(0, 123, 255, 0.9)';
    infoOverlay.style.borderColor = '#007bff';
    infoOverlay.style.maxWidth = '350px';
    
    infoOverlay.innerHTML = `
      <div class="sitest-preview-overlay-close">&times;</div>
      <div class="sitest-preview-overlay-header" style="color: #87ceeb;">📋 プレビューモード</div>
      <div class="sitest-preview-overlay-content">
        <strong>${elementCount}個</strong>の差し替え対象を検出しました<br><br>
        🔸 <strong>オレンジ枠:</strong> 差し替え予定要素<br>
        🔸 <strong>赤枠:</strong> 削除予定要素<br>
        🔸 <strong>要素クリック:</strong> 詳細表示<br>
        🔸 <strong>オーバーレイクリック:</strong> HTMLプレビュー
      </div>
    `;

    const closeBtn = infoOverlay.querySelector('.sitest-preview-overlay-close');
    closeBtn.addEventListener('click', () => {
      infoOverlay.remove();
    });

    // 10秒後に自動削除
    setTimeout(() => {
      if (infoOverlay.parentNode) {
        infoOverlay.remove();
      }
    }, 10000);

    document.body.appendChild(infoOverlay);
  }

  /**
   * DOMの安定を待って処理開始
   */
  async init() {
    this.log('Initializing SiTestReplacer...');

    // DOMContentLoaded を待つ
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // window.onload を待つ
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve, { once: true });
      });
    }

    // 追加の待機時間
    if (this.options.waitTime > 0) {
      this.log(`Waiting additional ${this.options.waitTime}ms for DOM stability...`);
      await this.delay(this.options.waitTime);
    }

    // 処理開始
    await this.processElements();
  }

  /**
   * 手動で処理を実行
   */
  async execute() {
    await this.processElements();
  }

  /**
   * 処理状態をリセット
   */
  reset() {
    this.processedElements.clear();
    this.isProcessing = false;
    
    // プレビューオーバーレイを削除
    this.previewOverlays.forEach(overlay => {
      overlay.remove();
    });
    this.previewOverlays.clear();
    
    // ハイライトクラスを削除
    document.querySelectorAll('.sitest-preview-highlight').forEach(element => {
      element.classList.remove('sitest-preview-highlight', 'remove-target');
    });
    
    this.log('SiTestReplacer state reset');
  }
}

// 使用例とデフォルト初期化
(function() {
  'use strict';
  
  // デフォルト設定で自動初期化
  const replacer = new SiTestReplacer({
    baseUrl: '', // 必要に応じて設定
    waitTime: 500,
    debug: true, // 本番環境では false に設定
    retryCount: 3
  });

  // 自動実行（init不要）
  replacer.init().catch(error => {
    console.error('[SiTestReplacer] Initialization failed:', error);
  });

  // グローバルに公開（手動実行用）
  window.SiTestReplacer = SiTestReplacer;
  window.sitestReplacer = replacer;
  
  // 便利メソッドをグローバルに追加
  window.sitestExecute = () => replacer.execute();
  window.sitestReset = () => replacer.reset();
  
  // カスタム設定用の簡単な関数も提供
  window.sitestInit = (options = {}) => {
    if (window.sitestReplacer) {
      window.sitestReplacer.reset();
    }
    const customReplacer = new SiTestReplacer(options);
    customReplacer.init();
    window.sitestReplacer = customReplacer;
    return customReplacer;
  };
  
  // プレビューモードかどうかを確認する関数
  window.sitestIsPreview = () => replacer.options.previewMode;
  
})();

/*
使用方法:

【自動動作（推奨）】
スクリプトを読み込むだけで自動実行されます:
<script src="sitest-replacer.js"></script>
<!-- init()不要！ -->

【URLパラメータでプレビューモード】
- example.com/page.html?preview
- example.com/page.html?delivery  
- example.com/page.html?sitest-preview

【HTML側での指定例】
<div data-sitest-type="outerHTML" data-sitest-url="replacement.html">
  元のコンテンツ
</div>

<div data-sitest-type="remove">
  この要素は削除される
</div>

【便利な関数（グローバル）】
sitestExecute()     // 手動実行
sitestReset()       // 状態リセット
sitestIsPreview()   // プレビューモードか確認

【カスタム設定（必要な場合のみ）】
sitestInit({
  baseUrl: '/custom-path/',
  debug: false,
  previewPosition: 'center'
});

【従来通りの使い方】
const customReplacer = new SiTestReplacer({
  baseUrl: '/path/to/html/files/',
  previewMode: true
});
// customReplacer.init(); // これも不要！自動実行されます
*/
