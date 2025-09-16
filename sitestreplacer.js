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
      
      // CSS管理設定
      cssFile: options.cssFile || 'sitest-styles.css', // CSSファイル名
      cssUrl: options.cssUrl || '', // CSSファイルのURL（baseUrlと組み合わせ）
      autoInjectCSS: options.autoInjectCSS !== false, // CSS自動挿入（デフォルトtrue）
      
      ...options
    };

    this.isProcessing = false;
    this.processedElements = new Set();
    this.previewOverlays = new Set();
    this.controlButtons = new Set(); // コントロールボタン管理
    this.originalElements = new Map(); // 元の要素を保存
    this.replacedElements = new Map(); // 差し替え後の要素を保存
    this.originalStyles = new Map(); // 元のスタイルを保存
    
    // 新UI関連
    this.sideMenu = null;
    this.sideMenuCollapsed = false;
    this.elementGroups = new Map(); // 要素グループ管理

    // プレビューモード用のスタイルを追加
    if (this.options.previewMode) {
      this.addPreviewStyles();
    }

    // デバッグ用ログ
    this.log('SiTestReplacer initialized in', this.options.previewMode ? 'PREVIEW' : 'NORMAL', 'mode');
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
      /* === 要素ハイライト === */
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
      
      .sitest-preview-replaced {
        outline: 3px solid #27ae60 !important;
        background-color: rgba(39, 174, 96, 0.1) !important;
      }
      
      @keyframes sitest-pulse {
        0%, 100% { outline-width: 3px; }
        50% { outline-width: 5px; }
      }

      /* === サイドメニュー === */
      .sitest-side-menu {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 350px !important;
        height: 100vh !important;
        background: white !important;
        border-left: 1px solid #e0e0e0 !important;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1) !important;
        z-index: 10000 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        transform: translateX(0) !important;
        transition: transform 0.3s ease !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
      }
      
      .sitest-side-menu.collapsed {
        transform: translateX(350px) !important;
      }

      /* === ヘッダー === */
      .sitest-menu-header {
        background: #f8f9fa !important;
        padding: 15px 20px !important;
        border-bottom: 1px solid #e0e0e0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        flex-shrink: 0 !important;
      }
      
      .sitest-menu-title {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #333 !important;
        margin: 0 !important;
        flex: 1 !important;
      }
      
      .sitest-header-controls {
        display: flex !important;
        gap: 8px !important;
        align-items: center !important;
      }
      
      .sitest-css-btn {
        background: #28a745 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        width: 28px !important;
        height: 28px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 14px !important;
        transition: background 0.2s ease !important;
      }
      
      .sitest-css-btn:hover {
        background: #218838 !important;
      }
      
      .sitest-toggle-btn {
        background: #ff6b35 !important;
        color: white !important;
        border: none !important;
        border-radius: 4px !important;
        width: 28px !important;
        height: 28px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
        font-weight: bold !important;
        transition: background 0.2s ease !important;
      }
      
      .sitest-toggle-btn:hover {
        background: #e55a2b !important;
      }

      /* === コンテンツエリア === */
      .sitest-menu-content {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 0 !important;
      }

      /* === 要素グループ === */
      .sitest-element-group {
        border-bottom: 1px solid #f0f0f0 !important;
        padding: 12px 15px !important;
      }
      
      .sitest-element-info {
        margin-bottom: 8px !important;
      }
      
      .sitest-element-selector {
        font-family: 'Courier New', monospace !important;
        font-size: 11px !important;
        color: #666 !important;
        background: #f8f9fa !important;
        padding: 4px 6px !important;
        border-radius: 3px !important;
        border: 1px solid #e0e0e0 !important;
        margin-bottom: 4px !important;
        word-break: break-all !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      
      .sitest-element-operations {
        font-size: 10px !important;
        color: #888 !important;
        margin-bottom: 8px !important;
      }

      /* === 操作ボタン === */
      .sitest-control-group {
        display: flex !important;
        gap: 4px !important;
        margin-bottom: 0 !important;
      }
      
      .sitest-control-btn {
        flex: 1 !important;
        padding: 6px 4px !important;
        border: 1px solid #d0d0d0 !important;
        border-radius: 4px !important;
        background: white !important;
        color: #333 !important;
        font-size: 10px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: center !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      
      .sitest-control-btn:hover {
        background: #f8f9fa !important;
        border-color: #ff6b35 !important;
      }
      
      .sitest-control-btn.execute {
        background: #ff6b35 !important;
        color: white !important;
        border-color: #ff6b35 !important;
      }
      
      .sitest-control-btn.execute:hover {
        background: #e55a2b !important;
      }
      
      .sitest-control-btn.revert {
        background: #27ae60 !important;
        color: white !important;
        border-color: #27ae60 !important;
      }
      
      .sitest-control-btn.revert:hover {
        background: #219a52 !important;
      }
      
      .sitest-control-btn.navigate {
        background: #007bff !important;
        color: white !important;
        border-color: #007bff !important;
      }
      
      .sitest-control-btn.navigate:hover {
        background: #0056b3 !important;
      }
      
      .sitest-control-btn.preview {
        background: #6c757d !important;
        color: white !important;
        border-color: #6c757d !important;
      }
      
      .sitest-control-btn.preview:hover {
        background: #545b62 !important;
      }
      
      .sitest-control-btn:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      /* === 一括操作エリア === */
      .sitest-batch-operations {
        background: #f8f9fa !important;
        border-top: 1px solid #e0e0e0 !important;
        padding: 15px 20px !important;
        flex-shrink: 0 !important;
      }
      
      .sitest-batch-title {
        font-size: 14px !important;
        font-weight: 600 !important;
        color: #333 !important;
        margin-bottom: 10px !important;
      }
      
      .sitest-batch-controls {
        display: flex !important;
        gap: 8px !important;
        margin-bottom: 8px !important;
      }
      
      .sitest-batch-btn {
        flex: 1 !important;
        padding: 10px !important;
        border: 1px solid #d0d0d0 !important;
        border-radius: 6px !important;
        background: white !important;
        color: #333 !important;
        font-size: 12px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: center !important;
      }
      
      .sitest-batch-btn.execute-all {
        background: #28a745 !important;
        color: white !important;
        border-color: #28a745 !important;
      }
      
      .sitest-batch-btn.revert-all {
        background: #6c757d !important;
        color: white !important;
        border-color: #6c757d !important;
      }
      
      .sitest-batch-btn.reset {
        background: #dc3545 !important;
        color: white !important;
        border-color: #dc3545 !important;
      }

      /* === 折りたたみボタン（メニュー外） === */
      .sitest-collapse-btn {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 60px !important;
        height: 40px !important;
        background: #ff6b35 !important;
        color: white !important;
        border: none !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 12px !important;
        font-weight: bold !important;
        z-index: 10001 !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
        transition: all 0.3s ease !important;
        transform: translateX(0) !important;
      }
      
      .sitest-collapse-btn.menu-collapsed {
        transform: translateX(0) !important;
      }
      
      .sitest-collapse-btn:hover {
        background: #e55a2b !important;
        transform: scale(1.1) !important;
      }

      /* === スクロールハイライト === */
      .sitest-scroll-highlight {
        outline: 5px solid #007bff !important;
        outline-offset: 3px !important;
        background-color: rgba(0, 123, 255, 0.2) !important;
        transition: all 0.3s ease !important;
      }

      /* === 統計情報 === */
      .sitest-stats {
        font-size: 11px !important;
        color: #666 !important;
        text-align: center !important;
        padding: 8px !important;
        border-top: 1px solid #f0f0f0 !important;
      }
    `;
    document.head.appendChild(style);
    this.log('New UI Preview styles added');
  }

  /**
   * サイドメニューを作成
   */
  createSideMenu() {
    if (this.sideMenu) {
      return this.sideMenu;
    }

    // メインメニュー
    this.sideMenu = document.createElement('div');
    this.sideMenu.className = 'sitest-side-menu';
    
    // ヘッダー
    const header = document.createElement('div');
    header.className = 'sitest-menu-header';
    header.innerHTML = `
      <h3 class="sitest-menu-title">🎯 SiTest Controller</h3>
      <div class="sitest-header-controls">
        <button class="sitest-css-btn" title="CSS Preview">🎨</button>
        <button class="sitest-toggle-btn" title="メニューを折りたたむ">✕</button>
      </div>
    `;
    
    // コンテンツエリア
    const content = document.createElement('div');
    content.className = 'sitest-menu-content';
    
    // 一括操作エリア
    const batchOps = document.createElement('div');
    batchOps.className = 'sitest-batch-operations';
    batchOps.innerHTML = `
      <div class="sitest-batch-title">🔧 一括操作</div>
      <div class="sitest-batch-controls">
        <button class="sitest-batch-btn execute-all">▶️ 全実行</button>
        <button class="sitest-batch-btn revert-all">↶ 全復元</button>
        <button class="sitest-batch-btn reset">🔄 リセット</button>
      </div>
      <div class="sitest-batch-controls">
        <button class="sitest-batch-btn load-css">🎨 CSS読込</button>
        <button class="sitest-batch-btn css-preview">📄 CSS表示</button>
      </div>
      <div class="sitest-stats">
        <span id="sitest-stats-text">要素を検索中...</span>
      </div>
    `;
    
    // 構成
    this.sideMenu.appendChild(header);
    this.sideMenu.appendChild(content);
    this.sideMenu.appendChild(batchOps);
    
    // イベントリスナー
    this.setupSideMenuEvents(header, batchOps);
    
    // 折りたたみボタン（メニュー外）
    this.createCollapseButton();
    
    document.body.appendChild(this.sideMenu);
    this.log('Side menu created');
    
    return this.sideMenu;
  }

  /**
   * 折りたたみボタンを作成（メニュー外）
   */
  createCollapseButton() {
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'sitest-collapse-btn';
    collapseBtn.innerHTML = 'SiTest';
    collapseBtn.title = 'SiTest Controllerを開く';
    
    collapseBtn.addEventListener('click', () => {
      this.toggleSideMenu();
    });
    
    document.body.appendChild(collapseBtn);
    this.collapseBtn = collapseBtn;
    
    return collapseBtn;
  }

  /**
   * サイドメニューのイベントを設定
   */
  setupSideMenuEvents(header, batchOps) {
    // ヘッダーの折りたたみボタン
    const toggleBtn = header.querySelector('.sitest-toggle-btn');
    toggleBtn.addEventListener('click', () => {
      this.toggleSideMenu();
    });
    
    // ヘッダーのCSSボタン
    const cssBtn = header.querySelector('.sitest-css-btn');
    cssBtn.addEventListener('click', () => {
      this.showCSSPreview();
    });
    
    // 一括操作ボタン
    const executeAllBtn = batchOps.querySelector('.execute-all');
    const revertAllBtn = batchOps.querySelector('.revert-all');
    const resetBtn = batchOps.querySelector('.reset');
    
    executeAllBtn.addEventListener('click', () => {
      this.executeAllOperations();
    });
    
    revertAllBtn.addEventListener('click', () => {
      this.revertAllOperations();
    });
    
    resetBtn.addEventListener('click', () => {
      this.resetAllOperations();
    });
    
    // CSS関連ボタン
    const loadCssBtn = batchOps.querySelector('.load-css');
    const cssPreviewBtn = batchOps.querySelector('.css-preview');
    
    loadCssBtn.addEventListener('click', async () => {
      loadCssBtn.disabled = true;
      loadCssBtn.textContent = '読込中...';
      
      const css = await this.loadAndInjectCSS();
      
      loadCssBtn.disabled = false;
      loadCssBtn.textContent = css ? '✅ 完了' : '❌ 失敗';
      
      setTimeout(() => {
        loadCssBtn.textContent = '🎨 CSS読込';
      }, 2000);
    });
    
    cssPreviewBtn.addEventListener('click', () => {
      this.showCSSPreview();
    });
  }

  /**
   * サイドメニューの表示切り替え
   */
  toggleSideMenu() {
    this.sideMenuCollapsed = !this.sideMenuCollapsed;
    
    if (this.sideMenuCollapsed) {
      this.sideMenu.classList.add('collapsed');
      this.collapseBtn.classList.add('menu-collapsed');
    } else {
      this.sideMenu.classList.remove('collapsed');
      this.collapseBtn.classList.remove('menu-collapsed');
    }
    
    this.log('Side menu toggled:', this.sideMenuCollapsed ? 'collapsed' : 'expanded');
  }

  /**
   * 要素グループをサイドメニューに追加
   */
  addElementToSideMenu(element, operations, elementId) {
    const content = this.sideMenu.querySelector('.sitest-menu-content');
    
    // 要素にIDを設定（後で検索可能にする）
    element.dataset.sitestId = elementId;
    
    // 要素のセレクターを生成（SiTest属性を除外）
    const selector = this.generateCleanSelector(element);
    
    // 操作の説明を生成
    const operationsText = operations.map(op => 
      this.getTypeDisplayText(op.type)
    ).join(', ');
    
    // グループ要素を作成
    const group = document.createElement('div');
    group.className = 'sitest-element-group';
    group.dataset.elementId = elementId;
    
    group.innerHTML = `
      <div class="sitest-element-info">
        <div class="sitest-element-selector">${selector}</div>
        <div class="sitest-element-operations">${operations.length}個の操作: ${operationsText}</div>
      </div>
      <div class="sitest-control-group">
        <button class="sitest-control-btn execute" title="操作を実行">⚡</button>
        <button class="sitest-control-btn navigate" title="要素へ移動">📍</button>
        <button class="sitest-control-btn preview" title="Code Preview">💻</button>
        <button class="sitest-control-btn css-preview" title="CSS Preview">🎨</button>
        <button class="sitest-control-btn revert" title="元に戻す" disabled>↶</button>
      </div>
    `;
    
    // イベントリスナーを設定
    this.setupElementGroupEvents(group, element, operations, elementId);
    
    content.appendChild(group);
    this.elementGroups.set(elementId, { group, element, operations });
    
    this.updateStats();
    this.log('Element added to side menu:', elementId, selector);
  }

  /**
   * 要素グループのイベントを設定
   */
  setupElementGroupEvents(group, element, operations, elementId) {
    const executeBtn = group.querySelector('.execute');
    const navigateBtn = group.querySelector('.navigate');
    const previewBtn = group.querySelector('.preview');
    const cssPreviewBtn = group.querySelector('.css-preview');
    const revertBtn = group.querySelector('.revert');
    
    // 実行ボタン
    executeBtn.addEventListener('click', async () => {
      try {
        executeBtn.disabled = true;
        executeBtn.textContent = '⏳ 実行中...';
        
        await this.executeElementOperations(element, operations, elementId);
        
        // UIを更新
        executeBtn.style.display = 'none';
        revertBtn.disabled = false;
        revertBtn.style.display = 'inline-block';
        
      } catch (error) {
        this.error('Failed to execute from side menu:', error);
        executeBtn.textContent = '⚠ エラー';
        executeBtn.disabled = false;
      }
    });
    
    // 移動ボタン
    navigateBtn.addEventListener('click', () => {
      this.navigateToElement(element);
    });
    
    // プレビューボタン
    previewBtn.addEventListener('click', () => {
      this.showOperationsPreview(operations);
    });
    
    // CSS プレビューボタン
    cssPreviewBtn.addEventListener('click', () => {
      this.showCSSPreview();
    });
    
    // 元に戻すボタン
    revertBtn.addEventListener('click', () => {
      try {
        this.revertElement(elementId, null);
        
        // UIを更新
        executeBtn.style.display = 'inline-block';
        executeBtn.disabled = false;
        executeBtn.textContent = '⚡ 実行';
        revertBtn.disabled = true;
        revertBtn.style.display = 'none';
        
      } catch (error) {
        this.error('Failed to revert from side menu:', error);
      }
    });
  }

  /**
   * 要素への移動（スムーズスクロール + ハイライト）
   */
  navigateToElement(element) {
    if (!element || !element.parentNode) {
      this.error('Element not found or not in DOM');
      return;
    }
    
    // 既存のハイライトを削除
    document.querySelectorAll('.sitest-scroll-highlight').forEach(el => {
      el.classList.remove('sitest-scroll-highlight');
    });
    
    // 新しいハイライトを追加
    element.classList.add('sitest-scroll-highlight');
    
    // スムーズスクロール
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
    
    // 3秒後にハイライトを削除
    setTimeout(() => {
      element.classList.remove('sitest-scroll-highlight');
    }, 3000);
    
    this.log('Navigated to element:', element);
  }

  /**
   * SiTest属性を除外したクリーンなセレクターを生成
   */
  generateCleanSelector(element) {
    const tagName = element.tagName.toLowerCase();
    const cleanClasses = Array.from(element.classList)
      .filter(cls => !cls.startsWith('sitest-'))
      .slice(0, 3) // 最大3つまで
      .join('.');
    
    const id = element.id && !element.id.startsWith('sitest-') ? `#${element.id}` : '';
    
    let selector = tagName;
    if (id) selector += id;
    if (cleanClasses) selector += `.${cleanClasses}`;
    
    // 属性の追加（data-sitest-* 以外）
    const attributes = Array.from(element.attributes)
      .filter(attr => !attr.name.startsWith('data-sitest-') && 
                     !attr.name.startsWith('class') && 
                     !attr.name.startsWith('id'))
      .slice(0, 2);
    
    attributes.forEach(attr => {
      if (attr.value && attr.value.length < 20) {
        selector += `[${attr.name}="${attr.value}"]`;
      }
    });
    
    return selector || 'element';
  }

  /**
   * 操作のプレビューを表示（改良版 - HTMLソース表示 + コピー機能）
   */
  async showOperationsPreview(operations) {
    const previewWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
    
    // HTMLソースを並行取得
    const htmlSources = await Promise.all(
      operations
        .filter(op => op.url) // URLがある操作のみ
        .map(async op => {
          try {
            const html = await this.fetchHTML(op.url);
            return { operation: op, html, error: null };
          } catch (error) {
            return { operation: op, html: null, error: error.message };
          }
        })
    );

    const operationsList = operations.map((op, index) => {
      const typeText = this.getTypeDisplayText(op.type);
      const urlText = op.url ? `<small class="url-text">📁 ${op.url}</small>` : '<small class="no-url">（ファイル不要）</small>';
      
      // 対応するHTMLソースを検索
      const source = htmlSources.find(s => s.operation === op);
      const sourceSection = source ? `
        <div class="source-section">
          <div class="source-header">
            <span>📄 差し替え予定のHTMLソース</span>
            <button class="copy-btn" onclick="copyToClipboard('source-${index}')">📋 コピー</button>
          </div>
          ${source.error ? 
            `<div class="error-text">❌ エラー: ${source.error}</div>` :
            `<textarea id="source-${index}" class="source-textarea" readonly onclick="this.select()">${source.html}</textarea>`
          }
        </div>
      ` : '';

      return `
        <li class="operation-item">
          <div class="operation-header">
            <strong>${index + 1}. ${typeText}</strong>
            ${urlText}
          </div>
          ${sourceSection}
        </li>
      `;
    }).join('');

    previewWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>🔍 操作プレビュー & HTMLソース</title>
<style>
  body { 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    margin: 0; 
    background: #f8f9fa; 
    padding: 20px;
  }
  .container { 
    background: white; 
    padding: 20px; 
    border-radius: 8px; 
    box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
    max-width: 100%;
  }
  h2 { 
    color: #333; 
    margin-top: 0; 
    border-bottom: 2px solid #ff6b35;
    padding-bottom: 10px;
  }
  .operations-list { 
    list-style: none; 
    padding: 0; 
    margin: 0;
  }
  .operation-item { 
    margin: 15px 0; 
    background: #f8f9fa; 
    border-radius: 8px; 
    border-left: 4px solid #ff6b35;
    overflow: hidden;
  }
  .operation-header {
    padding: 15px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  }
  .url-text, .no-url { 
    display: block;
    color: #666; 
    margin-top: 5px;
    font-size: 12px;
  }
  .source-section {
    padding: 15px;
    border-top: 1px solid #dee2e6;
  }
  .source-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-weight: 600;
    color: #495057;
  }
  .copy-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: background 0.2s;
  }
  .copy-btn:hover {
    background: #0056b3;
  }
  .source-textarea {
    width: 100%;
    height: 200px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: #fff;
    resize: vertical;
    box-sizing: border-box;
  }
  .source-textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
  }
  .error-text {
    color: #dc3545;
    background: #f8d7da;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #f5c6cb;
  }
  .summary {
    background: #e7f3ff;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #007bff;
  }
</style>
<script>
function copyToClipboard(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (textarea) {
    textarea.select();
    document.execCommand('copy');
    
    // コピー完了通知
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ コピー完了!';
    btn.style.background = '#28a745';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '#007bff';
    }, 2000);
  }
}
</script>
</head>
<body>
<div class="container">
  <h2>🔍 操作プレビュー & HTMLソース</h2>
  
  <div class="summary">
    <strong>📊 実行予定の操作:</strong> ${operations.length}個<br>
    <strong>📄 HTMLソース:</strong> ${htmlSources.length}個のファイルを取得<br>
    <strong>💡 使い方:</strong> テキストエリアをクリックして全選択、またはコピーボタンを使用
  </div>
  
  <ul class="operations-list">${operationsList}</ul>
</div>
</body>
</html>
    `);
    previewWindow.document.close();
  }

  /**
   * 要素の操作を実行（サイドメニューから）- 修正版
   */
  async executeElementOperations(element, operations, elementId) {
    if (!this.options.previewMode) {
      throw new Error('Operations can only be executed in preview mode');
    }

    // 現在の有効な要素を取得（元に戻した後の場合を考慮）
    const currentElement = this.getCurrentValidElement(elementId, element);
    
    if (!currentElement || !currentElement.parentNode) {
      throw new Error('Element is not available for execution');
    }

    // 元の要素を保存（まだ保存されていない場合のみ）
    if (!this.originalElements.has(elementId)) {
      this.originalElements.set(elementId, {
        element: currentElement.cloneNode(true),
        parentNode: currentElement.parentNode,
        nextSibling: currentElement.nextSibling
      });
    }

    await this.executeMultipleOperations(currentElement, operations, elementId, null);
    
    // 要素の見た目を更新
    if (currentElement && currentElement.parentNode && currentElement.classList) {
      currentElement.classList.remove('sitest-preview-highlight', 'remove-target');
      currentElement.classList.add('sitest-preview-replaced');
    }
  }

  /**
   * 現在の有効な要素を取得（元に戻した後の参照更新対応）
   */
  getCurrentValidElement(elementId, fallbackElement) {
    // 1. elementGroups に保存されている最新の要素を確認
    const groupData = this.elementGroups.get(elementId);
    if (groupData && groupData.element && groupData.element.parentNode) {
      return groupData.element;
    }
    
    // 2. originalElements から復元された要素を確認
    const original = this.originalElements.get(elementId);
    if (original && original.element && original.element.parentNode) {
      return original.element;
    }
    
    // 3. DOM内で同じsitestIdを持つ要素を検索
    const elementInDOM = document.querySelector(`[data-sitest-id="${elementId}"]`);
    if (elementInDOM && elementInDOM.parentNode) {
      return elementInDOM;
    }
    
    // 4. フォールバック要素をチェック
    if (fallbackElement && fallbackElement.parentNode) {
      return fallbackElement;
    }
    
    this.error(`No valid element found for elementId: ${elementId}`);
    return null;
  }

  /**
   * 要素グループの参照を更新（元に戻した後の参照修正）
   */
  updateElementGroupReference(elementId) {
    const groupData = this.elementGroups.get(elementId);
    if (!groupData) return;

    // 現在の有効な要素を取得
    const currentElement = this.getCurrentValidElement(elementId, null);
    
    if (currentElement) {
      // 要素グループの参照を更新
      groupData.element = currentElement;
      this.elementGroups.set(elementId, groupData);
      
      this.log(`Element group reference updated for: ${elementId}`);
    } else {
      this.error(`Failed to update element group reference for: ${elementId}`);
    }
  }

  /**
   * 統計情報を更新
   */
  updateStats() {
    const statsEl = document.getElementById('sitest-stats-text');
    if (!statsEl) return;

    const total = this.elementGroups.size;
    const executed = Array.from(this.replacedElements.keys()).length;
    const pending = total - executed;

    statsEl.textContent = `全${total}個 | 実行済み${executed}個 | 待機中${pending}個`;
  }

  /**
   * 全操作を実行
   */
  async executeAllOperations() {
    const groups = Array.from(this.elementGroups.values());
    
    for (const { element, operations, group } of groups) {
      const elementId = group.dataset.elementId;
      const executeBtn = group.querySelector('.execute');
      
      if (executeBtn && !executeBtn.disabled && executeBtn.style.display !== 'none') {
        try {
          executeBtn.click();
          await this.delay(100); // 少し待機
        } catch (error) {
          this.error('Failed to execute operation for element:', elementId, error);
        }
      }
    }
  }

  /**
   * 全操作を元に戻す
   */
  revertAllOperations() {
    const groups = Array.from(this.elementGroups.values());
    
    for (const { group } of groups) {
      const revertBtn = group.querySelector('.revert');
      
      if (revertBtn && !revertBtn.disabled && revertBtn.style.display !== 'none') {
        try {
          revertBtn.click();
        } catch (error) {
          this.error('Failed to revert operation:', error);
        }
      }
    }
  }

  /**
   * 全操作をリセット
   */
  resetAllOperations() {
    if (confirm('全ての変更をリセットしてページを再読み込みしますか？')) {
      location.reload();
    }
  }

  /**
   * サイドメニューの要素状態を更新
   */
  updateSideMenuElementState(elementId, isExecuted) {
    const groupData = this.elementGroups.get(elementId);
    if (!groupData) return;

    const { group } = groupData;
    const executeBtn = group.querySelector('.execute');
    const revertBtn = group.querySelector('.revert');

    if (isExecuted) {
      // 実行済み状態
      executeBtn.style.display = 'none';
      revertBtn.disabled = false;
      revertBtn.style.display = 'inline-block';
    } else {
      // 未実行状態
      executeBtn.style.display = 'inline-block';
      executeBtn.disabled = false;
      executeBtn.textContent = '⚡ 実行';
      revertBtn.disabled = true;
      revertBtn.style.display = 'none';
    }

    this.updateStats();
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
   * CSSファイルを取得
   */
  async fetchCSS() {
    try {
      const cssUrl = this.options.cssUrl || this.options.cssFile;
      const fullUrl = this.options.baseUrl + cssUrl;
      
      this.log(`Fetching CSS from: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/css; charset=utf-8'
        },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const css = await response.text();
      this.log(`Successfully fetched CSS (${css.length} characters)`);
      return css;

    } catch (error) {
      this.error(`Failed to fetch CSS:`, error);
      return null;
    }
  }

  /**
   * CSSをheadに挿入
   */
  injectCSS(css) {
    try {
      // 既存のSiTest CSSを削除
      const existingStyle = document.getElementById('sitest-dynamic-css');
      if (existingStyle) {
        existingStyle.remove();
      }

      // 新しいstyleタグを作成
      const style = document.createElement('style');
      style.id = 'sitest-dynamic-css';
      style.type = 'text/css';
      style.textContent = css;

      // headの最後に追加
      document.head.appendChild(style);
      
      this.log('CSS injected successfully');
      return true;
    } catch (error) {
      this.error('Failed to inject CSS:', error);
      return false;
    }
  }

  /**
   * CSS自動読み込み・挿入
   */
  async loadAndInjectCSS() {
    if (!this.options.autoInjectCSS) {
      this.log('CSS auto-injection is disabled');
      return null;
    }

    try {
      const css = await this.fetchCSS();
      if (css) {
        this.injectCSS(css);
        return css;
      }
      return null;
    } catch (error) {
      this.error('Failed to load and inject CSS:', error);
      return null;
    }
  }

  /**
   * CSSプレビューを表示
   */
  async showCSSPreview() {
    try {
      const css = await this.fetchCSS();
      
      if (!css) {
        alert('CSSファイルの取得に失敗しました');
        return;
      }

      const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');

      previewWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>📄 SiTest CSS プレビュー</title>
<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    background: #f8f9fa;
    padding: 20px;
  }
  .container {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  }
  .header {
    background: #28a745;
    color: white;
    padding: 15px;
    margin: -20px -20px 20px -20px;
    border-radius: 8px 8px 0 0;
  }
  .css-info {
    background: #e7f3ff;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid #007bff;
  }
  .copy-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }
  .copy-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }
  .copy-btn:hover {
    background: #0056b3;
  }
  .css-textarea {
    width: 100%;
    height: 400px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 15px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: #fff;
    resize: vertical;
    box-sizing: border-box;
    line-height: 1.4;
  }
  .css-textarea:focus {
    outline: none;
    border-color: #28a745;
    box-shadow: 0 0 0 0.2rem rgba(40,167,69,.25);
  }
</style>
<script>
function copyCSS() {
  const textarea = document.getElementById('css-content');
  textarea.select();
  document.execCommand('copy');
  
  const btn = document.getElementById('copy-btn');
  const originalText = btn.textContent;
  btn.textContent = '✅ コピー完了!';
  btn.style.background = '#28a745';
  
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '#007bff';
  }, 2000);
}
</script>
</head>
<body>
<div class="container">
  <div class="header">
    <h2 style="margin: 0;">📄 SiTest CSS プレビュー</h2>
  </div>
  
  <div class="css-info">
    <strong>📁 ファイル:</strong> ${this.options.cssUrl || this.options.cssFile}<br>
    <strong>📊 サイズ:</strong> ${css.length}文字<br>
    <strong>💡 使い方:</strong> テキストエリアをクリックして全選択、またはコピーボタンを使用
  </div>
  
  <div class="copy-section">
    <h3 style="margin: 0;">CSS ソースコード</h3>
    <button id="copy-btn" class="copy-btn" onclick="copyCSS()">📋 CSS をコピー</button>
  </div>
  
  <textarea id="css-content" class="css-textarea" readonly onclick="this.select()">${css}</textarea>
</div>
</body>
</html>
      `);
      previewWindow.document.close();
    } catch (error) {
      alert(`CSSプレビューの表示に失敗しました: ${error.message}`);
    }
  }

  /**
   * 遅延処理
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 要素のスタイルを安全に設定
   */
  setElementPositionSafely(element, elementId) {
    if (!element || !element.style) {
      this.error('Invalid element in setElementPositionSafely:', element);
      return;
    }

    const computedStyle = getComputedStyle(element);
    const currentPosition = computedStyle.position;

    // 元のスタイルを保存
    this.originalStyles.set(elementId, {
      position: element.style.position,
      computedPosition: currentPosition
    });

    // static の場合のみ relative に変更
    if (currentPosition === 'static') {
      element.style.position = 'relative';
      this.log(`Position set to relative for element: ${elementId}`);
    }
  }

  /**
   * 要素のスタイルを復元
   */
  restoreElementStyle(element, elementId) {
    const originalStyle = this.originalStyles.get(elementId);
    if (originalStyle && element && element.style) {
      element.style.position = originalStyle.position;
      this.originalStyles.delete(elementId);
      this.log(`Position restored for element: ${elementId}`);
    }
  }

  /**
   * 安全なHTML設定
   */
  setHTMLSafely(element, html, operation = 'innerHTML') {
    try {
      if (!element) {
        throw new Error('Element is null or undefined');
      }

      switch (operation) {
        case 'innerHTML':
          element.innerHTML = html;
          break;
        case 'outerHTML':
          element.outerHTML = html;
          break;
        case 'insertAdjacentHTML':
          element.insertAdjacentHTML('afterend', html);
          break;
        default:
          element.innerHTML = html;
      }
      return true;
    } catch (error) {
      this.error(`HTML setting failed (${operation}):`, error);
      this.error('Problematic HTML:', html.substring(0, 200) + '...');
      return false;
    }
  }

  /**
   * 複数操作の解析
   */
  parseMultipleOperations(element) {
    const operations = [];

    // メイン操作（data-sitest-type）
    const mainType = element.getAttribute(this.options.attributeName);
    const mainUrl = element.getAttribute('data-sitest-url') || element.getAttribute('data-html-url');

    if (mainType) {
      operations.push({
        type: mainType,
        url: mainUrl,
        order: 1
      });
    }

    // 追加操作（data-sitest-type-N, data-sitest-url-N）
    let operationIndex = 2;
    while (operationIndex <= 10) { // 最大10個まで
      const operationType = element.getAttribute(`data-sitest-type-${operationIndex}`);
      if (!operationType) {
        operationIndex++;
        continue; // 次の番号をチェック
      }

      const operationUrl = element.getAttribute(`data-sitest-url-${operationIndex}`);

      // 有効な操作のみ追加
      if (operationType.trim()) {
        operations.push({
          type: operationType.trim(),
          url: operationUrl,
          order: operationIndex
        });
      }

      operationIndex++;
    }

    // undefined や null を除外して並び替え
    return operations
      .filter(op => op && op.type && op.type.trim())
      .sort((a, b) => a.order - b.order);
  }

  /**
   * プレビューモード用のハイライトを作成（新UI対応版）
   */
  createPreviewHighlight(element, operations) {
    const elementId = element.dataset.sitestId;

    // 有効な操作のみをフィルタリング
    const validOperations = operations.filter(op => op && op.type && op.type.trim());

    if (validOperations.length === 0) {
      this.error('No valid operations found for element:', element);
      return;
    }

    // 要素をハイライト
    element.classList.add('sitest-preview-highlight');

    // 削除操作があるかチェック
    const hasRemove = validOperations.some(op => op.type?.toLowerCase() === 'remove');
    if (hasRemove) {
      element.classList.add('remove-target');
    }

    // サイドメニューに追加
    this.addElementToSideMenu(element, validOperations, elementId);

    this.log(`Preview highlight created for ${validOperations.length} operations`);
  }

  /**
   * 複数操作を順次実行（バグ修正版）
   */
  async executeMultipleOperations(element, operations, elementId, button) {
    try {
      // ボタンが存在する場合のみ更新（サイドメニュー対応）
      if (button) {
        button.innerHTML = '⏳';
        button.title = '処理中...';
      }

      // 有効な操作のみをフィルタリング（順序保持）
      const validOperations = operations
        .filter((op, index) => {
          const isValid = op && op.type && op.type.trim();
          if (!isValid) {
            this.log(`Invalid operation at index ${index}:`, op);
          }
          return isValid;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0)); // 順序保持を確実に

      this.log('Valid operations after filtering:', validOperations);

      if (validOperations.length === 0) {
        throw new Error('No valid operations to execute');
      }

      let currentElement = element;
      let currentParent = element.parentNode;
      let currentNext = element.nextSibling;
      const executedOperations = [];

      for (let i = 0; i < validOperations.length; i++) {
        const operation = validOperations[i];
        this.log(`Executing operation ${i + 1}/${validOperations.length}:`, operation);

        // operation が有効かチェック
        if (!operation || !operation.type) {
          this.error('Invalid operation at index:', i, operation);
          continue;
        }

        // DOM操作前の存在チェック強化
        if (operation.type.toLowerCase() !== 'remove') {
          if (!currentElement || !currentElement.parentNode) {
            // 要素が削除されている場合の対処
            this.log(`Element is no longer in DOM at operation ${i + 1}, attempting recovery...`);
            
            // 元の要素情報から復旧を試行
            const original = this.originalElements.get(elementId);
            if (original && original.parentNode) {
              currentElement = original.element.cloneNode(true);
              // 復旧不可能な場合はエラー
              if (!currentElement) {
                throw new Error(`Element recovery failed at operation ${i + 1}`);
              }
            } else {
              throw new Error(`Element is no longer in the DOM at operation ${i + 1}`);
            }
          }
        }

        try {
          const result = await this.executeSingleOperation(currentElement, operation, currentParent, currentNext);
          executedOperations.push({
            operation,
            result,
            order: i + 1
          });

          // 結果によって次の操作の対象要素を更新
          if (result && result.newElement) {
            this.log(`Updating currentElement from:`, currentElement, `to:`, result.newElement);
            currentElement = result.newElement;
            currentParent = result.newParent || currentParent;
            currentNext = result.newNext || currentNext;
          }

          // 削除操作の場合は後続操作をスキップ
          if (operation.type && operation.type.toLowerCase() === 'remove') {
            this.log('Remove operation executed, skipping remaining operations');
            break;
          }
        } catch (operationError) {
          this.error(`Failed to execute operation ${i + 1}:`, operationError);
          
          // 操作レベルのエラーは記録して続行
          executedOperations.push({
            operation,
            result: { error: operationError.message },
            order: i + 1
          });
          
          // 重大なエラーの場合は中断
          if (operationError.message.includes('DOM') || operationError.message.includes('removed')) {
            break;
          }
        }
      }

      this.log('Final currentElement:', currentElement);

      // 実行結果を保存
      this.replacedElements.set(elementId, {
        type: 'multiple',
        element: currentElement,
        executedOperations,
        originalParent: element.parentNode,
        originalNext: element.nextSibling
      });

      // サイドメニューのUIを更新
      this.updateSideMenuElementState(elementId, true);
      
      // 要素の見た目を更新（currentElement の存在チェック強化）
      if (currentElement && currentElement.parentNode && currentElement.classList) {
        this.updateElementAppearance(currentElement, elementId, null, true);
      } else {
        // currentElement が無効な場合は元の要素を使用
        this.log('currentElement is invalid, using original element');
        if (element && element.parentNode && element.classList) {
          this.updateElementAppearance(element, elementId, null, true);
        }
      }
      this.log(`Multiple operations executed for element: ${elementId}`);

    } catch (error) {
      this.error('Failed to execute multiple operations:', error);
      this.error('Error stack:', error.stack);
      
      // ボタンが存在する場合のみ更新（サイドメニュー対応）
      if (button) {
        button.innerHTML = '⚠';
        button.title = `エラーが発生しました: ${error.message}`;
      }

      if (this.options.debug) {
        const errorMsg = `複数操作エラー: ${error.message}
要素ID: ${elementId}

詳細はコンソールを確認してください`;
        setTimeout(() => alert(errorMsg), 100);
      }
    }
  }

  /**
   * 要素の外観を更新（新UI対応版）
   */
  updateElementAppearance(element, elementId, button, isReplaced) {
    try {
      if (isReplaced) {
        element.classList.remove('sitest-preview-highlight', 'remove-target');
        element.classList.add('sitest-preview-replaced');
      } else {
        element.classList.remove('sitest-preview-replaced');
        element.classList.add('sitest-preview-highlight');
      }
    } catch (error) {
      this.error('Failed to update element appearance:', error);
    }
  }

  /**
   * 単一操作を実行（バグ修正版）
   */
  async executeSingleOperation(element, operation, parentElement, nextElement) {
    // operation の有効性チェック
    if (!operation || !operation.type) {
      throw new Error('Invalid operation: operation is null or undefined');
    }

    const { type, url } = operation;

    // DOM要素の存在確認を強化
    if (!element || !element.parentNode) {
      throw new Error('Element is not in the DOM or has been removed');
    }

    if (type.toLowerCase() === 'remove') {
      // 削除操作の安全性チェック
      if (!element.style) {
        throw new Error('Element is invalid for remove operation');
      }
      
      // 元の表示状態を保存
      const originalDisplay = getComputedStyle(element).display;
      element.dataset.originalDisplay = originalDisplay;
      element.style.display = 'none';
      
      return {
        type: 'removed',
        element,
        newElement: element,
        newParent: element.parentNode,
        newNext: element.nextSibling,
        originalDisplay
      };
    }

    if (!url) {
      throw new Error(`No URL specified for operation: ${type}`);
    }

    // HTMLを取得
    const html = await this.fetchHTML(url);

    // 新しい要素を作成
    const tempDiv = document.createElement('div');
    if (!this.setHTMLSafely(tempDiv, html, 'innerHTML')) {
      throw new Error('Failed to parse HTML content');
    }

    let newElement;
    let newParent = parentElement;
    let newNext = nextElement;

    // DOM操作前の最終チェック
    if (!element.parentNode) {
      throw new Error('Element was removed from DOM during operation');
    }

    switch (type.toLowerCase()) {
      case 'outerhtml':
      case 'outer':
        newElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (!newElement) {
          throw new Error('No valid element found in HTML content');
        }
        
        try {
          const currentParent = element.parentNode;
          currentParent.replaceChild(newElement, element);
          newParent = newElement.parentNode;
          newNext = newElement.nextSibling;
        } catch (error) {
          throw new Error(`Failed to replace element: ${error.message}`);
        }
        break;

      case 'innerhtml':
      case 'inner':
        if (!this.setHTMLSafely(element, html, 'innerHTML')) {
          throw new Error('Failed to set innerHTML');
        }
        newElement = element;
        newParent = element.parentNode;
        newNext = element.nextSibling;
        break;

      case 'insertafter':
      case 'after':
        const afterElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (!afterElement) {
          throw new Error('No valid element found in HTML content for insertAfter');
        }
        
        try {
          const currentParent = element.parentNode;
          const currentNext = element.nextSibling;
          
          if (currentNext) {
            currentParent.insertBefore(afterElement, currentNext);
          } else {
            currentParent.appendChild(afterElement);
          }
          
          // insertAfterの場合、元の要素は残る
          newElement = element;
          newParent = element.parentNode;
          newNext = element.nextSibling;
        } catch (error) {
          throw new Error(`Failed to insert element after: ${error.message}`);
        }
        break;

      case 'insertbefore':
      case 'before':
        const beforeElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (!beforeElement) {
          throw new Error('No valid element found in HTML content for insertBefore');
        }
        
        try {
          const currentParent = element.parentNode;
          currentParent.insertBefore(beforeElement, element);
          
          // insertBeforeの場合、元の要素は残る
          newElement = element;
          newParent = element.parentNode;
          newNext = element.nextSibling;
        } catch (error) {
          throw new Error(`Failed to insert element before: ${error.message}`);
        }
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    return {
      type: 'replaced',
      element,
      newElement,
      newParent,
      newNext,
      html
    };
  }

  /**
   * 元に戻す（複数操作対応）
   */
  revertElement(elementId, button) {
    try {
      const original = this.originalElements.get(elementId);
      const replaced = this.replacedElements.get(elementId);

      if (!original || !replaced) {
        this.error('Original or replaced element not found');
        return;
      }

      if (replaced.type === 'multiple') {
        // 複数操作から復元
        this.revertMultipleOperations(elementId, button, original, replaced);
      } else if (replaced.type === 'removed') {
        // 削除から復元（従来通り）
        replaced.element.style.display = '';
        replaced.element.classList.remove('sitest-preview-replaced');
        replaced.element.classList.add('sitest-preview-highlight', 'remove-target');
      } else if (replaced.type === 'replaced') {
        // outerHTML置換から復元（従来通り）
        const originalElement = original.element.cloneNode(true);

        if (!replaced.element.parentNode) {
          this.error('Replaced element is no longer in the DOM');
          return;
        }

        try {
          replaced.element.parentNode.replaceChild(originalElement, replaced.element);
        } catch (error) {
          this.error('Failed to replace element during revert:', error);
          return;
        }

        originalElement.classList.add('sitest-preview-highlight');
        this.setElementPositionSafely(originalElement, elementId);
        
        // ボタンが存在する場合のみ追加（サイドメニュー対応）
        if (button) {
          originalElement.appendChild(button);
        }

        this.originalElements.set(elementId, {
          element: originalElement,
          parentNode: originalElement.parentNode,
          nextSibling: originalElement.nextSibling
        });
      } else if (replaced.type === 'modified') {
        // innerHTML等から復元（従来通り）
        const originalElement = original.element.cloneNode(true);

        const success = this.setHTMLSafely(replaced.element, originalElement.innerHTML, 'innerHTML');
        if (!success) {
          this.error('Failed to restore HTML content');
          return;
        }

        replaced.element.classList.remove('sitest-preview-replaced');
        replaced.element.classList.add('sitest-preview-highlight');
      }

      // 差し替え情報を削除
      this.replacedElements.delete(elementId);

      // サイドメニューの状態を更新
      this.updateSideMenuElementState(elementId, false);
      
      // 要素グループの参照を更新
      this.updateElementGroupReference(elementId);

      this.log(`Element reverted: ${elementId}`);

    } catch (error) {
      this.error('Failed to revert element:', error);
      
      // ボタンが存在する場合のみ更新（サイドメニュー対応）
      if (button) {
        button.innerHTML = '⚠';
        button.title = `復元エラー: ${error.message}`;
      }

      if (this.options.debug) {
        const errorMsg = `復元エラー: ${error.message}\n要素ID: ${elementId}`;
        setTimeout(() => alert(errorMsg), 100);
      }
    }
  }

  /**
   * 複数操作からの復元
   */
  revertMultipleOperations(elementId, button, original, replaced) {
    try {
      // デバッグログ追加
      this.log('Reverting multiple operations for:', elementId);
      this.log('Executed operations:', replaced.executedOperations);

      let revertedElement = null;

      // 現在の要素を削除（複数操作で作成された可能性のある要素群）
      if (replaced.element && replaced.element.parentNode) {
        // 複数操作で挿入された可能性のある隣接要素も確認
        const insertedElements = this.findInsertedElements(replaced.executedOperations);
        insertedElements.forEach(el => {
          if (el && el.parentNode) {
            el.remove();
          }
        });

        // メイン要素の処理
        if (replaced.element.style.display === 'none') {
          // 削除操作されていた場合
          replaced.element.style.display = '';
          revertedElement = replaced.element;
        } else {
          // その他の操作の場合、元の要素で置換
          const originalElement = original.element.cloneNode(true);
          replaced.element.parentNode.replaceChild(originalElement, replaced.element);

          // ハイライトとボタンを復元
          originalElement.classList.add('sitest-preview-highlight');
          this.setElementPositionSafely(originalElement, elementId);
          
          // ボタンが存在する場合のみ追加（サイドメニュー対応）
          if (button) {
            originalElement.appendChild(button);
          }

          // 元の要素の情報を更新
          this.originalElements.set(elementId, {
            element: originalElement.cloneNode(true),
            parentNode: originalElement.parentNode,
            nextSibling: originalElement.nextSibling
          });
          revertedElement = originalElement;
        }
      } else {
        // 要素が完全に削除されている場合、原位置に復元
        const originalElement = original.element.cloneNode(true);
        if (original.parentNode && original.parentNode.contains && !original.parentNode.contains(originalElement)) {
          if (original.nextSibling && original.nextSibling.parentNode) {
            original.parentNode.insertBefore(originalElement, original.nextSibling);
          } else {
            original.parentNode.appendChild(originalElement);
          }

          originalElement.classList.add('sitest-preview-highlight');
          this.setElementPositionSafely(originalElement, elementId);
          
          // ボタンが存在する場合のみ追加（サイドメニュー対応）
          if (button) {
            originalElement.appendChild(button);
          }
          revertedElement = originalElement;
        }
      }

      this.log(`Multiple operations reverted for element: ${elementId}`);
      
      // 要素グループの参照を更新
      if (revertedElement) {
        const groupData = this.elementGroups.get(elementId);
        if (groupData) {
          groupData.element = revertedElement;
          this.elementGroups.set(elementId, groupData);
        }
      }
      
      return revertedElement;

    } catch (error) {
      this.error('Failed to revert multiple operations:', error);
      throw error;
    }
  }

  /**
   * 挿入された要素を特定
   */
  findInsertedElements(executedOperations) {
    const insertedElements = [];

    // executedOperations が配列かチェック
    if (!Array.isArray(executedOperations)) {
      this.log('executedOperations is not an array:', executedOperations);
      return insertedElements;
    }

    executedOperations.forEach((execOp, index) => {
      // execOp が有効かチェック
      if (!execOp || !execOp.operation || !execOp.result) {
        this.log(`Invalid executed operation at index ${index}:`, execOp);
        return;
      }

      const {
        operation,
        result
      } = execOp;

      if (operation.type && (operation.type.toLowerCase() === 'insertafter' ||
          operation.type.toLowerCase() === 'insertbefore')) {
        // insert操作で挿入された要素を特定
        if (result && result.newElement && result.newElement !== result.element) {
          insertedElements.push(result.newElement);
        }
      }
    });

    return insertedElements;
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
   * HTMLプレビューを表示（統合版）
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
    padding: 20px;
  }
  .preview-header { 
    background: #333; 
    color: white; 
    padding: 15px; 
    margin-bottom: 20px;
    border-radius: 8px;
  }
  .preview-content {
    background: white;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #ddd;
  }
</style>
</head>
<body>
<div class="preview-header">
  <h2>📄 HTMLプレビュー</h2>
  <p><strong>ファイル:</strong> ${htmlUrl}<br>
  <strong>差し替えタイプ:</strong> ${this.getTypeDisplayText(type)}</p>
</div>
<div class="preview-content">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
</body>
</html>
`);
      previewWindow.document.close();
    } catch (error) {
      alert(`HTMLプレビューの取得に失敗しました: ${error.message}`);
    }
  }

  /**
   * DOM要素を差し替え（プレビューモード対応・複数操作対応）
   */
  async replaceElement(element, operations) {
    try {
      // 重複処理防止
      const elementId = element.dataset.sitestId || Math.random().toString(36);
      if (this.processedElements.has(elementId)) {
        this.log('Element already processed, skipping:', elementId);
        return;
      }
      element.dataset.sitestId = elementId;

      this.log(`Processing element with ${operations.length} operations`);

      // プレビューモードの場合はハイライト表示のみ
      if (this.options.previewMode) {
        this.createPreviewHighlight(element, operations);
        this.processedElements.add(elementId);
        return;
      }

      // 通常モードでは複数操作を順次実行
      let currentElement = element;

      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        this.log(`Executing operation ${i + 1}/${operations.length}: ${operation.type}`);

        if (operation.type?.toLowerCase() === 'remove') {
          currentElement.remove();
          break; // 削除後は後続操作不要
        }

        if (!operation.url) {
          this.error('No URL specified for operation:', operation);
          continue;
        }

        const result = await this.executeSingleOperation(currentElement, operation, currentElement.parentNode, currentElement.nextSibling);

        if (result && result.newElement) {
          currentElement = result.newElement;
        }
      }

      this.processedElements.add(elementId);
      this.log(`Successfully processed element with multiple operations: ${elementId}`);

    } catch (error) {
      this.error(`Failed to replace element:`, error);
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

        // 複数操作を解析
        const operations = this.parseMultipleOperations(element);

        if (operations.length === 0) {
          this.error('No operations specified for element:', element);
          continue;
        }

        await this.replaceElement(element, operations);
      }

      this.log(`DOM ${this.options.previewMode ? 'preview' : 'replacement'} process completed`);

    } catch (error) {
      this.error('Error during processing:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * プレビューモードの情報を表示（新UI版）
   */
  showPreviewModeInfo(elementCount) {
    // サイドメニューを作成・表示
    if (!this.sideMenu) {
      this.createSideMenu();
    }
    
    // 統計を更新
    const statsEl = document.getElementById('sitest-stats-text');
    if (statsEl) {
      statsEl.textContent = `${elementCount}個の要素を検出しました`;
    }
    
    this.log('Preview mode activated with side menu');
  }

  /**
   * DOMの安定を待って処理開始
   */
  async init() {
    this.log('Initializing SiTestReplacer...');

    // DOMContentLoaded を待つ
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, {
          once: true
        });
      });
    }

    // window.onload を待つ
    if (document.readyState !== 'complete') {
      await new Promise(resolve => {
        window.addEventListener('load', resolve, {
          once: true
        });
      });
    }

    // 追加の待機時間
    if (this.options.waitTime > 0) {
      this.log(`Waiting additional ${this.options.waitTime}ms for DOM stability...`);
      await this.delay(this.options.waitTime);
    }

    // CSS自動読み込み
    await this.loadAndInjectCSS();
    
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
   * 処理状態をリセット（新UI対応版）
   */
  reset() {
    this.processedElements.clear();
    this.isProcessing = false;

    // サイドメニューを削除
    if (this.sideMenu) {
      this.sideMenu.remove();
      this.sideMenu = null;
    }
    
    // 折りたたみボタンを削除
    if (this.collapseBtn) {
      this.collapseBtn.remove();
      this.collapseBtn = null;
    }

    // プレビューオーバーレイを削除
    this.previewOverlays.forEach(overlay => {
      overlay.remove();
    });
    this.previewOverlays.clear();

    // コントロールボタンを削除
    this.controlButtons.forEach(button => {
      if (button.parentNode) {
        button.remove();
      }
    });
    this.controlButtons.clear();

    // ハイライトクラスを削除
    document.querySelectorAll('.sitest-preview-highlight, .sitest-preview-replaced, .sitest-scroll-highlight').forEach(element => {
      element.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced', 'sitest-scroll-highlight');
      // スタイルも復元
      const elementId = element.dataset.sitestId;
      if (elementId) {
        this.restoreElementStyle(element, elementId);
      }
    });

    // 保存データをクリア
    this.originalElements.clear();
    this.replacedElements.clear();
    this.originalStyles.clear();
    this.elementGroups.clear();

    this.log('SiTestReplacer state reset with new UI');
  }
}

// 使用例とデフォルト初期化
(function () {
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

【HTML側での指定例】

// 単一操作（従来通り）
<div data-sitest-type="outerHTML" data-sitest-url="replacement.html">
  元のコンテンツ
</div>

// 複数操作（新機能）
<div data-sitest-type="outerHTML" data-sitest-url="replacement.html"
     data-sitest-type-2="insertAfter" data-sitest-url-2="additional.html">
  この要素は置換後、さらに後ろに要素が追加される
</div>

// 複数操作の例：削除 + 新要素挿入
<div data-sitest-type="remove"
     data-sitest-type-2="insertAfter" data-sitest-url-2="new-content.html">
  この要素は削除され、新しい要素が後ろに挿入される
</div>

// 3つの操作
<div data-sitest-type="innerHTML" data-sitest-url="new-content.html"
     data-sitest-type-2="insertAfter" data-sitest-url-2="extra1.html"
     data-sitest-type-3="insertAfter" data-sitest-url-3="extra2.html">
  内容変更 + 2つの要素追加
</div>

【URLパラメータでプレビューモード】
- example.com/page.html?preview
- example.com/page.html?delivery  
- example.com/page.html?sitest-preview

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
*/
