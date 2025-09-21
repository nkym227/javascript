/**
 * SiTest代替DOM差し替えスニペット
 * SiTestを使わずに同様のDOM差し替えを再現するためのJavaScript
 */
class SiTestReplacer {
  constructor(options = {}) {
    this.options = {
      // 基本設定
      attributeName: options.attributeName || 'data-sitest-type',
      baseUrl: options.baseUrl || '', // HTMLファイルのベースURL
      waitTime: options.waitTime || 500, // 追加待機時間（ミリ秒）
      debug: options.debug || false,
      retryCount: options.retryCount || 3,
      retryDelay: options.retryDelay || 1000,
      previewMode: options.previewMode || this.getPreviewModeFromURL(),
      previewPosition: options.previewPosition || 'top-right', // top-left, top-right, center, bottom-left, bottom-right

      // CSS管理設定
      cssFile: options.cssFile || 'sitest-style.css', // CSSファイル名
      cssUrl: options.cssUrl || '', // CSSファイルのURL（baseUrlと組み合わせ）
      autoInjectCSS: options.autoInjectCSS !== false, // CSS自動挿入（デフォルトtrue）

      // JavaScript管理設定
      scriptFile: options.scriptFile || 'sitest-script.js', // サイトスクリプトファイル名
      scriptUrl: options.scriptUrl || '', // サイトスクリプトファイルのURL（baseUrlと組み合わせ）
      autoExecuteScript: options.autoExecuteScript !== false, // サイトスクリプト自動実行（デフォルトtrue）
      executeAfterAllReplacements: options.executeAfterAllReplacements !== false, // 全差し替え完了後実行（デフォルトtrue）

      // JavaScript実行設定
      executeScripts: options.executeScripts !== false, // デフォルト: true（実行する）
      scriptTimeout: options.scriptTimeout || 5000, // スクリプト実行タイムアウト（ms）

      // メディア置換設定
      mediaReplacement: {
        enabled: options.mediaReplacement?.enabled || false, // メディア置換機能の有効/無効
        localPath: options.mediaReplacement?.localPath || '/sitest/img/', // 開発時のローカルパス
        productionPath: options.mediaReplacement?.productionPath || '', // 本番のアップロード先パス
        ...options.mediaReplacement
      },
      ...options
    };

    this.isProcessing = false;
    this.processedElements = new Set();
    this.previewOverlays = new Set();
    this.controlButtons = new Set(); // コントロールボタン管理
    this.originalElements = new Map(); // 元の要素を保存
    this.replacedElements = new Map(); // 差し替え後の要素を保存
    this.originalStyles = new Map(); // 元のスタイルを保存
    this.sideMenu = null;
    this.sideMenuCollapsed = false;
    this.elementGroups = new Map(); // 要素グループ管理
    this.activePreviewWindow = null; // 現在開いているプレビューWindow
    this.activePreviewButton = null; // アクティブなプレビューボタン
    this.previewWindowCheckInterval = null; // Window状態チェック用の間隔ID

    // プレビューモード用のスタイルを追加
    if (this.options.previewMode) {
      this.addPreviewStyles();
    }

    // デバッグ用ログ
    this.log('SiTestReplacer initialized in', this.options.previewMode ? 'PREVIEW' : 'NORMAL', 'mode');

    // メディア置換設定のログ
    if (this.options.mediaReplacement.enabled) {
      this.log('Media replacement enabled:', {
        localPath: this.options.mediaReplacement.localPath,
        productionPath: this.options.mediaReplacement.productionPath
      });
    } else {
      this.log('Media replacement disabled');
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
  outline: 4px dashed #ff6b35 !important;
  animation: sitest-pulse 2s infinite !important;
}
.sitest-preview-highlight.position-static {
  position: relative !important;
}
.sitest-overlay-highlight {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  border: 2px solid #ff6b35 !important;
  pointer-events: none !important;
  z-index: 999999 !important;
  animation: sitest-overlay-pulse 2s infinite !important;
}
.sitest-overlay-highlight.executed {
  background: rgba(46, 204, 113, 0.2) !important;
  border-color: #2ecc71 !important;
}
.sitest-overlay-highlight.remove-target {
  background: rgba(231, 76, 60, 0.2) !important;
  border-color: #e74c3c !important;
}
.sitest-overlay-highlight::before {
  content: attr(data-operation-tags) !important;
  position: absolute !important;
  top: 4px !important;
  left: 0 !important;
  font-size: 14px !important;
  font-weight: bold !important;
  line-height: 1 !important;
  color: #fff !important;
  white-space: nowrap !important;
  max-width: calc(100% + 4px) !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.sitest-overlay-highlight:not(.remove-target):not(.executed)::before {
  background: linear-gradient(135deg, #ff6b35, #ff8c42) !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  border: 1px solid #e55a2b !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
}
.sitest-overlay-highlight.remove-target::before {
  background: linear-gradient(135deg, #e74c3c, #c0392b) !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  border: 1px solid #a93226 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
}
.sitest-overlay-highlight.executed::before {
  background: linear-gradient(135deg, #2ecc71, #27ae60) !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  border: 1px solid #229954 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
}
@keyframes sitest-overlay-pulse {
  0%, 100% {
    background-color: rgba(255, 107, 53, 0.4);
  }
  50% {
    background-color: rgba(255, 107, 53, 0.2);
  }
}
.sitest-preview-highlight.remove-target {
  outline-color: #e74c3c !important;
}
.sitest-preview-replaced {
  outline: 3px solid #27ae60 !important;
}
.sitest-highlight-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background-color: rgba(255, 107, 53, 0.15) !important;
  border: 2px solid #ff6b35 !important;
  pointer-events: none !important;
  z-index: 9999 !important;
  animation: sitest-overlay-pulse 2s infinite !important;
}
.sitest-highlight-overlay.remove-target {
  background-color: rgba(231, 76, 60, 0.15) !important;
  border-color: #e74c3c !important;
}
.sitest-highlight-overlay.replaced {
  background-color: rgba(39, 174, 96, 0.15) !important;
  border-color: #27ae60 !important;
  animation: none !important;
}
@keyframes sitest-pulse {
  0%, 100% {
    outline-width: 3px;
  }
  50% {
    outline-width: 5px;
  }
}
.sitest-side-menu {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  width: 350px !important;
  height: 100vh !important;
  background: white !important;
  border-left: 1px solid #e0e0e0 !important;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1) !important;
  z-index: 999999 !important;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
  transform: translateX(0) !important;
  transition: transform 0.3s ease !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  line-height: 1.5 !important;
}
.sitest-side-menu.collapsed {
  transform: translateX(350px) !important;
}
.sitest-menu-header {
  background: #f8f9fa !important;
  padding: 20px 15px !important;
  border-bottom: 1px solid #e0e0e0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-shrink: 0 !important;
}
.sitest-menu-title {
  padding-left: 20px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #333 !important;
  margin: 0 !important;
  text-align: left;
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
  width: 64px !important;
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
.sitest-menu-content {
  flex: 1 !important;
  overflow-y: auto !important;
  padding: 0 !important;
}
.sitest-element-group {
  border-bottom: 1px solid #f0f0f0 !important;
  padding: 18px 15px !important;
}
.sitest-element-group:has(.sitest-control-btn.execute[disabled]) .sitest-control-btn.navigate {
  pointer-events: none;
  opacity: 0.4;
}
.sitest-element-info {
  margin-bottom: 8px !important;
}
.sitest-element-selector {
  font-family: 'Courier New', monospace !important;
  font-size: 12px !important;
  color: #333 !important;
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
  font-size: 12px !important;
  line-height: 1;
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
  z-index: 1000000 !important;
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
.sitest-scroll-highlight {
  outline: 5px solid #007bff !important;
  outline-offset: 3px !important;
  background-color: rgba(0, 123, 255, 0.2) !important;
  transition: all 0.3s ease !important;
}
.sitest-active-preview-button,
.sitest-batch-btn.sitest-active-preview-button,
.sitest-control-btn.sitest-active-preview-button {
  background: #28a745 !important;
  background-color: #28a745 !important;
  color: white !important;
  font-weight: bold !important;
  box-shadow: 0 0 8px rgba(40, 167, 69, 0.6) !important;
  border-color: #28a745 !important;
  border: 1px solid #28a745 !important;
  transform: scale(1.02) !important;
  transition: all 0.2s ease !important;
  opacity: 1 !important;
}
.sitest-active-preview-button:hover,
.sitest-batch-btn.sitest-active-preview-button:hover,
.sitest-control-btn.sitest-active-preview-button:hover {
  background: #218838 !important;
  background-color: #218838 !important;
  box-shadow: 0 0 12px rgba(40, 167, 69, 0.8) !important;
  border-color: #218838 !important;
  border: 1px solid #218838 !important;
}
.sitest-stats {
  font-size: 11px !important;
  color: #666 !important;
  text-align: center !important;
  padding: 8px !important;
  border-top: 1px solid #f0f0f0 !important;
}
    `;
    document.head.append(style);
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
    header.innerHTML = `<div class="sitest-header-controls"><button class="sitest-toggle-btn" title="メニューを折りたたむ">✕</button></div><h3 class="sitest-menu-title">SiTest Replacer</h3>`;

    // コンテンツエリア
    const content = document.createElement('div');
    content.className = 'sitest-menu-content';

    // 一括操作エリア
    const batchOps = document.createElement('div');
    batchOps.className = 'sitest-batch-operations';
    batchOps.innerHTML = `<div class="sitest-batch-title">🔧 一括操作</div><div class="sitest-batch-controls"><button class="sitest-batch-btn execute-all">▶️ 全実行</button><button class="sitest-batch-btn revert-all">↶ 全復元</button><button class="sitest-batch-btn reset">🔄 リセット</button></div><div class="sitest-batch-controls"><button class="sitest-batch-btn load-css">🎨 CSS読込</button><button class="sitest-batch-btn css-preview">📄 CSS表示</button></div><div class="sitest-batch-controls"><button class="sitest-batch-btn execute-script">⚡ JS実行</button><button class="sitest-batch-btn script-preview">📄 JS表示</button></div><div class="sitest-stats"><span id="sitest-stats-text">要素を検索中...</span></div>`;

    // 構成
    this.sideMenu.append(header);
    this.sideMenu.append(content);
    this.sideMenu.append(batchOps);

    // イベントリスナー
    this.setupSideMenuEvents(header, batchOps);

    // 折りたたみボタン（メニュー外）
    this.createCollapseButton();

    document.body.append(this.sideMenu);
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

    document.body.append(collapseBtn);
    this.collapseBtn = collapseBtn;

    return collapseBtn;
  }

  /**
   * サイドメニューのイベントを設定
   */
  setupSideMenuEvents(header, batchOps) {
    // ヘッダーの折りたたみボタン
    const toggleBtn = header.querySelector('.sitest-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleSideMenu();
      });
    }

    // 一括操作ボタン
    const executeAllBtn = batchOps.querySelector('.execute-all');
    const revertAllBtn = batchOps.querySelector('.revert-all');
    const resetBtn = batchOps.querySelector('.reset');

    if (executeAllBtn) {
      executeAllBtn.addEventListener('click', () => {
        this.executeAllOperations();
      });
    }

    if (revertAllBtn) {
      revertAllBtn.addEventListener('click', () => {
        this.revertAllOperations();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetAllOperations();
      });
    }

    // CSS関連ボタン
    const loadCssBtn = batchOps.querySelector('.load-css');
    const cssPreviewBtn = batchOps.querySelector('.css-preview');

    if (loadCssBtn) {
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
    }

    if (cssPreviewBtn) {
      cssPreviewBtn.addEventListener('click', () => {
        this.log('CSS Preview button clicked!', cssPreviewBtn);

        // 既存のアクティブボタンがある場合は元に戻す
        this.resetActivePreviewButton();

        // 現在のボタンをアクティブ状態に設定
        this.setActivePreviewButton(cssPreviewBtn, '📄 CSS表示');

        this.log('CSS Preview button set to active, style check:', {
          backgroundColor: cssPreviewBtn.style.backgroundColor,
          color: cssPreviewBtn.style.color,
          textContent: cssPreviewBtn.textContent,
          className: cssPreviewBtn.className
        });

        // プレビューを表示
        this.showCSSPreview();
      });
    }

    // JavaScript関連ボタン
    const executeScriptBtn = batchOps.querySelector('.execute-script');
    const scriptPreviewBtn = batchOps.querySelector('.script-preview');

    if (executeScriptBtn) {
      executeScriptBtn.addEventListener('click', async () => {
        executeScriptBtn.disabled = true;
        executeScriptBtn.textContent = '実行中...';

        const result = await this.executeScriptManually();

        executeScriptBtn.disabled = false;
        executeScriptBtn.textContent = result ? '✅ 完了' : '❌ 失敗';

        setTimeout(() => {
          executeScriptBtn.textContent = '⚡ JS実行';
        }, 2000);
      });
    }

    // JSプレビューボタン
    if (scriptPreviewBtn) {
      scriptPreviewBtn.addEventListener('click', () => {
        this.log('JS Preview button clicked!', scriptPreviewBtn);

        // 既存のアクティブボタンがある場合は元に戻す
        this.resetActivePreviewButton();

        // 現在のボタンをアクティブ状態に設定
        this.setActivePreviewButton(scriptPreviewBtn, '📄 JS表示');

        this.log('JS Preview button set to active, style check:', {
          backgroundColor: scriptPreviewBtn.style.backgroundColor,
          color: scriptPreviewBtn.style.color,
          textContent: scriptPreviewBtn.textContent,
          className: scriptPreviewBtn.className
        });

        // プレビューを表示
        this.showScriptPreview();
      });
    }
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

    group.innerHTML = `<div class="sitest-element-info"><div class="sitest-element-selector">${selector}</div><div class="sitest-element-operations">${operations.length}個の操作: ${operationsText}</div></div><div class="sitest-control-group"><button class="sitest-control-btn execute" title="操作を実行">実行</button><button class="sitest-control-btn revert" title="元に戻す" disabled style="display:none;">↶元に戻す</button><button class="sitest-control-btn navigate" title="要素へ移動">要素へ移動</button><button class="sitest-control-btn preview" title="Code Preview">💻コード</button></div>`;

    // イベントリスナーを設定
    this.setupElementGroupEvents(group, element, operations, elementId);

    content.append(group);
    this.elementGroups.set(elementId, {
      group,
      element,
      operations
    });

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
    const revertBtn = group.querySelector('.revert');

    this.log('Setting up element group events:', {
      group,
      executeBtn,
      navigateBtn,
      previewBtn,
      revertBtn,
      elementId
    });

    // 実行ボタン
    if (executeBtn) {
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
    }

    // 移動ボタン
    if (navigateBtn) {
      navigateBtn.addEventListener('click', () => {
        this.navigateToElement(elementId);
      });
    }

    // プレビューボタン
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        this.log('Element preview button clicked!', previewBtn);

        // 既存のアクティブボタンがある場合は元に戻す
        this.resetActivePreviewButton();

        // 現在のボタンをアクティブ状態に設定
        this.setActivePreviewButton(previewBtn, '💻コード');

        this.log('Element preview button set to active, style check:', {
          backgroundColor: previewBtn.style.backgroundColor,
          color: previewBtn.style.color,
          textContent: previewBtn.textContent,
          className: previewBtn.className
        });

        // プレビューを表示
        this.showOperationsPreview(operations);
      });
    } else {
      this.error('Preview button not found in group:', group);
    }

    // 元に戻すボタン
    if (revertBtn) {
      revertBtn.addEventListener('click', () => {
        try {
          this.revertElement(elementId, null);

          // UIを更新
          executeBtn.style.display = 'inline-block';
          executeBtn.disabled = false;
          executeBtn.textContent = '実行';
          revertBtn.disabled = true;
          revertBtn.style.display = 'none';

        } catch (error) {
          this.error('Failed to revert from side menu:', error);
        }
      });
    }
  }

  /**
   * 要素への移動（スムーズスクロール + ハイライト）
   */
  navigateToElement(elementId) {
    // 現在の有効な要素を取得（差し替え後・復元後でも正しく取得）
    let element = this.getCurrentValidElement(elementId, null);

    // 要素が見つからない場合は、data-sitest-id属性で再検索
    if (!element || !element.parentNode) {
      element = document.querySelector(`[data-sitest-id="${elementId}"]`);
    }

    // それでも見つからない場合は、replacedElementsから検索
    if (!element && this.replacedElements.has(elementId)) {
      element = this.replacedElements.get(elementId);
    }

    // 最後の手段：originalElementsから検索
    if (!element && this.originalElements.has(elementId)) {
      element = this.originalElements.get(elementId);
    }

    if (!element || !element.parentNode) {
      this.error('Element not found or not in DOM for navigation');

      // フォールバック：data-sitest-id属性で検索
      const fallbackElement = document.querySelector(`[data-sitest-id="${elementId}"]`);
      if (fallbackElement && fallbackElement.parentNode) {
        this.navigateToValidElement(fallbackElement);
        return;
      }

      alert('要素が見つかりません。ページをリロードしてください。');
      return;
    }

    this.navigateToValidElement(element);
    this.log('Navigated to element:', element);
  }

  /**
   * 有効な要素への移動処理
   */
  navigateToValidElement(element) {
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
  }

  /**
   * SiTest属性を除外したクリーンなセレクターを生成
   */
  generateCleanSelector(element) {
    const tagName = element.tagName.toLowerCase();

    // 除外するクラス名のパターン
    const excludePatterns = [
      'sitest-', // SiTest関連
      'position-', // position制御用
      'remove-target', // 削除対象マーク
      'sitest-preview', // プレビュー関連
      'sitest-scroll', // スクロール関連
    ];

    const cleanClasses = Array.from(element.classList)
      .filter(cls => !excludePatterns.some(pattern => cls.includes(pattern)))
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
   * 操作のプレビューを表示
   */
  async showOperationsPreview(operations) {
    const previewWindow = this.openManagedPreviewWindow('', 'width=900,height=700,scrollbars=yes,resizable=yes', () => {
      // Window閉じた時のコールバック - ボタン状態を元に戻す
      this.resetActivePreviewButton();
    });

    if (!previewWindow) {
      alert('プレビューWindowの作成に失敗しました');
      return;
    }

    // HTMLソースを並行取得
    const htmlSources = await Promise.all(
      operations
      .filter(op => op.url) // URLがある操作のみ
      .map(async op => {
        try {
          const html = await this.fetchHTML(op.url);
          return {
            operation: op,
            html,
            error: null
          };
        } catch (error) {
          return {
            operation: op,
            html: null,
            error: error.message
          };
        }
      })
    );

    const operationsList = operations.map((op, index) => {
      const typeText = this.getTypeDisplayText(op.type);
      const urlText = op.url ? `<small class="url-text">📁 ${op.url}</small>` : '<small class="no-url">（ファイル不要）</small>';

      // 対応するHTMLソースを検索
      const source = htmlSources.find(s => s.operation === op);
      const sourceSection = source ? `<div class="source-section"><div class="source-header"><span>📄 差し替え予定のHTMLソース</span><button class="copy-btn" onclick="copyToClipboard('source-${index}')">📋 コピー</button></div>${source.error ? `<div class="error-text">❌ エラー: ${source.error}</div>` : `<textarea id="source-${index}" class="source-textarea" readonly onclick="this.select()">${source.html}</textarea>`}</div>` : '';

      return `<li class="operation-item"><div class="operation-header"><strong>${index + 1}. ${typeText}</strong>${urlText}</div>${sourceSection}</li>`;
    }).join('');

    // メディア置換情報を準備
    const mediaReplacementInfo = this.options.mediaReplacement.enabled ?
      `<br><strong>🖼️ メディア置換:</strong> ${this.options.mediaReplacement.localPath} → ${this.options.mediaReplacement.productionPath}` :
      '<br><strong>🖼️ メディア置換:</strong> 無効';

    previewWindow.document.write(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap" rel="stylesheet"><title>📄 SiTest HTMLプレビュー</title><style>body{font-family:'Noto Sans JP',sans-serif;background:#f8f9fa;padding:20px}.header{background:#6c757d;color:white;padding:15px;margin:-20px -20px 20px -20px;border-radius:8px 8px 0 0;font-size:20px;font-weight:700}.container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);max-width:100% !important}.operations-list{list-style:none;padding:0;margin:0}.operation-item{margin:15px 0;background:#f8f9fa;border-radius:8px;border-left:4px solid #ff6b35;overflow:hidden}.operation-header{padding:15px;background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)}.url-text,.no-url{display:block;color:#666;margin-top:5px;font-size:12px}.source-section{padding:15px;border-top:1px solid #dee2e6}.source-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-weight:600;color:#495057}.copy-btn{background:#007bff;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background 0.2s}.copy-btn:hover{background:#0056b3}.source-textarea{width:100%;height:200px;font-family:'Courier New',monospace;font-size:12px;padding:10px;border:1px solid #ced4da;border-radius:4px;background:#fff;resize:vertical;box-sizing:border-box}.source-textarea:focus{outline:none;border-color:#007bff;box-shadow:0 0 0 0.2rem rgba(0,123,255,.25)}.error-text{color:#dc3545;background:#f8d7da;padding:10px;border-radius:4px;border:1px solid #f5c6cb}.summary{background:#e7f3ff;padding:15px;border-radius:6px;margin-bottom:20px;border-left:4px solid #007bff;font-size:13px}</style><script>function copyToClipboard(t){let e=document.getElementById(t);if(e){e.select(),document.execCommand("copy");let n=event.target,o=n.textContent;n.textContent="✅ コピー完了!",n.style.background="#28a745",setTimeout(()=>{n.textContent=o,n.style.background="#007bff"},2e3)}}</script></head><body><div class="container"><div class="header"><h2>📄 SiTest HTMLプレビュー</h2></div><div class="summary"><strong>📊 実行予定の操作:</strong> ${operations.length}個<br><strong>📄 HTMLソース:</strong> ${htmlSources.length}個のファイルを取得${mediaReplacementInfo}<br><strong>💡 使い方:</strong> テキストエリアをクリックして全選択、またはコピーボタンを使用</div><ul class="operations-list">${operationsList}</ul></div></body></html>`);
    previewWindow.document.close();
  }

  /**
   * 要素の操作を実行（サイドメニューから）
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

    // 要素の見た目を更新（プレビューモードでは sitest-preview-replaced を使用しない）
    if (currentElement && currentElement.parentNode && currentElement.classList) {
      currentElement.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced');
      // プレビューモードでは実行済みクラスを追加せず、単純にハイライトを削除のみ
    }
  }

  /**
   * 現在の有効な要素を取得（元に戻した後の参照更新）
   */
  getCurrentValidElement(elementId, fallbackElement) {
    // elementGroups に保存されている最新の要素を確認
    const groupData = this.elementGroups.get(elementId);
    if (groupData && groupData.element && groupData.element.parentNode) {
      return groupData.element;
    }

    // originalElements から復元された要素を確認
    const original = this.originalElements.get(elementId);
    if (original && original.element && original.element.parentNode) {
      return original.element;
    }

    // DOM内で同じsitestIdを持つ要素を検索
    const elementInDOM = document.querySelector(`[data-sitest-id="${elementId}"]`);
    if (elementInDOM && elementInDOM.parentNode) {
      return elementInDOM;
    }

    // フォールバック要素をチェック
    if (fallbackElement && fallbackElement.parentNode) {
      return fallbackElement;
    }

    this.error(`No valid element found for elementId: ${elementId}`);
    return null;
  }

  /**
   * 要素グループの参照を更新
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
    let executedCount = 0;

    for (const {
        element,
        operations,
        group
      }
      of groups) {
      const elementId = group.dataset.elementId;
      const executeBtn = group.querySelector('.execute');

      if (executeBtn && !executeBtn.disabled && executeBtn.style.display !== 'none') {
        try {
          executeBtn.click();
          await this.delay(100); // 少し待機
          executedCount++;
        } catch (error) {
          this.error('Failed to execute operation for element:', elementId, error);
        }
      }
    }

    // 全差し替え完了後にサイトスクリプトを実行
    if (executedCount > 0 && this.options.executeAfterAllReplacements) {
      this.log(`All ${executedCount} operations completed. Executing site script...`);

      if (this.options.previewMode) {
        // プレビューモードでは確認ダイアログ
        if (confirm('全ての差し替えが完了しました。script.jsを実行しますか？')) {
          await this.loadAndExecuteScript();
        }
      } else {
        // 通常モードでは自動実行
        await this.loadAndExecuteScript();
      }
    }

    this.updateStats();
  }

  /**
   * 全操作を元に戻す
   */
  revertAllOperations() {
    const groups = Array.from(this.elementGroups.values());

    for (const {
        group
      }
      of groups) {
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

    const {
      group
    } = groupData;
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
      this.log('Successfully fetched HTML (' + html.length + ' characters)');

      // メディアパス置換を適用
      const processedHtml = this.replaceMediaPaths(html, 'HTML');
      return processedHtml;

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
      this.log('Successfully fetched CSS (' + css.length + ' characters)');

      // メディアパス置換を適用
      const processedCss = this.replaceMediaPaths(css, 'CSS');
      return processedCss;

    } catch (error) {
      this.error(`Failed to fetch CSS:`, error);
      return null;
    }
  }

  /**
   * サイトスクリプトファイルを取得
   */
  async fetchScript() {
    const scriptUrl = this.options.scriptUrl ||
      (this.options.baseUrl ?
        `${this.options.baseUrl}${this.options.scriptFile}` :
        this.options.scriptFile);

    try {
      this.log(`Fetching site script: ${scriptUrl}`);
      const response = await fetch(scriptUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const scriptContent = await response.text();
      this.log('Site script loaded successfully: ' + scriptContent.length + ' characters');

      // メディアパス置換を適用
      const processedScript = this.replaceMediaPaths(scriptContent, 'JavaScript');
      return processedScript;
    } catch (error) {
      this.error(`Failed to fetch site script: ${error.message}`);
      return null;
    }
  }

  /**
   * サイトスクリプトを実行
   */
  executeScript(scriptContent) {
    try {
      this.log('Executing site script...');

      // 新しいscriptタグを作成して実行
      const scriptTag = document.createElement('script');
      scriptTag.textContent = scriptContent;

      // headに追加して実行
      document.head.appendChild(scriptTag);

      // 実行後は削除（メモリクリーンアップ）
      document.head.removeChild(scriptTag);

      this.log('Site script executed successfully');
      return true;
    } catch (error) {
      this.error('Failed to execute site script:', error);
      return false;
    }
  }

  /**
   * サイトスクリプトを手動で実行
   */
  async executeScriptManually() {
    if (!this.options.scriptFile) {
      this.error('No site script file specified');
      return false;
    }

    const scriptContent = await this.fetchScript();
    if (scriptContent) {
      return this.executeScript(scriptContent);
    }
    return false;
  }

  /**
   * サイトスクリプトを読み込んで実行
   */
  async loadAndExecuteScript() {
    if (!this.options.autoExecuteScript) {
      this.log('Site script auto-execution is disabled');
      return false;
    }

    const scriptContent = await this.fetchScript();
    if (scriptContent) {
      return this.executeScript(scriptContent);
    }
    return false;
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
      style.textContent = css;

      // headの最後に追加
      document.head.append(style);

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

      const previewWindow = this.openManagedPreviewWindow('', 'width=800,height=600,scrollbars=yes,resizable=yes', () => {
        // Window閉じた時のコールバック - ボタン状態を元に戻す
        this.resetActivePreviewButton();
      });

      if (!previewWindow) {
        alert('プレビューWindowの作成に失敗しました');
        return;
      }

      // メディア置換情報を準備
      const cssMediaInfo = this.options.mediaReplacement.enabled ?
        `<br><strong>🖼️ メディア置換:</strong> ${this.options.mediaReplacement.localPath} → ${this.options.mediaReplacement.productionPath}` :
        '<br><strong>🖼️ メディア置換:</strong> 無効';

      previewWindow.document.write(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap" rel="stylesheet"><title>📄 SiTest CSS プレビュー</title><style>body{font-family:'Noto Sans JP',sans-serif;margin:0;background:#f8f9fa;padding:20px}.container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}.header{background:#28a745;color:white;padding:15px;margin:-20px -20px 20px -20px;border-radius:8px 8px 0 0;font-size:20px;font-weight:700}.css-info{background:#e7f3ff;padding:15px;border-radius:6px;margin-bottom:20px;border-left:4px solid #007bff;font-size:13px}.copy-section{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.copy-btn{background:#007bff;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background 0.2s}.copy-btn:hover{background:#0056b3}.css-textarea{width:100%;height:300px;font-family:'Courier New',monospace;font-size:12px;padding:15px;border:1px solid #ced4da;border-radius:4px;background:#fff;resize:vertical;box-sizing:border-box;line-height:1.4}.css-textarea:focus{outline:none;border-color:#28a745;box-shadow:0 0 0 0.2rem rgba(40,167,69,.25)}</style><script>function copyCSS(){let t=document.getElementById("css-content");t.select(),document.execCommand("copy");let e=document.getElementById("copy-btn"),n=e.textContent;e.textContent="✅ コピー完了!",e.style.background="#28a745",setTimeout(()=>{e.textContent=n,e.style.background="#007bff"},2e3)}</script></head><body><div class="container"><div class="header"><h2>📄 SiTest CSS プレビュー</h2></div><div class="css-info"><strong>📁 ファイル:</strong> ${this.options.cssUrl || this.options.cssFile}${cssMediaInfo}<br><strong>💡 使い方:</strong> テキストエリアをクリックして全選択、またはコピーボタンを使用</div><div class="copy-section"><h3>CSS ソースコード</h3><button id="copy-btn" class="copy-btn" onclick="copyCSS()">📋 CSS をコピー</button></div><textarea id="css-content" class="css-textarea" readonly onclick="this.select()"><style>\n${css}\n</style></textarea></div></body></html>`);
      previewWindow.document.close();
    } catch (error) {
      alert(`CSSプレビューの表示に失敗しました: ${error.message}`);
    }
  }

  /**
   * JavaScriptプレビューを表示
   */
  async showScriptPreview() {
    try {
      const script = await this.fetchScript();

      if (!script) {
        alert('JavaScriptファイルの取得に失敗しました');
        return;
      }

      const previewWindow = this.openManagedPreviewWindow('', 'width=800,height=600,scrollbars=yes,resizable=yes', () => {
        // Window閉じた時のコールバック - ボタン状態を元に戻す
        this.resetActivePreviewButton();
      });

      if (!previewWindow) {
        alert('プレビューWindowの作成に失敗しました');
        return;
      }

      // メディア置換情報を準備
      const jsMediaInfo = this.options.mediaReplacement.enabled ?
        `<br><strong>🖼️ メディア置換:</strong> ${this.options.mediaReplacement.localPath} → ${this.options.mediaReplacement.productionPath}` :
        '<br><strong>🖼️ メディア置換:</strong> 無効';

      previewWindow.document.write(`<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap" rel="stylesheet"><title>📄 SiTest JavaScript プレビュー</title><style>body{font-family:'Noto Sans JP',sans-serif;background:#f8f9fa;padding:20px}.container{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}.header{background:#007bff;color:white;padding:15px;margin:-20px -20px 20px -20px;border-radius:8px 8px 0 0;font-size:20px;font-weight:700}.script-info{background:#e7f3ff;padding:15px;border-radius:6px;margin-bottom:20px;border-left:4px solid #007bff;font-size:13px}.copy-section{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.copy-btn{background:#007bff;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;transition:background 0.2s}.copy-btn:hover{background:#0056b3}.script-textarea{width:100%;height:280px;font-family:'Courier New',monospace;font-size:12px;padding:15px;border:1px solid #ced4da;border-radius:4px;background:#fff;resize:vertical;box-sizing:border-box;line-height:1.4}.script-textarea:focus{outline:none;border-color:#28a745;box-shadow:0 0 0 0.2rem rgba(40,167,69,.25)}</style><script>function copyScript(){let t=document.getElementById("script-content");t.select(),document.execCommand("copy");let e=document.getElementById("copy-btn"),n=e.textContent;e.textContent="✅ コピー完了!",e.style.background="#28a745",setTimeout(()=>{e.textContent=n,e.style.background="#007bff"},2e3)}</script></head><body><div class="container"><div class="header"><h2 style="margin: 0;">📄 SiTest JavaScript プレビュー</h2></div><div class="script-info"><strong>📁 ファイル:</strong> ${this.options.scriptUrl || this.options.scriptFile}${jsMediaInfo}<br><strong>💡 使い方:</strong> テキストエリアをクリックして全選択、またはコピーボタンを使用<br><strong>⚡ 実行タイミング:</strong> 全差し替え完了後に自動実行</div><div class="copy-section"><h3 style="margin: 0;">JavaScript ソースコード</h3><button id="copy-btn" class="copy-btn" onclick="copyScript()">📋 JS をコピー</button></div><textarea id="script-content" class="script-textarea" readonly onclick="this.select()">${script}</textarea></div></body></html>`);
      previewWindow.document.close();
    } catch (error) {
      alert(`JavaScriptプレビューの表示に失敗しました: ${error.message}`);
    }
  }

  /**
   * 遅延処理
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * プレビューWindowを管理しながら開く
   * 既存のWindowが開いている場合は閉じてから新しいWindowを開く
   */
  openManagedPreviewWindow(url, features, onCloseCallback = null) {
    // 既存のプレビューWindowが開いている場合は閉じる（ボタン状態はリセットしない）
    if (this.activePreviewWindow && !this.activePreviewWindow.closed) {
      try {
        this.activePreviewWindow.close();
        this.log('Previous preview window closed');
      } catch (error) {
        this.log('Error closing previous preview window:', error);
      }
    }

    // 監視を停止（ただしボタン状態はリセットしない）
    this.stopPreviewWindowMonitoring();

    // 新しいWindowを開く
    const newWindow = window.open(url, '_blank', features);

    if (newWindow) {
      this.activePreviewWindow = newWindow;

      // Windowの状態を定期的にチェック
      this.startPreviewWindowMonitoring(onCloseCallback);

      this.log('Preview window opened and monitoring started');
      return newWindow;
    } else {
      this.error('Failed to open preview window');
      // Window作成に失敗した場合のみボタン状態をリセット
      if (onCloseCallback && typeof onCloseCallback === 'function') {
        onCloseCallback();
      }
      return null;
    }
  }

  /**
   * アクティブなプレビューWindowを閉じる
   */
  closeActivePreviewWindow() {
    if (this.activePreviewWindow && !this.activePreviewWindow.closed) {
      try {
        this.activePreviewWindow.close();
        this.log('Active preview window closed');
      } catch (error) {
        this.log('Error closing preview window:', error);
      }
    }

    // 監視を停止
    this.stopPreviewWindowMonitoring();

    // Window参照のみクリア（ボタン状態は保持）
    this.activePreviewWindow = null;

    // resetPreviewWindowState() は呼び出さない（ボタン状態を保持するため）
  }

  /**
   * プレビューWindowの監視を開始
   */
  startPreviewWindowMonitoring(onCloseCallback) {
    // 既存の監視を停止
    this.stopPreviewWindowMonitoring();

    // 新しい監視を開始
    this.previewWindowCheckInterval = setInterval(() => {
      if (!this.activePreviewWindow || this.activePreviewWindow.closed) {
        this.log('Preview window was closed by user');

        // コールバック実行（ボタン状態復元など）
        if (onCloseCallback && typeof onCloseCallback === 'function') {
          try {
            onCloseCallback();
          } catch (error) {
            this.error('Error in preview window close callback:', error);
          }
        }

        // 状態をリセット
        this.resetPreviewWindowState();

        // 監視停止
        this.stopPreviewWindowMonitoring();
      }
    }, 1000); // 1秒ごとにチェック
  }

  /**
   * プレビューWindowの監視を停止
   */
  stopPreviewWindowMonitoring() {
    if (this.previewWindowCheckInterval) {
      clearInterval(this.previewWindowCheckInterval);
      this.previewWindowCheckInterval = null;
    }
  }

  /**
   * プレビューWindow関連の状態をリセット
   */
  resetPreviewWindowState() {
    // アクティブなボタンの状態を元に戻す
    this.resetActivePreviewButton();

    // Window参照をクリア
    this.activePreviewWindow = null;
    this.activePreviewButton = null;
  }

  /**
   * プレビューボタンをアクティブ状態に設定
   */
  setActivePreviewButton(button, originalText) {
    // 既存のアクティブボタンがある場合は元に戻す
    this.resetActivePreviewButton();

    this.log('Setting active preview button:', {
      button,
      originalText
    });

    // 新しいアクティブボタンを設定
    this.activePreviewButton = {
      element: button,
      originalText: originalText,
      originalBackground: button.style.backgroundColor || '',
      originalColor: button.style.color || '',
      originalFontWeight: button.style.fontWeight || '',
      originalBoxShadow: button.style.boxShadow || '',
      originalBorderColor: button.style.borderColor || ''
    };

    // CSSクラスを追加
    button.classList.add('sitest-active-preview-button');

    // インラインスタイルを強制適用
    button.style.setProperty('background-color', '#28a745', 'important');
    button.style.setProperty('color', 'white', 'important');
    button.style.setProperty('font-weight', 'bold', 'important');
    button.style.setProperty('box-shadow', '0 0 8px rgba(40, 167, 69, 0.6)', 'important');
    button.style.setProperty('border-color', '#28a745', 'important');
    button.style.setProperty('transform', 'scale(1.02)', 'important');

    // テキストに🟢アイコンを追加
    const newText = '🟢 ' + originalText;
    button.textContent = newText;

    // 強制的に再描画を促す
    setTimeout(() => {
      button.style.display = button.style.display;
    }, 0);

    this.log('Preview button styling applied:', {
      backgroundColor: button.style.backgroundColor,
      color: button.style.color,
      fontWeight: button.style.fontWeight,
      boxShadow: button.style.boxShadow,
      textContent: button.textContent,
      className: button.className,
      computedStyle: window.getComputedStyle(button)
    });

    this.log('Preview button set to active state:', button, originalText);
  }

  /**
   * アクティブプレビューボタンの状態を元に戻す
   */
  resetActivePreviewButton() {
    if (this.activePreviewButton && this.activePreviewButton.element) {
      const button = this.activePreviewButton.element;

      // CSSクラスを削除
      button.classList.remove('sitest-active-preview-button');

      // スタイルを元に戻す
      button.style.removeProperty('background-color');
      button.style.removeProperty('color');
      button.style.removeProperty('font-weight');
      button.style.removeProperty('box-shadow');
      button.style.removeProperty('border-color');

      // 元の値があれば復元
      if (this.activePreviewButton.originalBackground) {
        button.style.backgroundColor = this.activePreviewButton.originalBackground;
      }
      if (this.activePreviewButton.originalColor) {
        button.style.color = this.activePreviewButton.originalColor;
      }
      if (this.activePreviewButton.originalFontWeight) {
        button.style.fontWeight = this.activePreviewButton.originalFontWeight;
      }
      if (this.activePreviewButton.originalBoxShadow) {
        button.style.boxShadow = this.activePreviewButton.originalBoxShadow;
      }

      // テキストを元に戻す
      button.textContent = this.activePreviewButton.originalText;

      this.log('Preview button state reset:', button);
    }

    this.activePreviewButton = null;
  }

  /**
   * 要素のスタイルを安全に設定（position対応改善版）
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
    // absolute, fixed, sticky, relativeの場合は変更しない
    if (currentPosition === 'static') {
      element.style.position = 'relative';
      this.log(`Position set to relative for element: ${elementId} (was static)`);
    } else {
      this.log(`Position unchanged for element: ${elementId} (already ${currentPosition})`);
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
   * 挿入されたScriptタグを実行
   */
  executeScripts(container) {
    this.log('[SiTestReplacer] executeScripts called with container:', container); // デバッグログ
    this.log('[SiTestReplacer] executeScripts option:', this.options.executeScripts); // オプション確認

    if (!container || !this.options.executeScripts) {
      this.log('[SiTestReplacer] executeScripts skipped - container or option false'); // スキップ理由
      return;
    }

    try {
      // container内のすべてのscriptタグを取得
      let scripts = container.querySelectorAll('script');

      // containerがscriptタグ自体の場合は、自分自身を対象にする
      if (container.tagName && container.tagName.toLowerCase() === 'script') {
        scripts = [container];
        this.log('[SiTestReplacer] Container is script tag itself'); // デバッグログ
      } else {
        // 通常のコンテナ内検索
        scripts = container.querySelectorAll('script');
      }

      this.log('[SiTestReplacer] Found scripts:', scripts.length, scripts); // デバッグログ

      // NodeListまたは配列を配列に変換
      const scriptsArray = Array.from(scripts);
      this.log('[SiTestReplacer] Scripts to process:', scriptsArray.length); // デバッグログ

      scriptsArray.forEach((oldScript, index) => {
        // 新しいscriptタグを作成
        const newScript = document.createElement('script');

        // 属性をコピー
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });

        // スクリプト内容をコピー
        if (oldScript.src) {
          // 外部スクリプトの場合
          newScript.src = oldScript.src;
          this.log(`Loading external script: ${oldScript.src}`);

          // 読み込み完了/エラー時のログ
          newScript.onload = () => {
            this.log(`External script loaded successfully: ${oldScript.src}`);
          };
          newScript.onerror = () => {
            this.error(`Failed to load external script: ${oldScript.src}`);
          };
        } else {
          // インラインスクリプトの場合
          newScript.textContent = oldScript.textContent;
          this.log(`Executing inline script (${oldScript.textContent.length} chars)`);
          // Script content logged only in debug mode
          if (this.options.debug) {
            this.log('[SiTestReplacer] Script content:', oldScript.textContent);
          }
        }

        // async/defer属性に応じて実行
        if (oldScript.src && (oldScript.async || oldScript.defer)) {
          // 外部スクリプトの非同期実行
          document.body.append(newScript);
        } else {
          // 同期実行
          document.body.append(newScript);
        }

        // 元のscriptタグを削除
        oldScript.remove();
      });

      if (scriptsArray.length > 0) {
        this.log(`Executed ${scriptsArray.length} script(s) from inserted HTML`);
        this.log('[SiTestReplacer] Scripts executed:', scriptsArray.length);
      } else {
        this.log('[SiTestReplacer] No scripts found in container:', container); // デバッグログ
      }

    } catch (error) {
      this.error('Failed to execute scripts:', error);
    }
  }



  /**
   * 複数操作の解析
   */
  parseMultipleOperations(element) {
    const operations = [];

    this.log('=== PARSE MULTIPLE OPERATIONS START ===');
    this.log('🔍 DEBUG: Element tag:', element.tagName);
    this.log('🔍 DEBUG: Element id:', element.id);
    this.log('🔍 DEBUG: Element class:', element.className);
    this.log('Element:', element);
    this.log('Element attributes:', element.attributes);

    // メイン操作（data-sitest-type）
    const mainType = element.getAttribute(this.options.attributeName);
    const mainUrl = element.getAttribute('data-sitest-url') || element.getAttribute('data-html-url');

    this.log('🎯 Main operation:', {
      type: mainType,
      url: mainUrl
    });

    if (mainType && mainType.toLowerCase() === 'after') {
      this.log('🔍 DEBUG: AFTER operation detected. Checking for unwanted attributes...');
      const allAttrs = Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`);
      this.log('🔍 All attributes:', allAttrs);
    }

    if (mainType) {
      operations.push({
        type: mainType,
        url: mainUrl,
        order: 1
      });
    }

    let operationIndex = 2;
    while (operationIndex <= 10) { // 最大10個まで
      const operationType = element.getAttribute(`data-sitest-type-${operationIndex}`);
      const operationUrl = element.getAttribute(`data-sitest-url-${operationIndex}`);

      this.log(`Additional operation ${operationIndex}:`, {
        type: operationType,
        url: operationUrl
      });

      if (!operationType) {
        operationIndex++;
        continue; // 次の番号をチェック
      }

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

    // 全ての属性をログ出力（デバッグ用）
    this.log('All element attributes:');
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      this.log(`  ${attr.name}: ${attr.value}`);
    }

    const filteredOperations = operations
      .filter(op => op && op.type && op.type.trim())
      .sort((a, b) => a.order - b.order);

    this.log('Final parsed operations:', filteredOperations);
    this.log('=== PARSE MULTIPLE OPERATIONS END ===');

    return filteredOperations;
  }

  /**
   * プレビューモード用のハイライトを作成
   */
  createPreviewHighlight(element, operations) {
    const elementId = element.dataset.sitestId;

    // 有効な操作のみをフィルタリング
    const validOperations = operations.filter(op => op && op.type && op.type.trim());

    if (validOperations.length === 0) {
      this.error('No valid operations found for element:', element);
      return;
    }

    // 要素のposition状態を確認
    const computedStyle = getComputedStyle(element);
    const currentPosition = computedStyle.position;

    // 古いクラスベースのハイライト（後方互換性）
    element.classList.add('sitest-preview-highlight');

    // position判定クラスを追加
    element.classList.add(`position-${currentPosition}`);

    // 削除操作があるかチェック
    const hasRemove = validOperations.some(op => op.type?.toLowerCase() === 'remove');
    if (hasRemove) {
      element.classList.add('remove-target');
    }

    const highlightType = hasRemove ? 'remove' : 'default';

    // デバッグ用：Remove操作の詳細をログ出力
    this.log(`Creating preview highlight for element:`, {
      elementTag: element.tagName,
      elementId: elementId,
      elementClasses: element.className,
      currentPosition: currentPosition,
      hasRemove: hasRemove,
      highlightType: highlightType,
      validOperations: validOperations.map(op => op.type)
    });

    this.createEnhancedHighlight(element, highlightType, validOperations);

    // サイドメニューに追加
    this.addElementToSideMenu(element, validOperations, elementId);

    this.log(`Preview highlight created for ${validOperations.length} operations (position: ${currentPosition}, type: ${highlightType})`);
  }

  /**
   * 強化されたハイライト表示（オーバーレイ方式）
   */
  createEnhancedHighlight(element, type = 'default', operations = []) {
    if (!element || !element.parentNode) {
      return null;
    }

    // 既存のオーバーレイハイライトを削除
    const existingHighlight = element.querySelector('.sitest-overlay-highlight');
    if (existingHighlight) {
      existingHighlight.remove();
    }

    // 要素の現在のpositionを確認
    const computedStyle = getComputedStyle(element);
    const currentPosition = computedStyle.position;

    // position対応：staticの場合のみrelativeに変更
    // ※ CSSクラスで制御されるので、ここではinline styleは設定しない
    if (currentPosition === 'static') {
      // staticの場合、CSSクラス .position-static で position: relative が適用される
      this.log(`Element position: static -> will be relative via CSS class`);
    } else {
      this.log(`Element position: ${currentPosition} -> no change needed`);
    }

    // オーバーレイ要素を作成
    const overlay = document.createElement('div');
    overlay.className = 'sitest-overlay-highlight';

    // タイプに応じてクラスを追加
    if (type === 'executed') {
      overlay.classList.add('executed');
    } else if (type === 'remove') {
      overlay.classList.add('remove-target');
    }

    // 操作タグを生成して設定
    const operationTags = this.generateOperationTags(operations, type);
    if (operationTags) {
      overlay.setAttribute('data-operation-tags', operationTags);
    }

    // デバッグ用：オーバーレイの詳細情報をログ出力
    this.log(`Creating overlay for ${type} type:`, {
      elementTag: element.tagName,
      elementClasses: element.className,
      elementPosition: currentPosition,
      overlayClasses: overlay.className,
      operationTags: operationTags,
      elementParent: element.parentNode?.tagName
    });

    element.append(overlay);

    // オーバーレイが正しく追加されたかチェック
    const addedOverlay = element.querySelector('.sitest-overlay-highlight');
    if (addedOverlay) {
      this.log('Overlay successfully added:', addedOverlay);
    } else {
      this.error('Failed to add overlay to element:', element);
    }

    this.log(`Enhanced highlight created for element with position: ${currentPosition}`);
    return overlay;
  }

  /**
   * 操作タグを生成（タグのようなUI表示用）
   */
  generateOperationTags(operations = [], type = 'default') {
    try {
      if (!operations || operations.length === 0) {
        // operationsが渡されない場合のフォールバック
        switch (type) {
          case 'remove':
            return '🗑️ REMOVE';
          case 'executed':
            return '✅ 完了';
          default:
            return '📝 変更';
        }
      }

      const tags = [];
      const typeIcons = {
        'remove': '🗑️',
        'outerHTML': '🔄',
        'outer': '🔄',
        'innerHTML': '📝',
        'inner': '📝',
        'insertAfter': '➕',
        'after': '➕',
        'insertBefore': '⬅️',
        'before': '⬅️'
      };

      const typeLabels = {
        'remove': '【remove】隠す(後続の要素を詰める)',
        'outerHTML': '【outer】HTMLを編集',
        'outer': '【outer】HTMLを編集',
        'innerHTML': 'INNER',
        'inner': 'INNER',
        'insertAfter': '【after】「直後」にHTMLを挿入',
        'after': '【after】「直後」にHTMLを挿入',
        'insertBefore': 'BEFORE',
        'before': 'BEFORE'
      };

      // 操作を順序でソート
      const sortedOps = [...operations].sort((a, b) => (a.order || 0) - (b.order || 0));

      sortedOps.forEach((op, index) => {
        if (op && op.type) {
          const opType = op.type.toLowerCase();
          const icon = typeIcons[opType] || '⚡';
          const label = typeLabels[opType] || opType.toUpperCase();

          // 複数操作がある場合は番号を追加
          const orderPrefix = sortedOps.length > 1 ? `${index + 1}.` : '';
          tags.push(`${orderPrefix}${icon}${label}`);
        }
      });

      // タグが長すぎる場合は省略
      const tagText = tags.join(' ');
      return tagText.length > 30 ? tagText.substring(0, 27) + '...' : tagText;

    } catch (error) {
      this.error('Failed to generate operation tags:', error);
      return type === 'remove' ? '🗑️ REMOVE' : '📝 変更';
    }
  }

  /**
   * メディアファイルのパス置換処理
   */
  replaceMediaPaths(content, contentType = 'unknown') {
    if (!this.options.mediaReplacement.enabled) {
      return content;
    }

    const {
      localPath,
      productionPath
    } = this.options.mediaReplacement;

    if (!localPath || !productionPath) {
      this.log('Media replacement is enabled but localPath or productionPath is missing');
      return content;
    }

    try {
      // 絶対パスで始まるローカルパスを本番パスに置換
      // 例: /sitest/img/example.jpg -> https://sitest.cdn.com/uploads/example.jpg

      // localPathをエスケープ（正規表現で使用するため）
      const escapedLocalPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 絶対パスで始まるローカルパスにマッチする正規表現
      const regex = new RegExp(escapedLocalPath, 'g');

      // 置換実行
      const replacedContent = content.replace(regex, productionPath);

      // 置換が行われた場合はログ出力
      const replacementCount = (content.match(regex) || []).length;
      if (replacementCount > 0) {
        this.log(`Media path replacement in ${contentType}:`, {
          replacements: replacementCount,
          from: localPath,
          to: productionPath,
          contentLength: content.length
        });
      }

      return replacedContent;
    } catch (error) {
      this.error('Failed to replace media paths:', error);
      return content; // エラー時は元のコンテンツを返す
    }
  }

  /**
   * ハイライトを削除
   */
  removeEnhancedHighlight(element) {
    if (!element) return;

    // オーバーレイを削除
    const overlay = element.querySelector('.sitest-overlay-highlight');
    if (overlay) {
      overlay.remove();
    }

    // position関連のクラスを削除
    element.classList.remove('position-static', 'position-absolute',
      'position-fixed', 'position-sticky', 'position-relative');

    // 古いハイライトクラスと実行済み状態クラスも削除
    element.classList.remove('sitest-preview-highlight', 'sitest-preview-replaced', 'remove-target');

    this.log('Enhanced highlight removed');
  }

  /**
   * プレビューモード用の完全なハイライト復元
   */
  restoreCompletePreviewHighlight(element, elementId) {
    try {
      this.log('Restoring complete preview highlight for:', elementId);

      // 既存のハイライト・状態をクリア
      this.removeEnhancedHighlight(element);

      // sitest-preview-replaced クラスを確実に削除
      element.classList.remove('sitest-preview-replaced');

      // 元の操作情報を取得
      const groupData = this.elementGroups.get(elementId);
      if (!groupData || !groupData.operations) {
        this.error('No operation data found for highlight restoration:', elementId);
        // フォールバック：基本的なハイライト
        element.classList.add('sitest-preview-highlight');
        this.createEnhancedHighlight(element, 'default', []);
        return;
      }

      const operations = groupData.operations;
      const hasRemove = operations.some(op => op.type?.toLowerCase() === 'remove');

      // 適切なクラスを設定
      element.classList.add('sitest-preview-highlight');

      if (hasRemove) {
        element.classList.add('remove-target');
      }

      // position状態を確認してクラス追加
      const computedStyle = getComputedStyle(element);
      const currentPosition = computedStyle.position;
      element.classList.add(`position-${currentPosition}`);

      // オーバーレイハイライトを再作成
      const highlightType = hasRemove ? 'remove' : 'default';

      // デバッグ用：復元時のハイライト作成をログ出力
      this.log(`Restoring highlight for element:`, {
        elementTag: element.tagName,
        elementId: elementId,
        elementClasses: element.className,
        currentPosition: currentPosition,
        hasRemove: hasRemove,
        highlightType: highlightType
      });

      this.createEnhancedHighlight(element, highlightType, operations);

      this.log('Complete preview highlight restored:', {
        elementId,
        hasRemove,
        position: currentPosition,
        highlightType
      });

    } catch (error) {
      this.error('Failed to restore complete preview highlight:', error);
      // エラー時のフォールバック
      element.classList.add('sitest-preview-highlight');
      this.createEnhancedHighlight(element, 'default', []);
    }
  }

  /**
   * すべてのハイライトを更新
   */
  updateAllHighlights() {
    // 🔧 実行済み要素：オーバーレイ削除（クラスベースのスタイルのみ）
    this.replacedElements.forEach((replacedElement, elementId) => {
      if (replacedElement && replacedElement.parentNode) {
        this.removeEnhancedHighlight(replacedElement);
        // 実行済み要素にはオーバーレイを追加しない
      }
    });

    // 未実行要素：デフォルトハイライト更新
    this.originalElements.forEach((originalElement, elementId) => {
      if (originalElement && originalElement.parentNode && !this.replacedElements.has(elementId)) {
        this.removeEnhancedHighlight(originalElement);

        // 元の操作情報を取得
        const groupData = this.elementGroups.get(elementId);
        const operations = groupData?.operations || [];

        this.createEnhancedHighlight(originalElement, 'default', operations);
      }
    });
  }

  /**
   * 複数操作を順次実行
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
          const result = await this.executeSingleOperation(currentElement, operation, currentParent, currentNext, elementId);
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
            result: {
              error: operationError.message
            },
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

      // 要素の見た目を更新（Remove操作の場合は特別な処理）
      const hasRemoveOperation = validOperations.some(op => op.type?.toLowerCase() === 'remove');

      if (currentElement && currentElement.parentNode && currentElement.classList) {
        if (hasRemoveOperation) {
          // Remove操作の場合：ハイライトクラスのみ削除し、オーバーレイは維持
          currentElement.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced');
          this.log('Remove operation completed - overlay preserved');
        } else {
          // 通常の操作：完全にハイライトを削除
          this.updateElementAppearance(currentElement, elementId, null, true);
        }
      } else {
        // currentElement が無効な場合は元の要素を使用
        this.log('currentElement is invalid, using original element');
        if (element && element.parentNode && element.classList) {
          if (hasRemoveOperation) {
            element.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced');
            this.log('Remove operation completed on original element - overlay preserved');
          } else {
            this.updateElementAppearance(element, elementId, null, true);
          }
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
        const errorMsg = `複数操作エラー: ${error.message}\n要素ID: ${elementId}\n\n詳細はコンソールを確認してください`;
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
        // 🔧 差し替え後：オーバーレイを削除して、古いクラスベースのスタイルのみ
        this.removeEnhancedHighlight(element);
        element.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced');

        // 🔧 プレビューモード時は sitest-preview-replaced クラスを追加しない
        // element.classList.add('sitest-preview-replaced');
      } else {
        // 復元後：デフォルトハイライトを表示
        this.removeEnhancedHighlight(element);
        element.classList.remove('sitest-preview-replaced');

        // デフォルトハイライトを追加
        this.createEnhancedHighlight(element, 'default');
        element.classList.add('sitest-preview-highlight');
      }
    } catch (error) {
      this.error('Failed to update element appearance:', error);
    }
  }

  /**
   * 単一操作を実行
   */
  async executeSingleOperation(element, operation, parentElement, nextElement, elementId = null) {
    // operation の有効性チェック
    if (!operation || !operation.type) {
      throw new Error('Invalid operation: operation is null or undefined');
    }

    const {
      type,
      url
    } = operation;

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

    this.log(`🔧 === EXECUTE SINGLE OPERATION: ${type.toLowerCase()} ===`);
    this.log(`🔧 DEBUG: Element:`, element);
    this.log(`🔧 DEBUG: Operation URL:`, url);
    this.log(`🔧 DEBUG: Original type:`, type);
    this.log(`🔧 DEBUG: Type length:`, type.length);
    this.log(`🔧 DEBUG: Type charCodes:`, Array.from(type).map(c => c.charCodeAt(0)));

    switch (type) {
      case 'outerHTML':
      case 'outer':
        this.log('🚨 Processing outerHTML operation');
        this.log('🚨 DEBUG: This should NOT happen for after operation!');
        const elementsToInsert = Array.from(tempDiv.childNodes).filter(node =>
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        );

        if (elementsToInsert.length === 0) {
          throw new Error('No valid elements found in HTML content');
        }

        try {
          const currentParent = element.parentNode;
          const currentNext = element.nextSibling;

          // 挿入される要素にマーカーを追加（復元時に特定するため）
          // elementIdがない場合はランダムIDを生成
          const safeElementId = elementId || element.dataset.sitestId || `temp-${Date.now()}`;
          const insertionMarker = `sitest-outer-${safeElementId}-${Date.now()}`;
          elementsToInsert.forEach((el, index) => {
            if (el.nodeType === Node.ELEMENT_NODE) {
              el.dataset.sitestOuterMarker = insertionMarker;
              if (index === 0) {
                // 最初の要素に元のIDを設定
                el.dataset.sitestId = safeElementId;
              }
            }
          });

          // 元の要素を削除
          element.remove();

          // 複数要素を順次挿入
          elementsToInsert.forEach(elementToInsert => {
            if (currentNext && currentNext.parentNode) {
              currentParent.insertBefore(elementToInsert, currentNext);
            } else {
              currentParent.append(elementToInsert);
            }
          });

          // 最後に挿入された要素を newElement とする
          newElement = elementsToInsert[elementsToInsert.length - 1];
          newParent = newElement.parentNode;
          newNext = newElement.nextSibling;

          // Script実行を追加（挿入された全要素に対して）
          elementsToInsert.forEach(insertedElement => {
            if (insertedElement.nodeType === Node.ELEMENT_NODE) {
              this.executeScripts(insertedElement);
            }
          });

          // outerHTML操作の場合は特別な戻り値
          return {
            type: 'replaced',
            element,
            newElement,
            newParent,
            newNext,
            insertedElements: elementsToInsert, // 挿入された全要素を記録
            insertionMarker, // マーカーも記録
            html
          };
        } catch (error) {
          throw new Error(`Failed to replace element: ${error.message}`);
        }
        break;

      case 'innerHTML':
      case 'inner':
        this.log('Processing innerHTML operation');
        if (!this.setHTMLSafely(element, html, 'innerHTML')) {
          throw new Error('Failed to set innerHTML');
        }

        // Script実行を追加
        this.executeScripts(element);

        newElement = element;
        newParent = element.parentNode;
        newNext = element.nextSibling;
        break;

      case 'insertAfter':
      case 'after':
        this.log('✅ Processing insertAfter operation');
        this.log('✅ DEBUG: This is the correct operation for after type!');

        // tempDivから全ての有効なノードを取得（outerHTMLと同様）
        const afterElements = Array.from(tempDiv.childNodes).filter(node =>
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        );

        if (afterElements.length === 0) {
          throw new Error('No valid elements found in HTML content for insertAfter');
        }

        this.log(`InsertAfter: Found ${afterElements.length} elements to insert`);

        try {
          const currentParent = element.parentNode;
          const currentNext = element.nextSibling;

          // 複数要素にマーカーを追加（復元時に特定するため）
          const safeElementId = elementId || element.dataset.sitestId || `temp-${Date.now()}`;
          const insertionMarker = `sitest-after-${safeElementId}-${Date.now()}`;
          afterElements.forEach((el, index) => {
            if (el.nodeType === Node.ELEMENT_NODE) {
              el.dataset.sitestAfterMarker = insertionMarker;
            }
          });

          // 複数要素を順次挿入
          afterElements.forEach(elementToInsert => {
            if (currentNext && currentNext.parentNode) {
              currentParent.insertBefore(elementToInsert, currentNext);
            } else {
              currentParent.append(elementToInsert);
            }
          });

          // Script実行を追加（挿入された全要素に対して）
          afterElements.forEach(insertedElement => {
            if (insertedElement.nodeType === Node.ELEMENT_NODE) {
              this.executeScripts(insertedElement);
            }
          });

          // insertAfterの場合、元の要素は残る
          newElement = element;
          newParent = element.parentNode;
          newNext = element.nextSibling;

          // 挿入された要素を記録（複数対応）
          return {
            type: 'replaced',
            element,
            newElement,
            newParent,
            newNext,
            insertedElements: afterElements, // 挿入された全要素を記録
            insertionMarker, // マーカーも記録
            html
          };
        } catch (error) {
          throw new Error(`Failed to insert element after: ${error.message}`);
        }
        break;

      case 'insertBefore':
      case 'before':
        this.log('Processing insertBefore operation');

        // tempDivから全ての有効なノードを取得（outerHTMLと同様）
        const beforeElements = Array.from(tempDiv.childNodes).filter(node =>
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && node.textContent.trim())
        );

        if (beforeElements.length === 0) {
          throw new Error('No valid elements found in HTML content for insertBefore');
        }

        this.log(`InsertBefore: Found ${beforeElements.length} elements to insert`);

        try {
          const currentParent = element.parentNode;

          // 複数要素にマーカーを追加（復元時に特定するため）
          const safeElementId = elementId || element.dataset.sitestId || `temp-${Date.now()}`;
          const insertionMarker = `sitest-before-${safeElementId}-${Date.now()}`;
          beforeElements.forEach((el, index) => {
            if (el.nodeType === Node.ELEMENT_NODE) {
              el.dataset.sitestBeforeMarker = insertionMarker;
            }
          });

          // 複数要素を順次挿入（逆順で挿入して正しい順序を保つ）
          beforeElements.reverse().forEach(elementToInsert => {
            currentParent.insertBefore(elementToInsert, element);
          });

          // Script実行を追加（挿入された全要素に対して）
          beforeElements.forEach(insertedElement => {
            if (insertedElement.nodeType === Node.ELEMENT_NODE) {
              this.executeScripts(insertedElement);
            }
          });

          // insertBeforeの場合、元の要素は残る
          newElement = element;
          newParent = element.parentNode;
          newNext = element.nextSibling;

          // 挿入された要素を記録（複数対応）
          return {
            type: 'replaced',
            element,
            newElement,
            newParent,
            newNext,
            insertedElements: beforeElements, // 挿入された全要素を記録
            insertionMarker, // マーカーも記録
            html
          };
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
      this.log('=== REVERT ELEMENT START ===', elementId);

      const original = this.originalElements.get(elementId);
      const replaced = this.replacedElements.get(elementId);

      this.log('Original data:', original);
      this.log('Replaced data:', replaced);

      if (!original || !replaced) {
        this.error('Original or replaced element not found');
        this.log('Available original elements:', Array.from(this.originalElements.keys()));
        this.log('Available replaced elements:', Array.from(this.replacedElements.keys()));
        return;
      }

      if (replaced.type === 'multiple') {
        this.log('Processing multiple operations revert');
        // 複数操作から復元
        this.revertMultipleOperations(elementId, button, original, replaced);
      } else if (replaced.type === 'removed') {
        this.log('Processing removed element revert');
        // 削除から復元（ハイライト完全復元対応版）
        replaced.element.style.display = '';

        // 実行済み状態クラスを確実に削除
        replaced.element.classList.remove('sitest-preview-replaced');

        // プレビューモードの場合は完全なハイライト復元を行う
        if (this.options.previewMode) {
          // 既存のハイライトをクリア
          this.removeEnhancedHighlight(replaced.element);

          // 元の操作情報を取得してハイライトを再作成
          const groupData = this.elementGroups.get(elementId);
          if (groupData && groupData.operations) {
            const hasRemove = groupData.operations.some(op => op.type?.toLowerCase() === 'remove');

            // 適切なクラスとオーバーレイを再設定
            replaced.element.classList.add('sitest-preview-highlight');
            if (hasRemove) {
              replaced.element.classList.add('remove-target');
            }

            // position状態を再確認してクラス追加
            const computedStyle = getComputedStyle(replaced.element);
            const currentPosition = computedStyle.position;
            replaced.element.classList.add(`position-${currentPosition}`);

            // オーバーレイハイライトを再作成
            const highlightType = hasRemove ? 'remove' : 'default';
            this.createEnhancedHighlight(replaced.element, highlightType);

            this.log('Enhanced highlight restored for removed element');
          } else {
            // フォールバック：基本的なハイライト復元
            replaced.element.classList.add('sitest-preview-highlight', 'remove-target');
            this.createEnhancedHighlight(replaced.element, 'remove', []);
          }
        } else {
          // 通常モード：従来通り
          replaced.element.classList.add('sitest-preview-highlight', 'remove-target');
        }
      } else if (replaced.type === 'replaced') {
        this.log('Processing replaced element revert');
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

        // プレビューモード用のハイライト完全復元
        if (this.options.previewMode) {
          this.restoreCompletePreviewHighlight(originalElement, elementId);
        } else {
          originalElement.classList.add('sitest-preview-highlight');
        }
        this.setElementPositionSafely(originalElement, elementId);

        // ボタンが存在する場合のみ追加（サイドメニュー対応）
        if (button) {
          originalElement.append(button);
        }

        this.originalElements.set(elementId, {
          element: originalElement,
          parentNode: originalElement.parentNode,
          nextSibling: originalElement.nextSibling
        });
      } else if (replaced.type === 'modified') {
        this.log('Processing modified element revert');
        // innerHTML等から復元（従来通り）
        const originalElement = original.element.cloneNode(true);

        const success = this.setHTMLSafely(replaced.element, originalElement.innerHTML, 'innerHTML');
        if (!success) {
          this.error('Failed to restore HTML content');
          return;
        }

        // 実行済み状態クラスを確実に削除
        replaced.element.classList.remove('sitest-preview-replaced');

        // プレビューモード用のハイライト完全復元
        if (this.options.previewMode) {
          this.restoreCompletePreviewHighlight(replaced.element, elementId);
        } else {
          replaced.element.classList.add('sitest-preview-highlight');
        }
      }

      // 差し替え情報を削除
      this.replacedElements.delete(elementId);

      // サイドメニューの状態を更新
      this.updateSideMenuElementState(elementId, false);

      // 要素グループの参照を更新
      this.updateElementGroupReference(elementId);

      this.log('=== REVERT ELEMENT SUCCESS ===', elementId);
      this.log(`Element reverted: ${elementId}`);

    } catch (error) {
      this.log('=== REVERT ELEMENT ERROR ===', error);
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
      this.log('=== REVERT MULTIPLE OPERATIONS START ===');
      this.log('Element ID:', elementId);
      this.log('Original:', original);
      this.log('Replaced:', replaced);

      let revertedElement = null;

      // 挿入された要素をすべて削除
      const insertedElements = this.findInsertedElements(replaced.executedOperations);
      this.log('Inserted elements to remove:', insertedElements);
      insertedElements.forEach(el => {
        if (el && el.parentNode) {
          this.log('Removing inserted element:', el);
          el.remove();
        }
      });

      // outerHTML操作があったかチェック
      const outerHTMLOperation = replaced.executedOperations.find(execOp =>
        execOp.operation && execOp.operation.type && ['outerHTML', 'outer'].includes(execOp.operation.type.toLowerCase())
      );

      this.log('OuterHTML operation:', outerHTMLOperation);

      if (outerHTMLOperation) {
        // outerHTML操作の場合：置き換えられた全ての要素を削除して元の要素を復元
        this.log('Processing outerHTML revert');

        // outerHTML操作で挿入された全ての要素を特定して削除
        const replacedElementsToRemove = [];

        // data-sitest-idを持つ要素（メインの置き換えられた要素）
        const mainReplacedElement = document.querySelector(`[data-sitest-id="${elementId}"]`);
        if (mainReplacedElement) {
          replacedElementsToRemove.push(mainReplacedElement);
          this.log('Found main replaced element:', mainReplacedElement);
        }

        // その他の関連要素も探す（outerHTMLで挿入された兄弟要素など）
        if (replaced.element && replaced.element.parentNode) {
          // replaced.elementとその兄弟要素をチェック
          const parent = replaced.element.parentNode;
          const children = Array.from(parent.children);

          // 元の要素の位置付近の要素を特定
          const originalPosition = Array.from(parent.children).indexOf(replaced.element);
          this.log('Original position in parent:', originalPosition);

          // outerHTML操作の結果として挿入された可能性のある要素を収集
          // （この部分は、実際のHTML構造に応じて調整が必要）
          if (replaced.element) {
            replacedElementsToRemove.push(replaced.element);
          }
        }

        this.log('Elements to remove for outerHTML revert:', replacedElementsToRemove);

        // 挿入位置を記録（最初の要素の位置を使用）
        let insertionParent = null;
        let insertionNext = null;

        if (replacedElementsToRemove.length > 0 && replacedElementsToRemove[0].parentNode) {
          insertionParent = replacedElementsToRemove[0].parentNode;
          insertionNext = replacedElementsToRemove[0].nextSibling;
        }

        // 全ての置き換えられた要素を削除
        replacedElementsToRemove.forEach(el => {
          if (el && el.parentNode) {
            this.log('Removing replaced element:', el);
            el.remove();
          }
        });

        // 元の要素を復元
        const originalElement = original.element.cloneNode(true);
        originalElement.dataset.sitestId = elementId;

        if (insertionParent) {
          if (insertionNext && insertionNext.parentNode === insertionParent) {
            insertionParent.insertBefore(originalElement, insertionNext);
          } else {
            insertionParent.appendChild(originalElement);
          }
          this.log('Restored original element at recorded position');
        } else if (original.parentNode) {
          // フォールバック：元の位置情報を使用
          if (original.nextSibling && original.nextSibling.parentNode === original.parentNode) {
            original.parentNode.insertBefore(originalElement, original.nextSibling);
          } else {
            original.parentNode.appendChild(originalElement);
          }
          this.log('Restored original element at original position');
        } else {
          throw new Error('Cannot determine position to restore element');
        }

        // プレビューモード用のハイライト完全復元
        if (this.options.previewMode) {
          this.restoreCompletePreviewHighlight(originalElement, elementId);
        } else {
          originalElement.classList.add('sitest-preview-highlight');
        }
        this.setElementPositionSafely(originalElement, elementId);
        revertedElement = originalElement;

      } else {
        // 通常の復元処理（outerHTML以外）
        this.log('Processing normal revert');

        if (replaced.element && replaced.element.parentNode && replaced.element.style) {
          if (replaced.element.style.display === 'none') {
            replaced.element.style.display = '';

            // プレビューモード用のハイライト完全復元
            if (this.options.previewMode) {
              this.restoreCompletePreviewHighlight(replaced.element, elementId);
            }

            revertedElement = replaced.element;
            this.log('Restored hidden element');
          } else {
            const originalElement = original.element.cloneNode(true);
            originalElement.dataset.sitestId = elementId;

            replaced.element.parentNode.replaceChild(originalElement, replaced.element);

            // プレビューモード用のハイライト完全復元
            if (this.options.previewMode) {
              this.restoreCompletePreviewHighlight(originalElement, elementId);
            } else {
              originalElement.classList.add('sitest-preview-highlight');
            }
            this.setElementPositionSafely(originalElement, elementId);

            revertedElement = originalElement;
            this.log('Replaced with original element');
          }
        } else {
          const originalElement = original.element.cloneNode(true);
          originalElement.dataset.sitestId = elementId;

          if (original.parentNode) {
            if (original.nextSibling && original.nextSibling.parentNode === original.parentNode) {
              original.parentNode.insertBefore(originalElement, original.nextSibling);
            } else {
              original.parentNode.appendChild(originalElement);
            }

            // プレビューモード用のハイライト完全復元
            if (this.options.previewMode) {
              this.restoreCompletePreviewHighlight(originalElement, elementId);
            } else {
              originalElement.classList.add('sitest-preview-highlight');
            }
            this.setElementPositionSafely(originalElement, elementId);
            revertedElement = originalElement;
            this.log('Restored to original position');
          }
        }
      }

      // 3. 要素グループの参照を更新
      if (revertedElement) {
        this.log('Updating element group references');
        const groupData = this.elementGroups.get(elementId);
        if (groupData) {
          groupData.element = revertedElement;
          this.elementGroups.set(elementId, groupData);

          // 4. イベントリスナーを再設定
          this.reattachEventListeners(groupData.group, revertedElement, groupData.operations, elementId);
        }

        // 5. originalElements の参照も更新
        this.originalElements.set(elementId, {
          element: revertedElement.cloneNode(true),
          parentNode: revertedElement.parentNode,
          nextSibling: revertedElement.nextSibling
        });

        this.log('=== REVERT MULTIPLE OPERATIONS SUCCESS ===');
      } else {
        this.log('=== REVERT MULTIPLE OPERATIONS FAILED - No element restored ===');
      }

      return revertedElement;

    } catch (error) {
      this.log('=== REVERT MULTIPLE OPERATIONS ERROR ===', error);
      this.error('Failed to revert multiple operations:', error);
      this.error('Error details:', error.stack);
      throw error;
    }
  }

  /**
   * 復元された要素にイベントリスナーを再設定
   */
  reattachEventListeners(group, element, operations, elementId) {
    try {
      this.log('Reattaching event listeners for:', elementId);

      // 既存のイベントリスナーをクリア（groupの中のボタン要素を再取得）
      const executeBtn = group.querySelector('.execute');
      const navigateBtn = group.querySelector('.navigate');
      const previewBtn = group.querySelector('.preview');
      const revertBtn = group.querySelector('.revert');

      // 新しいイベントリスナーを設定（setupElementGroupEventsと同じロジック）
      if (executeBtn) {
        // 既存のイベントリスナーを削除してから新しいものを追加
        const newExecuteBtn = executeBtn.cloneNode(true);
        executeBtn.parentNode.replaceChild(newExecuteBtn, executeBtn);

        newExecuteBtn.addEventListener('click', async () => {
          try {
            newExecuteBtn.disabled = true;
            newExecuteBtn.textContent = '⏳ 実行中...';

            await this.executeElementOperations(element, operations, elementId);

            // UIを更新
            newExecuteBtn.style.display = 'none';
            const newRevertBtn = group.querySelector('.revert');
            if (newRevertBtn) {
              newRevertBtn.disabled = false;
              newRevertBtn.style.display = 'inline-block';
            }

          } catch (error) {
            this.error('Failed to execute from side menu:', error);
            newExecuteBtn.textContent = '⚠ エラー';
            newExecuteBtn.disabled = false;
          }
        });
      }

      if (navigateBtn) {
        const newNavigateBtn = navigateBtn.cloneNode(true);
        navigateBtn.parentNode.replaceChild(newNavigateBtn, navigateBtn);

        newNavigateBtn.addEventListener('click', () => {
          this.navigateToElement(elementId);
        });
      }

      if (previewBtn) {
        const newPreviewBtn = previewBtn.cloneNode(true);
        previewBtn.parentNode.replaceChild(newPreviewBtn, previewBtn);

        newPreviewBtn.addEventListener('click', () => {
          this.log('Element preview button clicked!', newPreviewBtn);

          this.resetActivePreviewButton();
          this.setActivePreviewButton(newPreviewBtn, '💻コード');
          this.showOperationsPreview(operations);
        });
      }

      if (revertBtn) {
        const newRevertBtn = revertBtn.cloneNode(true);
        revertBtn.parentNode.replaceChild(newRevertBtn, revertBtn);

        newRevertBtn.addEventListener('click', () => {
          try {
            this.revertElement(elementId, null);

            const newExecuteBtn = group.querySelector('.execute');
            if (newExecuteBtn) {
              newExecuteBtn.style.display = 'inline-block';
              newExecuteBtn.disabled = false;
              newExecuteBtn.textContent = '実行';
            }
            newRevertBtn.disabled = true;
            newRevertBtn.style.display = 'none';

          } catch (error) {
            this.error('Failed to revert from side menu:', error);
          }
        });
      }

      this.log('Event listeners reattached successfully');

    } catch (error) {
      this.error('Failed to reattach event listeners:', error);
    }
  }

  /**
   * 挿入された要素を特定
   */
  findInsertedElements(executedOperations) {
    const insertedElements = [];

    if (!executedOperations || !Array.isArray(executedOperations)) {
      this.log('No executed operations to check for inserted elements');
      return insertedElements;
    }

    executedOperations.forEach((execOp, index) => {
      this.log(`Checking executed operation ${index}:`, execOp);

      if (execOp.operation && execOp.result) {
        const opType = execOp.operation.type?.toLowerCase();

        // outerHTML操作で挿入された全要素を特定
        if (opType === 'outerHTML' || opType === 'outer') {
          if (execOp.result.insertedElements && Array.isArray(execOp.result.insertedElements)) {
            this.log(`Found ${execOp.result.insertedElements.length} elements from outerHTML:`, execOp.result.insertedElements);
            execOp.result.insertedElements.forEach(el => {
              if (!insertedElements.includes(el)) {
                insertedElements.push(el);
              }
            });
          }

          // マーカーを使って要素を探す
          if (execOp.result.insertionMarker) {
            const markedElements = document.querySelectorAll(`[data-sitest-outer-marker="${execOp.result.insertionMarker}"]`);
            this.log(`Found ${markedElements.length} elements by marker:`, markedElements);
            markedElements.forEach(el => {
              if (!insertedElements.includes(el)) {
                insertedElements.push(el);
              }
            });
          }
        }

        // insertAfter, insertBefore 操作で挿入された要素を特定
        if (opType === 'insertAfter' || opType === 'insertBefore' || opType === 'after' || opType === 'before') {
          // 従来の単一要素記録
          if (execOp.result.insertedElement) {
            this.log(`Found inserted element from ${opType}:`, execOp.result.insertedElement);
            insertedElements.push(execOp.result.insertedElement);
          }

          // 新しい複数要素記録
          if (execOp.result.insertedElements && Array.isArray(execOp.result.insertedElements)) {
            this.log(`Found ${execOp.result.insertedElements.length} elements from ${opType}:`, execOp.result.insertedElements);
            execOp.result.insertedElements.forEach(el => {
              if (!insertedElements.includes(el)) {
                insertedElements.push(el);
              }
            });
          }

          // マーカーを使って要素を探す
          if (execOp.result.insertionMarker) {
            const markerSelectors = [
              `[data-sitest-after-marker="${execOp.result.insertionMarker}"]`,
              `[data-sitest-before-marker="${execOp.result.insertionMarker}"]`
            ];

            markerSelectors.forEach(selector => {
              const markedElements = document.querySelectorAll(selector);
              this.log(`Found ${markedElements.length} elements by marker (${selector}):`, markedElements);
              markedElements.forEach(el => {
                if (!insertedElements.includes(el)) {
                  insertedElements.push(el);
                }
              });
            });
          }

          // 結果の新しい要素も確認
          if (execOp.result.newElement &&
            execOp.result.newElement !== execOp.result.insertedElement) {
            // 重複を避けて追加
            if (!insertedElements.includes(execOp.result.newElement)) {
              insertedElements.push(execOp.result.newElement);
            }
          }
        }

        // その他の操作でも追加された要素があるかチェック
        if (execOp.result.insertedElements && Array.isArray(execOp.result.insertedElements)) {
          execOp.result.insertedElements.forEach(el => {
            if (!insertedElements.includes(el)) {
              insertedElements.push(el);
            }
          });
        }
      }
    });

    // DOM内に存在する要素のみをフィルタリング
    const validElements = insertedElements.filter(el => {
      const isValid = el && el.parentNode && document.contains(el);
      if (!isValid && el) {
        this.log('Skipping element not in DOM:', el);
      }
      return isValid;
    });

    this.log('Final inserted elements to remove:', validElements);
    return validElements;
  }

  /**
   * タイプの表示テキストを取得
   */
  getTypeDisplayText(type) {
    const typeMap = {
      'outerHTML': 'outerHTML（要素全体置換）',
      'outer': 'outerHTML（要素全体置換）',
      'innerHTML': 'innerHTML（内容置換）',
      'inner': 'innerHTML（内容置換）',
      'insertAfter': 'insertAfter（後に挿入）',
      'after': 'insertAfter（後に挿入）',
      'insertBefore': 'insertBefore（前に挿入）',
      'before': 'insertBefore（前に挿入）',
      'remove': 'remove（要素削除）'
    };
    return typeMap[type.toLowerCase()] || type;
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

      this.log(`📋 Processing element with ${operations.length} operations`);

      // 🚨 DEBUG: どの操作が実際にパースされたかを明確に表示
      operations.forEach((op, idx) => {
        this.log(`📋 Operation ${idx + 1}: ${op.type} (order: ${op.order}, url: ${op.url})`);
      });

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

        const result = await this.executeSingleOperation(currentElement, operation, currentElement.parentNode, currentElement.nextSibling, elementId);

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

      // 🔧 通常モードでも全差し替え完了後にJS実行
      if (!this.options.previewMode && elements.length > 0 && this.options.executeAfterAllReplacements) {
        this.log(`All ${elements.length} operations completed in normal mode. Executing site script...`);
        await this.loadAndExecuteScript();
      }

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

    // プレビューWindow関連の状態をクリア
    this.closeActivePreviewWindow();
    this.resetActivePreviewButton();

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

    this.log('SiTestReplacer state reset with new UI and window management');
  }
}