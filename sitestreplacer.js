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
    this.controlButtons = new Set(); // コントロールボタン管理
    this.originalElements = new Map(); // 元の要素を保存
    this.replacedElements = new Map(); // 差し替え後の要素を保存
    this.originalStyles = new Map(); // 元のスタイルを保存

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
      
      /* コントロールボタン */
      .sitest-control-button {
        position: absolute !important;
        top: -15px !important;
        right: -15px !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        border: 2px solid #ff6b35 !important;
        background: white !important;
        color: #ff6b35 !important;
        font-size: 14px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        transition: all 0.2s ease !important;
        z-index: 10001 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      }
      
      .sitest-control-button:hover {
        background: #ff6b35 !important;
        color: white !important;
        transform: scale(1.1) !important;
      }
      
      .sitest-control-button.remove-type {
        border-color: #e74c3c !important;
        color: #e74c3c !important;
      }
      
      .sitest-control-button.remove-type:hover {
        background: #e74c3c !important;
        color: white !important;
      }
      
      .sitest-control-button.replaced {
        border-color: #27ae60 !important;
        color: #27ae60 !important;
        background: #e8f5e8 !important;
      }
      
      .sitest-control-button.replaced:hover {
        background: #27ae60 !important;
        color: white !important;
      }
      
      /* 複数操作用のスタイル */
      .sitest-control-button.multiple-ops {
        background: linear-gradient(45deg, #ff6b35, #27ae60) !important;
        color: white !important;
        border: 2px solid #ff6b35 !important;
      }
      
      .sitest-control-button.multiple-ops:hover {
        background: linear-gradient(45deg, #e55a2b, #219a52) !important;
        transform: scale(1.1) !important;
      }
      
      /* 差し替え済み要素のハイライト */
      .sitest-preview-replaced {
        outline: 3px solid #27ae60 !important;
        background-color: rgba(39, 174, 96, 0.1) !important;
      }
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
   * プレビューモード用のハイライトとコントロールボタンを作成（複数操作対応）
   */
  createPreviewHighlight(element, operations) {
    const elementId = element.dataset.sitestId;

    // 有効な操作のみをフィルタリング
    const validOperations = operations.filter(op => op && op.type && op.type.trim());

    if (validOperations.length === 0) {
      this.error('No valid operations found for element:', element);
      return;
    }

    // 元の要素を保存
    this.originalElements.set(elementId, {
      element: element.cloneNode(true),
      parentNode: element.parentNode,
      nextSibling: element.nextSibling
    });

    // 要素をハイライト
    element.classList.add('sitest-preview-highlight');

    // 削除操作があるかチェック
    const hasRemove = validOperations.some(op => op.type?.toLowerCase() === 'remove');
    if (hasRemove) {
      element.classList.add('remove-target');
    }

    // コントロールボタンを作成（有効な操作のみ）
    const controlButton = this.createControlButton(element, validOperations, elementId);
    this.controlButtons.add(controlButton);

    // オーバーレイを作成（有効な操作のみ）
    const overlay = this.createInfoOverlay(element, validOperations);
    this.previewOverlays.add(overlay);

    this.log(`Preview highlight with control button created for ${validOperations.length} operations`);
  }

  /**
   * コントロールボタンを作成（複数操作対応）
   */
  createControlButton(element, operations, elementId) {
    const button = document.createElement('div');

    // 複数操作の場合は特別なクラス
    const hasRemove = operations.some(op => op.type?.toLowerCase() === 'remove');
    const isMultiple = operations.length > 1;

    button.className = `sitest-control-button${hasRemove ? ' remove-type' : ''}${isMultiple ? ' multiple-ops' : ''}`;

    // 初期状態のアイコン
    this.updateButtonState(button, false, operations);

    // ボタンクリックイベント
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();

      const isReplaced = button.classList.contains('replaced');

      if (isReplaced) {
        // 元に戻す
        this.revertElement(elementId, button);
      } else {
        // 複数操作実行
        await this.executeMultipleOperations(element, operations, elementId, button);
      }
    });

    // 要素に相対位置を設定してボタンを配置
    this.setElementPositionSafely(element, elementId);
    element.appendChild(button);

    this.log(`Control button created for ${operations.length} operations`);
    return button;
  }

  /**
   * ボタンの状態を更新（複数操作対応）
   */
  updateButtonState(button, isReplaced, operations) {
    if (isReplaced) {
      button.innerHTML = '↶';
      button.title = '元に戻す';
      button.classList.add('replaced');
    } else {
      // operations が配列かどうかをチェック
      const operationsArray = Array.isArray(operations) ? operations : [operations];

      // undefined や null を除外
      const validOperations = operationsArray.filter(op => op && op.type);

      const hasRemove = validOperations.some(op => op.type?.toLowerCase() === 'remove');
      const isMultiple = validOperations.length > 1;

      if (hasRemove && !isMultiple) {
        button.innerHTML = '✕';
        button.title = '削除実行';
      } else if (isMultiple) {
        button.innerHTML = '⚡';
        button.title = `${validOperations.length}つの操作を実行`;
      } else {
        button.innerHTML = '⚡';
        button.title = '差し替え実行';
      }
      button.classList.remove('replaced');
    }
  }

  /**
   * 情報オーバーレイを作成（複数操作対応）
   */
  createInfoOverlay(element, operations) {
    const overlay = document.createElement('div');
    overlay.className = `sitest-preview-overlay sitest-preview-${this.options.previewPosition}`;
    overlay.style.display = 'none'; // 初期状態は非表示

    const hasRemove = operations.some(op => op.type?.toLowerCase() === 'remove');
    if (hasRemove) {
      overlay.classList.add('remove-type');
    }

    const isMultiple = operations.length > 1;
    const actionText = hasRemove ? '削除含む操作' : (isMultiple ? '複数操作予定' : '差し替え予定');

    // 操作リストを生成
    const operationsList = operations.map((op, index) => {
      const typeText = this.getTypeDisplayText(op.type);
      const fileText = op.url ? op.url.split('/').pop() : '（ファイル不要）';
      return `${index + 1}. ${typeText}${op.url ? ` - ${fileText}` : ''}`;
    }).join('<br>');

    overlay.innerHTML = `
      <div class="sitest-preview-overlay-close">&times;</div>
      <div class="sitest-preview-overlay-header">${actionText}</div>
      <div class="sitest-preview-overlay-content">
        <strong>操作数:</strong> ${operations.length}個<br>
        <strong>実行順序:</strong><br>
        ${operationsList}<br><br>
        <strong>操作:</strong> 右上ボタンで実行/元に戻す
      </div>
    `;

    // クローズボタンのイベント
    const closeBtn = overlay.querySelector('.sitest-preview-overlay-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.style.display = 'none';
    });

    // HTMLプレビュー（最初の操作のみ、削除以外）
    const firstNonRemoveOp = operations.find(op => op.type?.toLowerCase() !== 'remove' && op.url);
    if (firstNonRemoveOp) {
      overlay.addEventListener('click', () => {
        this.showHTMLPreview(firstNonRemoveOp.url, firstNonRemoveOp.type);
      });
      overlay.style.cursor = 'pointer';
      overlay.title = 'クリックで最初のHTMLプレビューを表示';
    }

    // 要素クリックでオーバーレイ表示/非表示
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isVisible = overlay.style.display !== 'none';
      overlay.style.display = isVisible ? 'none' : 'block';
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * 複数操作を順次実行
   */
  async executeMultipleOperations(element, operations, elementId, button) {
    try {
      button.innerHTML = '⏳';
      button.title = '処理中...';

      // デバッグ：受け取った operations をログ出力
      this.log('Received operations:', operations);

      // 有効な操作のみをフィルタリング
      const validOperations = operations.filter((op, index) => {
        const isValid = op && op.type && op.type.trim();
        if (!isValid) {
          this.log(`Invalid operation at index ${index}:`, op);
        }
        return isValid;
      });

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

        // DOM操作前の存在チェック
        if (operation.type.toLowerCase() !== 'remove' && (!currentElement || !currentElement.parentNode)) {
          throw new Error(`Element is no longer in the DOM at operation ${i + 1}`);
        }

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
        } else {
          this.log(`No newElement in result, keeping currentElement:`, currentElement);
          this.log(`Result was:`, result);
        }

        // 削除操作の場合は後続操作をスキップ
        if (operation && operation.type && operation.type.toLowerCase() === 'remove') {
          this.log('Remove operation executed, skipping remaining operations');
          break;
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

      // 要素の見た目を更新（currentElement の存在チェック）
      if (currentElement && currentElement.parentNode && currentElement.classList) {
        currentElement.classList.remove('sitest-preview-highlight', 'remove-target');
        currentElement.classList.add('sitest-preview-replaced');

        // ボタンを新しい要素に移動
        this.setElementPositionSafely(currentElement, elementId);
        currentElement.appendChild(button);
      } else {
        // currentElement が無効な場合は元の要素を使用
        this.log('currentElement is invalid, using original element');
        if (element && element.parentNode && element.classList) {
          element.classList.remove('sitest-preview-highlight', 'remove-target');
          element.classList.add('sitest-preview-replaced');
          this.setElementPositionSafely(element, elementId);
          element.appendChild(button);
        }
      }

      this.updateButtonState(button, true, validOperations);
      this.log(`Multiple operations executed for element: ${elementId}`);

    } catch (error) {
      this.error('Failed to execute multiple operations:', error);
      this.error('Error stack:', error.stack);
      button.innerHTML = '⚠';
      button.title = `エラーが発生しました: ${error.message}`;

      if (this.options.debug) {
        const errorMsg = `複数操作エラー: ${error.message}\n要素ID: ${elementId}\n\n詳細はコンソールを確認してください`;
        setTimeout(() => alert(errorMsg), 100);
      }
    }
  }

  /**
   * 単一操作を実行
   */
  async executeSingleOperation(element, operation, parentElement, nextElement) {
    // operation の有効性チェック
    if (!operation || !operation.type) {
      throw new Error('Invalid operation: operation is null or undefined');
    }

    const {
      type,
      url
    } = operation;

    if (type.toLowerCase() === 'remove') {
      if (!element || !element.style) {
        throw new Error('Element is invalid for remove operation');
      }
      element.style.display = 'none';
      return {
        type: 'removed',
        element,
        newElement: element,
        newParent: parentElement,
        newNext: nextElement
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

    switch (type.toLowerCase()) {
      case 'outerhtml':
      case 'outer':
        newElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (newElement && parentElement && element && element.parentNode) {
          parentElement.replaceChild(newElement, element);
          newParent = newElement.parentNode;
          newNext = newElement.nextSibling;
        } else {
          throw new Error('Cannot replace element: missing required elements');
        }
        break;

      case 'innerhtml':
      case 'inner':
        if (!this.setHTMLSafely(element, html, 'innerHTML')) {
          throw new Error('Failed to set innerHTML');
        }
        newElement = element;
        break;

      case 'insertafter':
      case 'after':
        newElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (newElement && parentElement) {
          if (nextElement) {
            parentElement.insertBefore(newElement, nextElement);
          } else {
            parentElement.appendChild(newElement);
          }
          // insertAfterの場合、元の要素は残る
          newElement = element;
        }
        break;

      case 'insertbefore':
      case 'before':
        newElement = tempDiv.firstElementChild || tempDiv.firstChild;
        if (newElement && parentElement) {
          parentElement.insertBefore(newElement, element);
          // insertBeforeの場合、元の要素は残る
          newElement = element;
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
        originalElement.appendChild(button);

        this.originalElements.set(elementId, {
          element: originalElement.cloneNode(true),
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

      // ボタン状態を更新
      const operations = this.parseMultipleOperations(button.parentNode);
      this.updateButtonState(button, false, operations);

      this.log(`Element reverted: ${elementId}`);

    } catch (error) {
      this.error('Failed to revert element:', error);
      button.innerHTML = '⚠';
      button.title = `復元エラー: ${error.message}`;

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
          originalElement.appendChild(button);

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
          originalElement.appendChild(button);
          revertedElement = originalElement;
        }
      }

      this.log(`Multiple operations reverted for element: ${elementId}`);
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
    // ハイライトクラスは残す（コントロールボタンが管理）
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
        🔸 <strong>緑枠:</strong> 差し替え済み要素<br>
        🔸 <strong>右上ボタン:</strong> 実行/元に戻す<br>
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

    // コントロールボタンを削除
    this.controlButtons.forEach(button => {
      if (button.parentNode) {
        button.remove();
      }
    });
    this.controlButtons.clear();

    // ハイライトクラスを削除
    document.querySelectorAll('.sitest-preview-highlight, .sitest-preview-replaced').forEach(element => {
      element.classList.remove('sitest-preview-highlight', 'remove-target', 'sitest-preview-replaced');
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

    this.log('SiTestReplacer state reset');
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
