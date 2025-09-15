(() => {
  'use strict';
  
  // =============================================================================
  // 設定とグローバル変数
  // =============================================================================
  
  const CONFIG = {
    BATCH_SIZE: 10,
    SCROLL_DELAY: 200,
    NETWORK_DELAY: 100,
    PROGRESS_UPDATE_INTERVAL: 50,
    MAX_PARALLEL_DOWNLOADS: 5,
    SUPPORTED_EXTENSIONS: {
      images: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'cur', 'avif'],
      fonts: ['woff', 'woff2', 'ttf', 'otf', 'eot'],
      styles: ['css', 'scss', 'sass'],
      scripts: ['js', 'mjs', 'ts'],
      documents: ['html', 'htm', 'xml'],
      media: ['mp4', 'webm', 'ogg', 'mp3', 'wav', 'flac'],
      data: ['json', 'xml', 'csv', 'txt']
    },
    HOVER_ATTRIBUTES: [
      'data-hover-src', 'data-rollover', 'data-hover', 'data-mouseover',
      'data-original', 'data-alternate', 'data-swap', 'data-toggle'
    ],
    OGP_SELECTORS: [
      'meta[property="og:image"]',
      'meta[property="og:image:secure_url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
      'link[rel="image_src"]'
    ]
  };
  
  // 既存パネルの削除
  document.getElementById('rm-panel')?.remove();
  
  // グローバル状態管理
  const State = {
    resources: new Map(),
    downloadReport: {
      success: [],
      failed: [],
      startTime: null,
      endTime: null,
      totalSize: 0
    },
    ui: {
      panel: null,
      progressBar: null,
      isDownloading: false,
      manualUrls: new Set()
    },
    currentDomain: location.origin,
    baseUrl: location.href,
    hoverDetection: {
      detectedImages: new Set(),
      isScanning: false
    }
  };
  
  // =============================================================================
  // ユーティリティ関数
  // =============================================================================
  
  const Utils = {
    /**
     * 安全なURL作成
     */
    createSafeURL(url, baseUrl = State.baseUrl) {
      try {
        return new URL(url, baseUrl).href;
      } catch (e) {
        console.warn(`Invalid URL: ${url}`, e);
        return null;
      }
    },
    
    /**
     * 同一ドメインチェック
     */
    isSameDomain(url) {
      try {
        return new URL(url).origin === State.currentDomain;
      } catch (e) {
        return false;
      }
    },
    
    /**
     * ファイル拡張子取得
     */
    getFileExtension(url) {
      try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop().toLowerCase().split('?')[0];
        return ext || 'html';
      } catch (e) {
        return 'unknown';
      }
    },
    
    /**
     * ファイルタイプ判定
     */
    getFileType(url) {
      const ext = this.getFileExtension(url);
      for (const [type, extensions] of Object.entries(CONFIG.SUPPORTED_EXTENSIONS)) {
        if (extensions.includes(ext)) return type;
      }
      return 'others';
    },
    
    /**
     * ファイルサイズフォーマット
     */
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * 遅延実行
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * バッチ処理
     */
    async processBatch(items, processor, batchSize = CONFIG.BATCH_SIZE) {
      const results = [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map(processor));
        results.push(...batchResults);
        
        if (i + batchSize < items.length) {
          await this.delay(CONFIG.NETWORK_DELAY);
        }
      }
      return results;
    }
  };

  // =============================================================================
  // ホバー画像検出モジュール
  // =============================================================================
  
  const HoverImageDetector = {
    /**
     * ホバー画像の完全検出
     */
    async detectHoverImages() {
      console.groupCollapsed('🖱️ ホバー画像検出を開始...');
      State.hoverDetection.isScanning = true;
      
      const detectedImages = new Set();
      
      try {
        // 1. DOM属性ベースの検出
        await this.detectAttributeBasedHoverImages(detectedImages);
        
        // 2. CSS hover状態の検出
        await this.detectCSSHoverImages(detectedImages);
        
        // 3. イベントリスナーシミュレーション（最適化済み）
        await this.simulateHoverEvents(detectedImages);
        
        State.hoverDetection.detectedImages = detectedImages;
        
      } catch (e) {
        console.warn('ホバー画像検出エラー:', e);
      } finally {
        State.hoverDetection.isScanning = false;
      }
      
      console.groupEnd();
      console.log(`✅ ホバー画像検出完了: ${detectedImages.size}個`);
      
      return Array.from(detectedImages);
    },
    
    /**
     * 属性ベースのホバー画像検出
     */
    async detectAttributeBasedHoverImages(detectedImages) {
      console.log('🔍 属性ベースのホバー画像を検出中...');
      
      document.querySelectorAll('img, [class*="image"], [class*="img"]').forEach(el => {
        CONFIG.HOVER_ATTRIBUTES.forEach(attr => {
          const hoverSrc = el.getAttribute(attr);
          if (hoverSrc) {
            const absoluteUrl = Utils.createSafeURL(hoverSrc);
            if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
              detectedImages.add(absoluteUrl);
              console.log(`  📸 属性検出: ${attr} -> ${hoverSrc}`);
            }
          }
        });
        
        // class名からホバー画像を推測
        if (el.className && el.className.includes('hover')) {
          this.analyzeClassBasedHover(el, detectedImages);
        }
      });
    },
    
    /**
     * CSS hover状態の検出
     */
    async detectCSSHoverImages(detectedImages) {
      console.log('🎨 CSS hover状態を解析中...');
      
      for (const sheet of document.styleSheets) {
        try {
          if (!sheet.href?.startsWith(State.currentDomain)) continue;
          
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          
          this.analyzeCSSHoverRules(rules, detectedImages);
          
        } catch (e) {
          console.warn(`CSS解析エラー: ${sheet.href}`, e);
        }
      }
      
      // インラインスタイルのhover解析
      document.querySelectorAll('style').forEach(style => {
        this.parseHoverFromCSS(style.textContent, detectedImages);
      });
    },
    
    /**
     * イベントリスナーシミュレーション
     */
    async simulateHoverEvents(detectedImages) {
      console.log('🎭 イベントリスナーをシミュレーション中...');
      
      // 要素数制限による最適化
      const interactiveElements = document.querySelectorAll(
        'img[onmouseover], img[onmouseenter], button[class*="hover"], a[class*="hover"], [onclick][class*="image"]'
      );
      
      // 大量要素の場合は処理を制限
      const maxElements = 100;
      const elementsToProcess = Array.from(interactiveElements).slice(0, maxElements);
      
      if (interactiveElements.length > maxElements) {
        console.log(`⚡ 最適化: ${interactiveElements.length}個中${maxElements}個の要素のみ処理`);
      }
      
      const originalSources = new Map();
      const changeDetected = new Set();
      
      // 元の画像URLを記録（最適化）
      elementsToProcess.forEach(el => {
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (img && img.src) {
          originalSources.set(img, img.src);
        }
      });
      
      // 並列処理でホバーイベントをシミュレート（最適化）
      await Utils.processBatch(elementsToProcess, async (el) => {
        try {
          let hasChanged = false;
          
          // 変更監視のためのObserver
          const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
              if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                const newSrc = mutation.target.src;
                if (newSrc && Utils.isSameDomain(newSrc) && !changeDetected.has(newSrc)) {
                  detectedImages.add(newSrc);
                  changeDetected.add(newSrc);
                  hasChanged = true;
                  console.log(`  🖱️ ホバー検出: ${newSrc}`);
                }
              }
            });
          });
          
          const targetImg = el.tagName === 'IMG' ? el : el.querySelector('img');
          if (targetImg) {
            observer.observe(targetImg, { attributes: true, attributeFilter: ['src'] });
          }
          
          // 高速ホバーイベント発火
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          
          await Utils.delay(25); // 待機時間を半減
          
          el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
          
          observer.disconnect();
          
        } catch (e) {
          // イベント発火エラーは無視
        }
      }, 10); // バッチサイズを増加
      
      // 元の状態に復元
      originalSources.forEach((originalSrc, img) => {
        if (img.src !== originalSrc) {
          img.src = originalSrc;
        }
      });
    },
    
    /**
     * OGP画像の独立検出（ホバー画像とは分離）
     */
    async detectOGPImages() {
      console.log('📱 OGP画像を検出中...');
      const ogpImages = new Set();
      
      CONFIG.OGP_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(meta => {
          const content = meta.getAttribute('content') || meta.getAttribute('href');
          if (content) {
            const absoluteUrl = Utils.createSafeURL(content);
            if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
              ogpImages.add(absoluteUrl);
              console.log(`  📱 OGP検出: ${selector} -> ${content}`);
            }
          }
        });
      });
      
      // JSON-LD構造化データからも検出
      document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          this.extractImagesFromJSONLD(data, ogpImages);
        } catch (e) {
          // JSON解析エラーは無視
        }
      });
      
      console.log(`✅ OGP画像検出完了: ${ogpImages.size}個`);
      return Array.from(ogpImages);
    },
    
    /**
     * クラスベースのホバー画像解析
     */
    analyzeClassBasedHover(element, detectedImages) {
      const classList = element.className.split(' ');
      
      classList.forEach(className => {
        if (className.includes('hover')) {
          // 同じ要素グループ内で類似パターンを探す
          const baseClass = className.replace(/hover/i, '');
          const similarElements = document.querySelectorAll(`[class*="${baseClass}"]`);
          
          similarElements.forEach(el => {
            if (el.src && el.src !== element.src) {
              const absoluteUrl = Utils.createSafeURL(el.src);
              if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
                detectedImages.add(absoluteUrl);
              }
            }
          });
        }
      });
    },
    
    /**
     * CSS hoverルール解析
     */
    analyzeCSSHoverRules(rules, detectedImages) {
      for (const rule of rules) {
        if (rule.cssRules) {
          this.analyzeCSSHoverRules(rule.cssRules, detectedImages);
        }
        
        if (rule.selectorText && rule.selectorText.includes(':hover')) {
          this.parseHoverFromCSS(rule.cssText, detectedImages);
        }
      }
    },
    
    /**
     * CSSテキストからホバー画像抽出
     */
    parseHoverFromCSS(cssText, detectedImages) {
      if (!cssText || !cssText.includes(':hover')) return;
      
      const urlRegex = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
      let match;
      
      while ((match = urlRegex.exec(cssText)) !== null) {
        const imageUrl = match[2];
        if (!imageUrl.startsWith('data:')) {
          const absoluteUrl = Utils.createSafeURL(imageUrl);
          if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
            detectedImages.add(absoluteUrl);
          }
        }
      }
    },
    
    /**
     * JSON-LDから画像抽出
     */
    extractImagesFromJSONLD(data, imageSet) {
      if (typeof data !== 'object' || !data) return;
      
      if (Array.isArray(data)) {
        data.forEach(item => this.extractImagesFromJSONLD(item, imageSet));
        return;
      }
      
      // 画像関連プロパティを検索
      const imageProps = ['image', 'logo', 'photo', 'thumbnail', 'url'];
      
      imageProps.forEach(prop => {
        if (data[prop]) {
          const imageValue = typeof data[prop] === 'string' ? data[prop] : data[prop].url;
          if (imageValue) {
            const absoluteUrl = Utils.createSafeURL(imageValue);
            if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
              imageSet.add(absoluteUrl);
            }
          }
        }
      });
      
      // 再帰的に子オブジェクトを探索
      Object.values(data).forEach(value => {
        if (typeof value === 'object') {
          this.extractImagesFromJSONLD(value, imageSet);
        }
      });
    }
  };
  
  // =============================================================================
  // 手動URL管理モジュール
  // =============================================================================
  
  const ManualUrlManager = {
    /**
     * 手動URL追加処理
     */
    addManualUrls(urlsText) {
      console.log('📝 手動URL追加処理を開始...');
      
      const urls = this.parseUrlsFromText(urlsText);
      const validUrls = [];
      const errors = [];
      
      urls.forEach(url => {
        const cleanUrl = url.trim();
        if (!cleanUrl) return;
        
        try {
          const absoluteUrl = Utils.createSafeURL(cleanUrl);
          
          if (!absoluteUrl) {
            errors.push(`無効なURL: ${cleanUrl}`);
            return;
          }
          
          if (!Utils.isSameDomain(absoluteUrl)) {
            errors.push(`異なるドメイン: ${cleanUrl}`);
            return;
          }
          
          State.ui.manualUrls.add(absoluteUrl);
          validUrls.push(absoluteUrl);
          
        } catch (e) {
          errors.push(`URLエラー: ${cleanUrl} - ${e.message}`);
        }
      });
      
      console.log(`✅ 手動URL追加完了: ${validUrls.length}個追加、${errors.length}個エラー`);
      
      return {
        success: validUrls,
        errors: errors,
        total: validUrls.length
      };
    },
    
    /**
     * テキストからURL抽出
     */
    parseUrlsFromText(text) {
      const lines = text.split('\n');
      const urls = [];
      
      lines.forEach(line => {
        const cleanLine = line.trim();
        
        // URL形式の簡単チェック
        if (cleanLine && (cleanLine.startsWith('http') || cleanLine.startsWith('/') || cleanLine.includes('.'))) {
          urls.push(cleanLine);
        }
      });
      
      return urls;
    },
    
    /**
     * 手動URLをリソースオブジェクトに変換
     */
    convertManualUrlsToResources() {
      console.log(`📝 手動URL変換中: ${State.ui.manualUrls.size}個のURL`);
      const resources = [];
      
      State.ui.manualUrls.forEach(url => {
        const urlObj = new URL(url);
        const cleanUrl = urlObj.origin + urlObj.pathname;
        const relativePath = decodeURIComponent(cleanUrl.replace(State.currentDomain + "/", ""));
        const parts = relativePath.split('/');
        let filename = parts.pop() || 'index.html';
        
        if (!filename.includes('.')) {
          filename = filename ? `${filename}.html` : 'index.html';
        }
        
        resources.push({
          url: url,
          relativePath: relativePath.includes('.') ? relativePath : `${relativePath}${relativePath.endsWith('/') ? '' : '/'}index.html`,
          filename: filename,
          folder: parts.join('/') || '/',
          type: Utils.getFileType(url),
          downloaded: false,
          isCurrentPage: false,
          isManuallyAdded: true,
          isHoverDetected: false,
          isOGP: false
        });
      });
      
      console.log(`✅ 手動URL変換完了: ${resources.length}個のリソースオブジェクト生成`);
      return resources;
    },
    
    /**
     * 手動URL一覧クリア
     */
    clearManualUrls() {
      State.ui.manualUrls.clear();
      console.log('🗑️ 手動URL一覧をクリアしました');
    }
  };

  // =============================================================================
  // リソース管理モジュール
  // =============================================================================
  
  const ResourceManager = {
    /**
     * 現在の全リソースを取得（手動追加分を含む）
     */
    getAllCurrentResources() {
      // State.resourcesから全リソースを取得
      const stateResources = Array.from(State.resources.values());
      
      // 手動追加リソース
      const manualResources = ManualUrlManager.convertManualUrlsToResources();
      
      // 重複除去して統合
      const allResources = [...stateResources];
      const existingUrls = new Set(stateResources.map(r => r.url));
      
      manualResources.forEach(resource => {
        if (!existingUrls.has(resource.url)) {
          allResources.push(resource);
          existingUrls.add(resource.url);
        }
      });
      
      console.log(`📊 リソース統計: State内${stateResources.length}個 + 手動${manualResources.length}個 → 重複除去後${allResources.length}個`);
      
      if (manualResources.length > 0) {
        console.log('📝 手動追加されたリソース:', manualResources.map(r => ({ url: r.url, folder: r.folder, filename: r.filename })));
      }
      
      return allResources;
    },
    
    /**
     * UIのリソースカウントを更新
     */
    updateResourceCount() {
      const allResources = this.getAllCurrentResources();
      const panel = State.ui.panel;
      
      if (panel) {
        // ヘッダーのカウント更新
        const headerH3 = panel.querySelector('.rm-header h3');
        if (headerH3) {
          headerH3.textContent = `🎯 ページダウンローダー (${allResources.length}件)`;
        }
        
        // 統計エリアの更新
        const statsEl = panel.querySelector('#rm-stats');
        if (statsEl) {
          const currentText = statsEl.textContent;
          const newText = currentText.replace(/総ファイル数: \d+件/, `総ファイル数: ${allResources.length}件`);
          statsEl.textContent = newText;
        }
        
        console.log(`🔄 UIカウント更新: ${allResources.length}件`);
      }
    },

    /**
     * 追加されたリソースのみを取得（手動追加 + ホバー検出）
     */
    getAddedResourcesOnly() {
      const allResources = this.getAllCurrentResources();
      
      // 追加されたリソースのみフィルタリング（OGP画像は基本リソースとして扱う）
      const addedResources = allResources.filter(resource => {
        return resource.isManuallyAdded || 
               resource.isHoverDetected ||
               (resource.url && State.hoverDetection.detectedImages.has(resource.url));
      });
      
      console.log(`📦 追加リソース統計: 全${allResources.length}個中${addedResources.length}個が追加分`);
      

      
      return addedResources;
    },
  };
  
  // =============================================================================
  // リソース収集モジュール
  // =============================================================================
  
  const ResourceCollector = {
    /**
     * ページスクロールして動的コンテンツを読み込み
     */
    async scrollPageToLoadContent() {
      console.log('📜 ページをスクロールして動的コンテンツを読み込み中...');
      
      const scrollStep = window.innerHeight;
      const maxScroll = document.body.scrollHeight;
      let currentScroll = 0;
      
      while (currentScroll < maxScroll) {
        window.scrollTo(0, currentScroll);
        currentScroll += scrollStep;
        await Utils.delay(CONFIG.SCROLL_DELAY);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      
      window.scrollTo(0, 0);
      console.log('✅ スクロール完了');
    },
    
    /**
     * pictureエレメントの全画像を収集
     */
    collectPictureResources() {
      console.groupCollapsed('🖼️ pictureエレメントを解析中...');
      const resources = new Set();
      
      document.querySelectorAll('picture').forEach((picture, index) => {
        console.log(`  📸 picture要素 ${index + 1}を処理中...`);
        
        // 全sourceのsrcsetを処理
        picture.querySelectorAll('source[srcset]').forEach(source => {
          const srcset = source.getAttribute('srcset');
          const media = source.getAttribute('media') || 'default';
          
          if (srcset) {
            const candidates = srcset.split(',').map(candidate => {
              const parts = candidate.trim().split(/\s+/);
              return parts[0];
            });
            
            candidates.forEach(url => {
              const absoluteUrl = Utils.createSafeURL(url);
              if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
                resources.add(absoluteUrl);
                console.log(`    ✓ 追加: ${url} (${media})`);
              }
            });
          }
        });
        
        // fallback img要素
        const img = picture.querySelector('img');
        if (img?.src) {
          const absoluteUrl = Utils.createSafeURL(img.src);
          if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
            resources.add(absoluteUrl);
            console.log(`    🖼️ fallback: ${img.src}`);
          }
        }
      });
      
      console.groupEnd();
      console.log(`✅ picture要素から${resources.size}個のユニークな画像を検出`);
      return Array.from(resources);
    },
    
    /**
     * 通常の画像要素を収集
     */
    collectImageResources() {
      console.log('🖼️ 通常の画像要素を処理中...');
      const resources = new Set();
      
      // picture内以外のimg要素
      document.querySelectorAll('img:not(picture img)').forEach(img => {
        // lazy loading属性を処理
        if (img.loading === 'lazy') img.removeAttribute('loading');
        if (img.dataset.src && !img.src) img.src = img.dataset.src;
        if (img.dataset.lazy && !img.src) img.src = img.dataset.lazy;
        
        if (img.src) {
          const absoluteUrl = Utils.createSafeURL(img.src);
          if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
            resources.add(absoluteUrl);
          }
        }
        
        // srcset属性も処理
        if (img.srcset) {
          const candidates = img.srcset.split(',').map(c => c.trim().split(/\s+/)[0]);
          candidates.forEach(url => {
            const absoluteUrl = Utils.createSafeURL(url);
            if (absoluteUrl && Utils.isSameDomain(absoluteUrl)) {
              resources.add(absoluteUrl);
            }
          });
        }
      });
      
      console.log(`✅ 通常画像から${resources.size}個を検出`);
      return Array.from(resources);
    },
    
    /**
     * CSS内の全リソースを収集
     */
    async collectCSSResources() {
      console.groupCollapsed('🎨 CSS内のリソースを収集中...');
      const resources = {
        images: new Set(),
        fonts: new Set(),
        others: new Set()
      };
      
      // スタイルシート解析
      for (const sheet of document.styleSheets) {
        try {
          if (!sheet.href?.startsWith(State.currentDomain)) continue;
          
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;
          
          this.parseStyleRules(rules, resources, sheet.href);
          
        } catch (e) {
          console.warn(`スタイルシート解析エラー: ${sheet.href}`, e);
        }
      }
      
      // インラインスタイル解析
      document.querySelectorAll('[style*="url"]').forEach(el => {
        this.parseInlineStyle(el.getAttribute('style'), resources);
      });
      
      // style要素解析
      document.querySelectorAll('style').forEach(style => {
        this.parseInlineStyle(style.textContent, resources);
      });
      
      // リソースの事前読み込み
      await this.preloadCSSResources(resources);
      
      console.groupEnd();
      console.log(`✅ CSS解析完了: 画像${resources.images.size}個, フォント${resources.fonts.size}個, その他${resources.others.size}個`);
      
      return [
        ...Array.from(resources.images),
        ...Array.from(resources.fonts),
        ...Array.from(resources.others)
      ];
    },
    
    /**
     * CSSルールを再帰的に解析
     */
    parseStyleRules(rules, resources, baseUrl) {
      for (const rule of rules) {
        // ネストされたルール
        if (rule.cssRules) {
          this.parseStyleRules(rule.cssRules, resources, baseUrl);
        }
        
        // @font-face
        if (rule instanceof CSSFontFaceRule) {
          this.extractUrlsFromText(rule.style.src, resources, baseUrl, 'fonts');
        }
        
        // @import
        if (rule instanceof CSSImportRule && rule.href?.startsWith(State.currentDomain)) {
          resources.others.add(rule.href);
        }
        
        // 通常のスタイルルール
        if (rule.cssText) {
          this.extractUrlsFromText(rule.cssText, resources, baseUrl);
        }
      }
    },
    
    /**
     * インラインスタイルを解析
     */
    parseInlineStyle(styleText, resources) {
      if (!styleText) return;
      this.extractUrlsFromText(styleText, resources, State.baseUrl);
    },
    
    /**
     * テキストからURL抽出
     */
    extractUrlsFromText(text, resources, baseUrl, forceType = null) {
      const urlRegex = /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
      let match;
      
      while ((match = urlRegex.exec(text)) !== null) {
        let resourceUrl = match[2];
        
        if (resourceUrl.startsWith('data:') || resourceUrl.startsWith('#')) continue;
        
        const absoluteUrl = Utils.createSafeURL(resourceUrl, baseUrl);
        if (!absoluteUrl || !Utils.isSameDomain(absoluteUrl)) continue;
        
        const type = forceType || Utils.getFileType(absoluteUrl);
        
        if (type === 'images') {
          resources.images.add(absoluteUrl);
        } else if (type === 'fonts') {
          resources.fonts.add(absoluteUrl);
        } else {
          resources.others.add(absoluteUrl);
        }
      }
    },
    
    /**
     * CSSリソースの事前読み込み
     */
    async preloadCSSResources(resources) {
      const loadableResources = [
        ...Array.from(resources.images),
        ...Array.from(resources.fonts)
      ];
      
      if (loadableResources.length === 0) return;
      
      console.log(`🔄 ${loadableResources.length}個のCSSリソースを事前読み込み中...`);
      
      await Utils.processBatch(loadableResources, async (url) => {
        return new Promise((resolve) => {
          if (Utils.getFileType(url) === 'fonts') {
            fetch(url, { mode: 'cors', credentials: 'same-origin' })
              .finally(resolve);
          } else {
            const img = new Image();
            img.onload = img.onerror = resolve;
            img.src = url;
          }
        });
      });
    },
    
    /**
     * HTMLファイルを解析してリソースを抽出
     */
    analyzeHTMLForResources(htmlContent, baseUrl) {
      console.log(`🔍 HTMLファイルを解析中... (ベースURL: ${baseUrl})`);
      
      const resources = new Set();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      const selectors = [
        'img[src]',
        'img[srcset]',
        'img[data-src]',
        'img[data-lazy]',
        'source[srcset]',
        'script[src]',
        'link[href]',
        'video[src]',
        'audio[src]',
        'video source[src]',
        'audio source[src]',
        'iframe[src]',
        'object[data]',
        'embed[src]'
      ];
      
      selectors.forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
          const urls = this.extractUrlsFromElement(el, baseUrl);
          urls.forEach(url => {
            if (Utils.isSameDomain(url)) {
              resources.add(url);
            }
          });
        });
      });
      
      // インラインCSS
      doc.querySelectorAll('style').forEach(style => {
        const tempResources = { images: new Set(), fonts: new Set(), others: new Set() };
        this.parseInlineStyle(style.textContent, tempResources);
        [...tempResources.images, ...tempResources.fonts, ...tempResources.others]
          .forEach(url => resources.add(url));
      });
      
      console.log(`  ✅ ${resources.size}個の追加リソースを発見`);
      return Array.from(resources);
    },
    
    /**
     * DOM要素からURLを抽出
     */
    extractUrlsFromElement(element, baseUrl) {
      const urls = [];
      const attributes = ['src', 'href', 'data', 'data-src', 'data-lazy'];
      
      attributes.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value) {
          const absoluteUrl = Utils.createSafeURL(value, baseUrl);
          if (absoluteUrl) urls.push(absoluteUrl);
        }
      });
      
      // srcset属性の特別処理
      if (element.srcset) {
        const candidates = element.srcset.split(',').map(c => c.trim().split(/\s+/)[0]);
        candidates.forEach(url => {
          const absoluteUrl = Utils.createSafeURL(url, baseUrl);
          if (absoluteUrl) urls.push(absoluteUrl);
        });
      }
      
      return urls;
    },
    
    /**
     * 現在のページHTMLを取得
     */
    async getCurrentPageHTML() {
      try {
        const response = await fetch(location.href);
        if (response.ok) {
          return await response.text();
        }
      } catch (e) {
        console.warn('fetchでの取得に失敗、DOM状態を使用:', e);
      }
      
      // フォールバック
      const doctype = new XMLSerializer().serializeToString(document.doctype);
      return doctype + document.documentElement.outerHTML;
    },
    
    /**
     * 完全なリソース収集（HTML解析込み）
     */
    async collectAllResources() {
      console.log('🚀 完全リソース収集を開始...');
      const startTime = performance.now();
      
      // 動的コンテンツの読み込み
      await this.scrollPageToLoadContent();
      
      const allResources = new Set();
      
      // 各種リソース収集（基本機能のみ）
    const [
      pictureResources,
      imageResources,
      cssResources
    ] = await Promise.all([
      this.collectPictureResources(),
      this.collectImageResources(),
      this.collectCSSResources()
    ]);
      
      // OGP画像を独立して収集（ホバー画像とは分離）
      const ogpImages = await HoverImageDetector.detectOGPImages();
      const ogpImageSet = new Set(ogpImages);
      
      // リソースを統合
    [...pictureResources, ...imageResources, ...cssResources, ...ogpImages].forEach(url => {
      allResources.add(url);
    });
    
    console.log(`📊 リソース統計: 画像${pictureResources.length}個、CSS${cssResources.length}個、OGP${ogpImages.length}個`);
      
      // Performance APIからのリソース
      performance.getEntriesByType("resource")
        .map(entry => entry.name)
        .filter(url => Utils.isSameDomain(url))
        .forEach(url => allResources.add(url));
      
      // 現在のページ
      allResources.add(location.href);
      
      // HTML解析による追加リソース発見
      console.log('🔍 HTML解析を実行中...');
      const currentPageHTML = await this.getCurrentPageHTML();
      const htmlFoundResources = this.analyzeHTMLForResources(currentPageHTML, location.href);
      htmlFoundResources.forEach(url => allResources.add(url));
      
      // 他のHTMLファイルも解析
      const htmlUrls = Array.from(allResources).filter(url => 
        Utils.getFileType(url) === 'documents' && url !== location.href
      );
      
      if (htmlUrls.length > 0) {
        console.log(`🔍 ${htmlUrls.length}個の他のHTMLファイルを解析中...`);
        
        for (const htmlUrl of htmlUrls) {
          try {
            const response = await fetch(htmlUrl);
            if (response.ok) {
              const htmlContent = await response.text();
              const foundResources = this.analyzeHTMLForResources(htmlContent, htmlUrl);
              foundResources.forEach(url => allResources.add(url));
            }
          } catch (e) {
            console.warn(`${htmlUrl} の解析に失敗:`, e.message);
          }
          await Utils.delay(CONFIG.NETWORK_DELAY);
        }
      }
      
      // リソースオブジェクトに変換（OGPフラグ付き）
    const resources = this.convertToResourceObjects(Array.from(allResources), ogpImageSet);
    
    // 手動追加リソースをマージ（初期化時）
    const manualResourceObjects = ManualUrlManager.convertManualUrlsToResources();
    resources.push(...manualResourceObjects);
      
      const endTime = performance.now();
      console.log(`🎉 完全リソース収集完了！合計: ${resources.length}個 (${Math.round(endTime - startTime)}ms)`);
      
      return resources;
    },
    
    /**
     * URLをリソースオブジェクトに変換
     */
    convertToResourceObjects(urls, ogpImageSet = new Set()) {
      return urls.map(url => {
        const urlObj = new URL(url);
        const cleanUrl = urlObj.origin + urlObj.pathname;
        const relativePath = decodeURIComponent(cleanUrl.replace(State.currentDomain + "/", ""));
        const parts = relativePath.split('/');
        let filename = parts.pop() || 'index.html';
        
        if (!filename.includes('.')) {
          filename = filename ? `${filename}.html` : 'index.html';
        }
        
        return {
          url: url,
          relativePath: relativePath.includes('.') ? relativePath : `${relativePath}${relativePath.endsWith('/') ? '' : '/'}index.html`,
          filename: filename,
          folder: parts.join('/') || '/',
          type: Utils.getFileType(url),
          downloaded: false,
          isCurrentPage: url === location.href || cleanUrl === location.href.split('?')[0],
          isOGP: ogpImageSet.has(url), // OGP画像フラグ（基本リソース扱い）
          isManuallyAdded: false,      // 手動追加フラグ（初期化時はfalse）
          isHoverDetected: false       // ホバー検出フラグ（初期化時はfalse）
        };
      });
    },

    /**
    * URLからリソースオブジェクトを作成
    */
    createResourceFromUrl(url, isHoverDetected = false) {
      try {
        const urlObj = new URL(url);
        const cleanUrl = urlObj.origin + urlObj.pathname;
        const relativePath = decodeURIComponent(cleanUrl.replace(State.currentDomain + "/", ""));
        const parts = relativePath.split('/');
        let filename = parts.pop() || 'index.html';
        
        if (!filename.includes('.')) {
          filename = filename ? `${filename}.html` : 'index.html';
        }
        
        return {
          url: url,
          relativePath: relativePath.includes('.') ? relativePath : `${relativePath}${relativePath.endsWith('/') ? '' : '/'}index.html`,
          filename: filename,
          folder: parts.join('/') || '/',
          type: Utils.getFileType(url),
          downloaded: false,
          isCurrentPage: false,
          isHoverDetected: isHoverDetected,
          isManuallyAdded: false,
          isOGP: false
        };
      } catch (e) {
        console.warn('URL解析エラー:', url, e);
        return null;
      }
    },
  };
  
  // =============================================================================
  // ダウンロードモジュール
  // =============================================================================
  
  const Downloader = {
    /**
     * ZIPダウンロード実行
     */
    async downloadAsZip(resources, isAddedOnly = false) {
      console.log('🚀 ZIPダウンロードを開始...');
      
      if (typeof JSZip === 'undefined') {
        await this.loadJSZip();
      }
      
      const zip = new JSZip();
      const domainFolder = `htdocs_${location.hostname.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // レポート初期化
      State.downloadReport = {
        success: [],
        failed: [],
        startTime: new Date(),
        endTime: null,
        totalSize: 0
      };
      
      // プログレスバー表示
      this.showProgressBar();
      
      // 並列ダウンロード処理
      await this.downloadResourcesInParallel(resources, zip, domainFolder);
      
      // レポート生成
      this.generateReports(zip, domainFolder);
      
      // ZIP生成・ダウンロード
      await this.generateAndDownloadZip(zip, isAddedOnly);
      
      State.downloadReport.endTime = new Date();
      this.hideProgressBar();
      
      console.log(`🎉 ダウンロード完了！成功: ${State.downloadReport.success.length}, 失敗: ${State.downloadReport.failed.length}`);
    },
    
    /**
     * JSZipライブラリをロード
     */
    async loadJSZip() {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },
    
    /**
     * リソースを並列ダウンロード
     */
    async downloadResourcesInParallel(resources, zip, domainFolder) {
      const semaphore = new Array(CONFIG.MAX_PARALLEL_DOWNLOADS).fill(null);
      let completed = 0;
      
      const downloadResource = async (resource, index) => {
        try {
          let content;
          let statusCode = 200;
          
          if (resource.isCurrentPage) {
            const htmlContent = await ResourceCollector.getCurrentPageHTML();
            content = new Blob([htmlContent], { type: 'text/html' });
          } else {
            const response = await fetch(resource.url);
            statusCode = response.status;
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            
            content = await response.blob();
          }
          
          zip.file(`${domainFolder}/${resource.relativePath}`, content);
          
          State.downloadReport.success.push({
            url: resource.url,
            path: resource.relativePath,
            size: content.size,
            type: content.type || resource.type,
            status: statusCode
          });
          
          State.downloadReport.totalSize += content.size;
          
        } catch (e) {
          State.downloadReport.failed.push({
            url: resource.url,
            path: resource.relativePath,
            error: e.message,
            timestamp: new Date().toISOString()
          });
          
          // 現在のページの場合はフォールバック
          if (resource.isCurrentPage) {
            const fallbackContent = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
            zip.file(`${domainFolder}/${resource.relativePath}`, fallbackContent);
            console.log(`⚠️ フォールバック使用: ${resource.relativePath}`);
          }
        }
        
        completed++;
        this.updateProgress(completed, resources.length);
      };
      
      // セマフォを使用した並列処理
      await Promise.all(
        resources.map(async (resource, index) => {
          // セマフォ取得を待機
          await new Promise(resolve => {
            const checkSemaphore = () => {
              const slotIndex = semaphore.findIndex(slot => slot === null);
              if (slotIndex !== -1) {
                semaphore[slotIndex] = resource;
                resolve(slotIndex);
              } else {
                setTimeout(checkSemaphore, 10);
              }
            };
            checkSemaphore();
          }).then(async (slotIndex) => {
            await downloadResource(resource, index);
            semaphore[slotIndex] = null; // セマフォ解放
          });
        })
      );
    },
    
    /**
     * プログレス更新
     */
    updateProgress(completed, total) {
      if (!State.ui.progressBar) return;
      
      const progress = Math.round((completed / total) * 100);
      const progressFill = State.ui.progressBar.querySelector('.rm-progress-fill');
      
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
        progressFill.textContent = `${progress}% (${completed}/${total})`;
      }
    },
    
    /**
     * レポート生成
     */
    generateReports(zip, domainFolder) {
      const { success, failed, startTime, totalSize } = State.downloadReport;
      
      const successReport = this.createSuccessReport(success, startTime, totalSize);
      const failedReport = this.createFailedReport(failed, startTime);
      const summaryReport = this.createSummaryReport(success, failed, startTime, totalSize);
      
      zip.file('download_success.txt', successReport);
      zip.file('download_failed.txt', failedReport);
      zip.file('download_summary.txt', summaryReport);
    },
    
    /**
     * 成功レポート作成
     */
    createSuccessReport(success, startTime, totalSize) {
      return `=== ダウンロード成功ファイル ===\n日時: ${startTime.toLocaleString('ja-JP')}\nドメイン: ${location.hostname}\nページ: ${location.href}\n成功: ${success.length}件\n総サイズ: ${Utils.formatFileSize(totalSize)}\n\n【URL一覧（成功）】\n${success.map(item => item.url).sort((a, b) => a.localeCompare(b)).join('\n')}\n\n【詳細情報】\n${success.map(item => `✓ ${item.path}\n  URL: ${item.url}\n  サイズ: ${Utils.formatFileSize(item.size)}\n  タイプ: ${item.type || '不明'}\n  ステータス: ${item.status}\n  ${item.note ? `備考: ${item.note}` : ''}  `).join('\n')}`;
    },
    
    /**
     * 失敗レポート作成
     */
    createFailedReport(failed, startTime) {
      if (failed.length === 0) {
        return `=== ダウンロード失敗ファイル ===\n失敗したファイルはありません。\nすべてのファイルが正常にダウンロードされました。\n`;
      }
      
      return `=== ダウンロード失敗ファイル ===\n日時: ${startTime.toLocaleString('ja-JP')}\n失敗数: ${failed.length}件\n\n【URL一覧（失敗）】\n${failed.map(item => item.url).sort((a, b) => a.localeCompare(b)).join('\n')}\n\n【詳細情報】\n${failed.map(item => `✗ ${item.path}\n  URL: ${item.url}\n  エラー: ${item.error}\n  時刻: ${item.timestamp}\n  ${item.note ? `備考: ${item.note}` : ''}`).join('\n')}\n\n【考えられる原因】\n- CORS（Cross-Origin Resource Sharing）ポリシーによる制限\n- 404 Not Found（ファイルが存在しない）\n- 403 Forbidden（アクセス権限がない）\n- ネットワークエラー\n- サーバー側のエラー（500番台）\n\n【対処法】\n1. ブラウザの開発者ツールでネットワークタブを確認\n2. 失敗したURLに直接アクセスして確認\n3. 必要に応じて手動でダウンロード`;
    },
    
    /**
     * サマリーレポート作成
     */
    createSummaryReport(success, failed, startTime, totalSize) {
      const typeStats = {};
      success.forEach(item => {
        const ext = Utils.getFileExtension(item.url);
        typeStats[ext] = (typeStats[ext] || 0) + 1;
      });
      
      const processingTime = State.downloadReport.endTime ? 
        (State.downloadReport.endTime - startTime) / 1000 : 0;
      
      return `=== ダウンロードサマリー ===\n実行日時: ${startTime.toLocaleString('ja-JP')}\nウェブサイト: ${location.hostname}\nページURL: ${location.href}\n\n【統計情報】\n総ファイル数: ${success.length + failed.length}\n成功: ${success.length} (${Math.round(success.length / (success.length + failed.length) * 100)}%)\n失敗: ${failed.length} (${Math.round(failed.length / (success.length + failed.length) * 100)}%)\n処理時間: ${processingTime}秒\n総ダウンロードサイズ: ${Utils.formatFileSize(totalSize)}\n\n【ファイルタイプ別統計】\n${Object.entries(typeStats).sort((a, b) => b[1] - a[1]).map(([ext, count]) => `  .${ext}: ${count}件`).join('\n')}\n\n【🎯 新機能搭載版の特徴】\n- 🖱️ ホバー画像自動検出: CSS :hover状態やJS動的変更画像も収集\n- 📱 OGP・構造化データ対応: SNS共有画像やJSON-LD画像も自動取得\n- 📝 手動URL追加機能: 見落としやすいリソースを手動で追加可能\n- 🎨 UI/UX大幅改善: 視覚的フィードバック、リアルタイム進捗表示\n- 🏷️ 検出方法別バッジ表示: 各リソースの取得方法を色分け表示\n- 🔍 高精度リソース検索: DOM解析 + CSS解析 + Performance API統合\n\n【従来機能も強化】\n- 完全リソース収集: picture要素の全解像度、lazy loading、CSS内リソース\n- HTML解析機能: モーダルなどで読み込まれるリソースも自動検出\n- レスポンシブ対応: すべての画面サイズの画像を保存\n- 重複リソースを自動除去、並列ダウンロードによる高速化\n- 詳細なエラーレポートと成功統計、動画・音声ファイル完全対応\n`;
    },
    
    /**
     * ZIP生成・ダウンロード
     */
    async generateAndDownloadZip(zip, isAddedOnly = false) {
      this.updateProgressText('🗜️ ZIP生成中...');
      
      try {
        const content = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('ja-JP', {
          year: '2-digit', month: '2-digit', day: '2-digit'
        }).replace(/\//g, '');
        const timeStr = now.toLocaleTimeString('ja-JP', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).replace(/:/g, '');
        
        const suffix = isAddedOnly ? '_added' : '';
        link.download = `${location.hostname}_${dateStr}_${timeStr}${suffix}.zip`;
        link.click();
        
        URL.revokeObjectURL(link.href);
        
      } catch (e) {
        console.error('ZIP生成エラー:', e);
        throw e;
      }
    },
    
    /**
     * プログレスバー表示
     */
    showProgressBar() {
      if (State.ui.progressBar) {
        State.ui.progressBar.classList.add('active');
      }
    },
    
    /**
     * プログレスバー非表示
     */
    hideProgressBar() {
      if (State.ui.progressBar) {
        State.ui.progressBar.classList.remove('active');
      }
    },
    
    /**
     * プログレステキスト更新
     */
    updateProgressText(text) {
      if (State.ui.progressBar) {
        const progressFill = State.ui.progressBar.querySelector('.rm-progress-fill');
        if (progressFill) {
          progressFill.textContent = text;
        }
      }
    }
  };
  
  // =============================================================================
  // UI モジュール
  // =============================================================================
  
  const UI = {
    /**
     * メインパネル作成
     */
    createPanel(resources) {
      const duplicationAnalysis = this.analyzeDuplication(resources);
      const folderStructure = this.buildFolderStructure(resources);
      
      const panel = document.createElement('div');
      panel.id = 'rm-panel';
      panel.innerHTML = this.getPanelHTML(resources, duplicationAnalysis);
      
      document.body.appendChild(panel);
      State.ui.panel = panel;
      State.ui.progressBar = panel.querySelector('.rm-progress-bar');
      
      this.renderFolderStructure(folderStructure);
      
      this.attachEventListeners(resources);
      
      // 初期状態で追加分ボタンの表示を更新
      this.updateAddedButtonCount();
      
      return panel;
    },
    
    /**
     * パネルHTML取得
     */
    getPanelHTML(resources, duplicationAnalysis) {
      const hoverCount = State.hoverDetection.detectedImages.size;
      const manualCount = State.ui.manualUrls.size;
      
      // デバッグ: UI作成時の状態確認
      console.log('🔍 UI作成時のState確認:');
      console.log('  - manualUrls:', State.ui.manualUrls.size);
      console.log('  - detectedImages:', State.hoverDetection.detectedImages.size);
      console.log('  - resources引数:', resources.length);
      
      const addedCount = ResourceManager.getAddedResourcesOnly().length;
      const addedBtnStyle = addedCount === 0 ? ' style="display: none;"' : '';
      
      console.log('🎯 初期表示時の追加分カウント:', addedCount);
      
      return `${this.getStyles()}<div class="rm-header"><h3>🎯 ページダウンローダー (${resources.length}件)</h3><button type="button" class="rm-close-btn" onclick="this.closest('#rm-panel').remove()">✕</button></div><div class="rm-toolbar"><button type="button" class="rm-btn primary" id="download-all-btn">🗜️ 全てダウンロード</button><button type="button" class="rm-btn secondary" id="download-added-btn"${addedBtnStyle}>📦 追加分のみ (${addedCount}件)</button><button type="button" class="rm-btn" id="manual-url-btn">📝 手動URL追加</button><button type="button" class="rm-btn" id="copy-urls-btn">📋 URL一覧コピー</button><button type="button" class="rm-btn" id="toggle-all-btn">📽 すべて展開/折畳</button></div><div class="rm-progress-bar" id="rm-progress-bar"><div class="rm-progress-track"><div class="rm-progress-fill" id="rm-progress-fill" style="width: 0%">0%</div></div></div><div class="rm-manual-url-area" id="rm-manual-url-area" style="display: none;"><div class="rm-manual-header"><h4>📝 手動URL追加エリア</h4><button type="button" class="rm-manual-close" onclick="document.getElementById('rm-manual-url-area').style.display='none'">✕</button></div><div class="rm-manual-content"><textarea id="rm-manual-textarea" placeholder="URLを1行ずつ入力してください" rows="8"></textarea><div class="rm-manual-buttons"><button type="button" class="rm-btn primary" id="add-manual-urls-btn">✅ URL追加</button><button type="button" class="rm-btn" id="clear-manual-urls-btn">🗑️ クリア</button><span class="rm-manual-count">現在: ${manualCount}個</span></div><div class="rm-manual-status" id="rm-manual-status"></div></div></div><div class="rm-content" id="rm-resource-content"><div id="rm-folder-container"><!-- フォルダ構造がここに挿入される --></div><div class="rm-filter-controls" id="rm-filter-controls"><input type="text" id="rm-search-input" placeholder="ファイル名で検索..." class="rm-search-input"><select id="rm-type-filter" class="rm-type-filter"><option value="">すべてのタイプ</option><option value="images">画像</option><option value="styles">CSS</option><option value="scripts">JavaScript</option><option value="documents">HTML</option><option value="fonts">フォント</option><option value="media">メディア</option><option value="others">その他</option></select></div></div><div class="rm-stats" id="rm-stats">総ファイル数: ${resources.length}件 | 重複除去済み | 追加分: ${addedCount}件 | 予想サイズ: 計算中...</div>`;
    },
    
    /**
     * スタイル定義
     */
    getStyles() {
      return `<style>#rm-panel{position:fixed;top:20px;right:20px;width:620px;max-height:90vh;background:#ffffff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15),0 0 0 1px rgba(0,0,0,0.05);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;z-index:2147483647;display:flex;flex-direction:column;animation:rm-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);backdrop-filter:blur(10px)}@keyframes rm-slideIn{from{transform:translateX(100%) scale(0.9);opacity:0}to{transform:translateX(0) scale(1);opacity:1}}#rm-panel .rm-header{padding:20px 24px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center;box-shadow:inset 0 1px 0 rgba(255,255,255,0.2)}#rm-panel .rm-header h3{margin:0;font-size:16px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.1)}#rm-panel .rm-close-btn{background:rgba(255,255,255,0.15);border:none;color:white;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;backdrop-filter:blur(10px)}#rm-panel .rm-close-btn:hover{background:rgba(255,255,255,0.25);transform:scale(1.05)}#rm-panel .rm-toolbar{padding:16px 24px;background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);border-bottom:1px solid #dee2e6;display:flex;gap:8px;flex-wrap:wrap}#rm-panel .rm-btn{padding:8px 14px;background:white;border:1px solid #dee2e6;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s ease;display:flex;align-items:center;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}#rm-panel .rm-btn:hover{background:#f8f9fa;border-color:#adb5bd;transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,0.1)}#rm-panel .rm-btn.primary{background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border-color:transparent;box-shadow:0 2px 8px rgba(102, 126, 234, 0.3)}#rm-panel .rm-btn.primary:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(102, 126, 234, 0.4)}#rm-panel .rm-btn.primary:disabled{background:#adb5bd;cursor:not-allowed;opacity:0.6;transform:none}#rm-panel .rm-btn.secondary{background:linear-gradient(135deg, #28a745 0%, #20c997 100%);color:white;border-color:transparent;box-shadow:0 2px 8px rgba(40, 167, 69, 0.3)}#rm-panel .rm-btn.secondary:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(40, 167, 69, 0.4)}#rm-panel .rm-btn.secondary:disabled{background:#adb5bd;cursor:not-allowed;opacity:0.6;transform:none}#rm-panel .rm-btn.scanning{background:linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);color:white;animation:rm-pulse 1.5s infinite}@keyframes rm-pulse{0%, 100%{opacity:1}50%{opacity:0.7}}#rm-panel .rm-manual-url-area{border-top:1px solid #dee2e6;background:#f8f9fa}#rm-panel .rm-manual-header{padding:12px 24px;background:linear-gradient(135deg, #28a745 0%, #20c997 100%);color:white;display:flex;justify-content:space-between;align-items:center}#rm-panel .rm-manual-header h4{margin:0;font-size:14px;font-weight:600}#rm-panel .rm-manual-close{background:rgba(255,255,255,0.15);border:none;color:white;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease}#rm-panel .rm-manual-close:hover{background:rgba(255,255,255,0.25)}#rm-panel .rm-manual-content{padding:16px 24px}#rm-panel .rm-manual-textarea{width:100%;border:1px solid #dee2e6;border-radius:8px;padding:12px;font-size:13px;font-family:monospace;resize:vertical;background:white;box-shadow:inset 0 1px 3px rgba(0,0,0,0.1)}#rm-panel .rm-manual-buttons{display:flex;gap:12px;margin-top:12px;align-items:center}#rm-panel .rm-manual-count{font-size:12px;color:#6c757d;margin-left:auto}#rm-panel .rm-manual-status{margin-top:8px;font-size:12px;padding:8px;border-radius:6px;display:none}#rm-panel .rm-manual-status.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb;display:block}#rm-panel .rm-manual-status.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;display:block}#rm-panel .rm-content{flex:1;overflow-y:auto;padding:20px 24px;max-height:calc(90vh - 250px)}#rm-panel .rm-info-box{background:linear-gradient(135deg, #d1ecf1 0%, #b8e6ec 100%);border:1px solid #bee5eb;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#0c5460;line-height:1.4}#rm-panel .rm-filter-controls{position:sticky;bottom:0;display:flex;gap:12px;margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px}#rm-panel .rm-search-input,#rm-panel .rm-type-filter{padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:13px;background:white}#rm-panel .rm-search-input{flex:1}#rm-panel .rm-folder{margin-bottom:16px;background:#ffffff;border:1px solid #e9ecef;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)}#rm-panel .rm-folder-header{padding:12px 16px;background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);font-weight:600;font-size:13px;color:#495057;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;transition:background 0.2s ease}#rm-panel .rm-folder-header:hover{background:linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)}#rm-panel .rm-folder-content{padding:8px;transition:all 0.3s ease}#rm-panel .rm-folder-content.collapsed{display:none}#rm-panel .rm-resource-item{display:flex;align-items:center;padding:10px 12px;background:#ffffff;border-radius:8px;margin-bottom:6px;transition:all 0.2s ease;font-size:13px;cursor:pointer;text-decoration:none;color:#212529;border:1px solid transparent}#rm-panel .rm-resource-item:hover{background:#f1f3f5;transform:translateX(4px);border-color:#dee2e6;box-shadow:0 2px 4px rgba(0,0,0,0.05)}#rm-panel .rm-resource-item.current-page{background:linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);border:1px solid #ffc107;font-weight:500}#rm-panel .rm-resource-item.manually-added{background:linear-gradient(135deg, #e2f3e4 0%, #d4edda 100%);border:1px solid #28a745}#rm-panel .rm-resource-item.hover-detected{background:linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);border:1px solid #9c27b0}#rm-panel .rm-resource-item.downloaded{opacity:0.7;background:linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)}#rm-panel .rm-resource-item .icon{width:18px;height:18px;margin-right:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center}#rm-panel .rm-resource-item .filename{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px}#rm-panel .rm-resource-item .size{font-size:11px;color:#6c757d;margin-right:8px}#rm-panel .rm-resource-item .badge{font-size:10px;padding:2px 8px;background:#ffc107;color:#000;border-radius:12px;font-weight:600;margin-left:4px}#rm-panel .rm-resource-item .badge.manual{background:#28a745;color:white}#rm-panel .rm-resource-item .badge.hover{background:#9c27b0;color:white}#rm-panel .rm-resource-item .badge.ogp{background:#17a2b8;color:white}#rm-panel .rm-stats{padding:16px 24px;background:linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);border-top:1px solid #dee2e6;font-size:12px;color:#6c757d;text-align:center;line-height:1.4}#rm-panel .rm-progress-bar{display:none;padding:16px 24px;background:#f8f9fa;border-top:1px solid #e9ecef}#rm-panel .rm-progress-bar.active{display:block}#rm-panel .rm-progress-track{width:100%;height:24px;background:#e9ecef;border-radius:12px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.1)}#rm-panel .rm-progress-fill{height:100%;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);transition:width 0.3s ease;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.2)}#rm-panel .rm-notification{position:fixed;bottom:20px;right:20px;background:#28a745;color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;animation:rm-notificationSlide 0.3s ease-out;z-index:2147483648;max-width:300px}#rm-panel .rm-notification.error{background:#dc3545}@keyframes rm-notificationSlide{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}#rm-manual-textarea{width:100%;white-space:nowrap;font-size:12px;line-height:1.2;min-height:10lh}</style>`;
    },
    
    /**
     * 重複分析
     */
    analyzeDuplication(resources) {
      const urlCount = {};
      const pathCount = {};
      
      resources.forEach(resource => {
        const cleanUrl = resource.url.split('?')[0];
        urlCount[cleanUrl] = (urlCount[cleanUrl] || 0) + 1;
        pathCount[resource.relativePath] = (pathCount[resource.relativePath] || 0) + 1;
      });
      
      const duplicatedUrls = Object.entries(urlCount).filter(([url, count]) => count > 1);
      const duplicatedPaths = Object.entries(pathCount).filter(([path, count]) => count > 1);
      
      return {
        duplicatedUrls,
        duplicatedPaths,
        uniqueCount: Object.keys(urlCount).length,
        totalCount: resources.length
      };
    },
    
    /**
     * フォルダ構造構築
     */
    buildFolderStructure(resources) {
      const structure = {};
      
      resources.forEach(resource => {
        const folder = resource.folder || '/';
        if (!structure[folder]) {
          structure[folder] = [];
        }
        structure[folder].push(resource);
      });
      
      // 各フォルダ内でファイル名順にソート
      Object.keys(structure).forEach(folder => {
        structure[folder].sort((a, b) => a.filename.localeCompare(b.filename));
      });
      
      return structure;
    },
    
    /**
     * フォルダ構造レンダリング
     */
    renderFolderStructure(folderStructure) {
      const container = document.getElementById('rm-folder-container');
      if (!container) return;
      
      container.innerHTML = '';
      
      Object.keys(folderStructure).sort().forEach(folder => {
        const folderEl = this.createFolderElement(folder, folderStructure[folder]);
        container.appendChild(folderEl);
      });
    },
    
    /**
     * フォルダ要素作成
     */
    createFolderElement(folder, resources) {
      const folderEl = document.createElement('div');
      folderEl.className = 'rm-folder';
      
      const headerEl = document.createElement('div');
      headerEl.className = 'rm-folder-header';
      headerEl.innerHTML = `<span class="folder-icon">📁</span><span class="folder-name">${folder === '/' ? 'ルート' : folder}</span><span style="margin-left: auto; opacity: 0.7; font-size: 12px;">(${resources.length}件)</span>`;
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'rm-folder-content';
      
      resources.forEach(resource => {
        const itemEl = this.createResourceItem(resource);
        contentDiv.appendChild(itemEl);
      });
      
      headerEl.addEventListener('click', () => {
        contentDiv.classList.toggle('collapsed');
        const icon = headerEl.querySelector('.folder-icon');
        icon.textContent = contentDiv.classList.contains('collapsed') ? '📂' : '📁';
      });
      
      folderEl.appendChild(headerEl);
      folderEl.appendChild(contentDiv);
      
      return folderEl;
    },
    
    /**
     * リソースアイテム作成
     */
    createResourceItem(resource) {
      const itemEl = document.createElement('div');
      itemEl.className = 'rm-resource-item';
      itemEl.setAttribute('data-type', resource.type);
      itemEl.setAttribute('data-filename', resource.filename.toLowerCase());
      
      if (resource.isCurrentPage) {
        itemEl.classList.add('current-page');
      }
      
      if (resource.isManuallyAdded) {
        itemEl.classList.add('manually-added');
      }
      
      if (resource.isHoverDetected) {
        itemEl.classList.add('hover-detected');
      }
      
      const icon = this.getFileIcon(resource.type, resource.filename);
      
      let badges = '';
      if (resource.isCurrentPage) {
        badges += '<span class="badge">現在のページ</span>';
      }
      if (resource.isManuallyAdded) {
        badges += '<span class="badge manual">手動追加</span>';
      }
      if (resource.isHoverDetected) {
        badges += '<span class="badge hover">ホバー検出</span>';
      }
      if (resource.isOGP) {
        badges += '<span class="badge ogp">OGP画像</span>';
      }
      
      itemEl.innerHTML = `<span class="icon">${icon}</span><span class="filename" title="${resource.filename}">${resource.filename}</span><span class="size" id="size-${resource.url.hashCode()}">計算中...</span>${badges}`;
      
      itemEl.addEventListener('click', () => {
        window.open(resource.url, '_blank');
      });
      
      return itemEl;
    },
    
    /**
     * ファイルアイコン取得
     */
    getFileIcon(type, filename) {
      const iconMap = {
        images: '🖼️',
        fonts: '🔤',
        styles: '🎨',
        scripts: '📜',
        documents: '🌐',
        media: '🎥',
        data: '📊',
        others: '📄'
      };
      
      return iconMap[type] || '📄';
    },
    
    /**
     * イベントリスナー追加
     */
    attachEventListeners(resources) {
      // 全てダウンロードボタン
      document.getElementById('download-all-btn')?.addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ 準備中...';
        
        try {
          // 全リソースをダウンロード
          const allResources = ResourceManager.getAllCurrentResources();
          
          console.log(`📊 全ダウンロード対象: 合計${allResources.length}個のリソース`);
          
          await Downloader.downloadAsZip(allResources, false);
          UI.showNotification('✅ 全リソースのZIPダウンロードが完了しました！');
        } catch (e) {
          UI.showNotification('❌ ダウンロード中にエラーが発生しました', true);
          console.error('ダウンロードエラー:', e);
        } finally {
          btn.disabled = false;
          btn.textContent = '🗜️ 全てダウンロード';
        }
      });
      
      // 追加分のみダウンロードボタン
      document.getElementById('download-added-btn')?.addEventListener('click', async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ 準備中...';
        
        try {
          // 追加されたリソースのみダウンロード
          const addedResources = ResourceManager.getAddedResourcesOnly();
          
          if (addedResources.length === 0) {
            UI.showNotification('💡 追加されたリソースがありません', false);
            return;
          }
          
          console.log(`📦 追加分ダウンロード対象: ${addedResources.length}個のリソース`);
          
          await Downloader.downloadAsZip(addedResources, true);
          UI.showNotification(`✅ 追加分${addedResources.length}個のZIPダウンロードが完了しました！`);
        } catch (e) {
          UI.showNotification('❌ ダウンロード中にエラーが発生しました', true);
          console.error('ダウンロードエラー:', e);
        } finally {
          btn.disabled = false;
          btn.textContent = '📦 追加分のみ';
        }
      });
      
      // 手動URL追加ボタン
      console.log('🔧 手動URL追加ボタンのイベントリスナーを設定中...');
      const manualBtn = document.getElementById('manual-url-btn');
      console.log('📝 手動URL追加ボタン要素:', manualBtn);
      manualBtn?.addEventListener('click', () => {
        console.log('📝 手動URL追加ボタンがクリックされました');
        const area = document.getElementById('rm-manual-url-area');
        console.log('🏠 手動URLエリア要素:', area);
        if (area) {
          console.log('📊 現在の display:', area.style.display);
          // 初期状態が空文字列の場合も考慮
          const currentDisplay = area.style.display || 'none';
          area.style.display = currentDisplay === 'none' ? 'block' : 'none';
          console.log('📊 変更後の display:', area.style.display);
          if (area.style.display === 'block') {
            document.getElementById('rm-manual-textarea')?.focus();
          }
        }
      });
      
      // 手動URL追加処理
      document.getElementById('add-manual-urls-btn')?.addEventListener('click', () => {
        const textarea = document.getElementById('rm-manual-textarea');
        const statusEl = document.getElementById('rm-manual-status');
        const countEl = document.querySelector('.rm-manual-count');
        
        if (!textarea || !textarea.value.trim()) {
          UI.showManualStatus('URLを入力してください', 'error');
          return;
        }
        
        console.log('📝 手動URL追加実行:', textarea.value);
        const result = ManualUrlManager.addManualUrls(textarea.value);
        
        if (result.errors.length > 0) {
          UI.showManualStatus(`${result.total}個追加、${result.errors.length}個エラー`, 'error');
          console.warn('URL追加エラー:', result.errors);
        } else {
          UI.showManualStatus(`${result.total}個のURLを追加しました（ファイルサイズ計算中...）`, 'success');
          textarea.value = '';
        }
        
        // カウント更新
        if (countEl) {
          countEl.textContent = `現在: ${State.ui.manualUrls.size}個`;
        }
        
        // 全体のリソースカウント更新とUI再描画
        ResourceManager.updateResourceCount();
        
        // フォルダ構造を再描画して手動追加URLを表示エリアに反映
        UI.refreshFolderStructure();
        
        // 追加分ボタンカウント更新
        UI.updateAddedButtonCount();
        
        // 手動追加されたリソースのファイルサイズを少し遅延して計算
        setTimeout(() => {
          console.log('🔄 手動追加URLのファイルサイズ計算を開始...');
          const allResources = ResourceManager.getAllCurrentResources();
          UI.calculateNewResourceSizes(allResources);
        }, 500);
      });
      
      // 手動URLクリア
      document.getElementById('clear-manual-urls-btn')?.addEventListener('click', () => {
        if (confirm('追加したURLをすべてクリアしますか？')) {
          console.log('🗑️ 手動URLリストをクリア実行');
          ManualUrlManager.clearManualUrls();
          document.getElementById('rm-manual-textarea').value = '';
          document.querySelector('.rm-manual-count').textContent = '現在: 0個';
          UI.showManualStatus('URLリストをクリアしました', 'success');
          
          // 全体のリソースカウント更新とUI再描画
          ResourceManager.updateResourceCount();
          
          // フォルダ構造を再描画してクリア結果を表示エリアに反映
          UI.refreshFolderStructure();
          
          // 統計を更新
          UI.updateTotalStats();
          
          // 追加分ボタンカウント更新
          UI.updateAddedButtonCount();
        }
      });
      
      // URL一覧コピー
      document.getElementById('copy-urls-btn')?.addEventListener('click', () => {
        const urls = resources.map(r => r.url).sort().join('\n');
        this.copyToClipboard(urls, 'URL一覧をクリップボードにコピーしました');
      });
      
      // 全展開/折畳
      let allExpanded = true;
      document.getElementById('toggle-all-btn')?.addEventListener('click', () => {
        const folders = document.querySelectorAll('.rm-folder-content');
        const icons = document.querySelectorAll('.folder-icon');
        
        folders.forEach(folder => {
          folder.classList.toggle('collapsed', allExpanded);
        });
        
        icons.forEach(icon => {
          icon.textContent = allExpanded ? '📂' : '📁';
        });
        
        allExpanded = !allExpanded;
      });
      
      // フィルター
      document.getElementById('filter-btn')?.addEventListener('click', () => {
        const controls = document.getElementById('rm-filter-controls');
        if (controls) {
          const isVisible = controls.style.display !== 'none';
          controls.style.display = isVisible ? 'none' : 'flex';
        }
      });
      
      // 検索・フィルター機能
      this.setupFilterControls();
    },
    
    /**
     * 手動URL状態表示
     */
    showManualStatus(message, type) {
      const statusEl = document.getElementById('rm-manual-status');
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `rm-manual-status ${type}`;
        
        // 3秒後に非表示
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 3000);
      }
    },
    
    /**
     * フィルターコントロール設定
     */
    setupFilterControls() {
      const searchInput = document.getElementById('rm-search-input');
      const typeFilter = document.getElementById('rm-type-filter');
      
      const applyFilters = () => {
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const selectedType = typeFilter?.value || '';
        
        document.querySelectorAll('.rm-resource-item').forEach(item => {
          const filename = item.getAttribute('data-filename') || '';
          const type = item.getAttribute('data-type') || '';
          
          const matchesSearch = !searchTerm || filename.includes(searchTerm);
          const matchesType = !selectedType || type === selectedType;
          
          item.style.display = (matchesSearch && matchesType) ? 'flex' : 'none';
        });
        
        // 空のフォルダを非表示
        document.querySelectorAll('.rm-folder').forEach(folder => {
          const visibleItems = folder.querySelectorAll('.rm-resource-item[style*="flex"]');
          folder.style.display = visibleItems.length > 0 ? 'block' : 'none';
        });
      };
      
      searchInput?.addEventListener('input', applyFilters);
      typeFilter?.addEventListener('change', applyFilters);
    },
    
    /**
     * クリップボードにコピー
     */
    async copyToClipboard(text, successMessage) {
      try {
        await navigator.clipboard.writeText(text);
        this.showNotification(successMessage);
      } catch (err) {
        // フォールバック
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        this.showNotification(successMessage);
      }
    },
    
    /**
     * 通知表示
     */
    showNotification(message, isError = false) {
      const notif = document.createElement('div');
      notif.className = isError ? 'rm-notification error' : 'rm-notification';
      notif.textContent = message;
      document.body.appendChild(notif);
      
      setTimeout(() => notif.remove(), 4000);
    },
    
    /**
     * フォルダ構造を再描画（手動URL追加後などに呼び出し）
     */
    refreshFolderStructure() {
      console.log('🔄 フォルダ構造を再描画中...');
      
      // 最新のリソースを取得（手動追加分を含む）
      const currentResources = ResourceManager.getAllCurrentResources();
      
      // フォルダ構造を再構築
      const folderStructure = this.buildFolderStructure(currentResources);
      
      // 既存のフォルダ構造を更新
      this.renderFolderStructure(folderStructure);
      
      console.log(`✅ フォルダ構造更新完了: ${currentResources.length}個のリソース`);
      
      // 新しく追加されたリソースのファイルサイズを計算
      this.calculateNewResourceSizes(currentResources);
      
      // フィルターを再適用
      this.reapplyFilters();
    },
    
    /**
     * フィルターを再適用（フォルダ構造更新後）
     */
    reapplyFilters() {
      const searchInput = document.getElementById('rm-search-input');
      const typeFilter = document.getElementById('rm-type-filter');
      
      if (searchInput && searchInput.value) {
        searchInput.dispatchEvent(new Event('input'));
      }
      
      if (typeFilter && typeFilter.value) {
        typeFilter.dispatchEvent(new Event('change'));
      }
    },
    
    /**
     * 新しく追加されたリソースのファイルサイズを計算
     */
    async calculateNewResourceSizes(resources) {
      console.log('📐 新しく追加されたリソースのファイルサイズを計算中...');
      
      // キャッシュ済みサイズのチェック
      const calculatedSizes = new Map();
      
      // 計算対象を効率的にフィルタリング
      const resourcesToCalculate = resources.filter(resource => {
        const sizeElementId = `size-${resource.url.hashCode()}`;
        const sizeElement = document.getElementById(sizeElementId);
        
        // DOM要素がない場合はスキップ
        if (!sizeElement) {
          return false;
        }
        
        const currentText = sizeElement.textContent?.trim();
        const shouldCalculate = currentText === '計算中...' || currentText === '';
        
        return shouldCalculate;
      });
      
      if (resourcesToCalculate.length === 0) {
        console.log('💡 計算が必要なリソースはありません（全て計算済み）');
        this.updateTotalStats();
        return;
      }
      
      console.log(`📊 ${resourcesToCalculate.length}個の新規リソースのサイズを計算します`);
      
      let totalNewSize = 0;
      let calculated = 0;
      let failed = 0;
      
      // バッチ処理で効率的に計算
      const batchProcessor = async (resource) => {
        try {
          // HEADリクエストでファイルサイズを取得（タイムアウト付き）
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(resource.url, { 
            method: 'HEAD',
            cache: 'force-cache', // キャッシュを優先
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const size = parseInt(response.headers.get('content-length')) || 0;
          const sizeElementId = `size-${resource.url.hashCode()}`;
          const sizeElement = document.getElementById(sizeElementId);
          
          if (sizeElement) {
            if (size > 0) {
              const formattedSize = Utils.formatFileSize(size);
              sizeElement.textContent = formattedSize;
              totalNewSize += size;
              calculated++;
            } else {
              sizeElement.textContent = 'サイズ不明';
              failed++;
            }
          }
        } catch (e) {
          const sizeElementId = `size-${resource.url.hashCode()}`;
          const sizeElement = document.getElementById(sizeElementId);
          if (sizeElement) {
            sizeElement.textContent = 'エラー';
          }
          failed++;
          console.warn(`⚠️ ${resource.filename}: ${e.message}`);
        }
      };
      
      // 並列処理でファイルサイズを計算（5並列で高速化）
      await Utils.processBatch(resourcesToCalculate, batchProcessor, 5);
      
      console.log(`🎉 ファイルサイズ計算完了: 成功${calculated}個、失敗${failed}個、新規計算分合計${Utils.formatFileSize(totalNewSize)}`);
      
      // 統計情報を更新
      setTimeout(() => this.updateTotalStats(), 100);
    },

    /**
     * 全体のファイルサイズ統計を更新
     */
    updateTotalStats() {
      const statsEl = document.getElementById('rm-stats');
      if (!statsEl) return;
      
      // 全てのサイズ要素から計算済みサイズを取得
      let totalCalculatedSize = 0;
      let calculatedCount = 0;
      let totalItems = 0;
      
      document.querySelectorAll('[id^="size-"]').forEach(sizeEl => {
        totalItems++;
        const sizeText = sizeEl.textContent.trim();
        
        if (sizeText !== '計算中...' && sizeText !== 'エラー' && sizeText !== 'サイズ不明') {
          // ファイルサイズテキストを数値に変換
          const sizeMatch = sizeText.match(/([\d.]+)\s*(B|KB|MB|GB)/);
          if (sizeMatch) {
            const size = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            
            let bytes = size;
            switch (unit) {
              case 'KB': bytes *= 1024; break;
              case 'MB': bytes *= 1024 * 1024; break;
              case 'GB': bytes *= 1024 * 1024 * 1024; break;
            }
            
            totalCalculatedSize += bytes;
            calculatedCount++;
          }
        }
      });
      
      const progress = totalItems > 0 ? Math.round((calculatedCount / totalItems) * 100) : 100;
      const currentText = statsEl.textContent;
      const newText = currentText.replace(
        /予想サイズ: [^|]+/,
        `予想サイズ: ${Utils.formatFileSize(totalCalculatedSize)} (${progress}% 計算済み)`
      );
      
      statsEl.textContent = newText;
      console.log(`📊 統計更新: ${calculatedCount}/${totalItems}件計算済み, 合計${Utils.formatFileSize(totalCalculatedSize)}`);
    },
    /**
     * 追加分ボタンの件数表示を更新
     */
    updateAddedButtonCount() {
      const addedCount = ResourceManager.getAddedResourcesOnly().length;
      const addedBtn = document.getElementById('download-added-btn');
      
      if (addedBtn) {
        if (addedCount === 0) {
          // 追加分がない場合はボタンを非表示
          addedBtn.style.display = 'none';
          console.log('📦 追加分ボタン非表示: 追加リソースなし');
        } else {
          // 追加分がある場合はボタンを表示
          addedBtn.style.display = 'flex';
          addedBtn.textContent = `📦 追加分のみ (${addedCount}件)`;
          addedBtn.disabled = false;
          addedBtn.title = `${addedCount}個の追加リソースをダウンロード`;
          console.log(`📦 追加分ボタン表示: ${addedCount}件`);
        }
      }
    },
  };
  
  // =============================================================================
  // ヘルパー関数
  // =============================================================================
  
  // String.prototype.hashCode for unique IDs
  String.prototype.hashCode = function() {
    let hash = 0;
    if (this.length === 0) return hash;
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer
    }
    return Math.abs(hash);
  };
  
  // =============================================================================
  // メイン初期化処理
  // =============================================================================
  
  (async () => {
    try {
      console.log('🎯 リソースマネージャー 開始');
      console.log('🎉 新機能搭載: ホバー画像検出、OGP画像、手動URL追加、UI/UX大幅改善');
      
      // 初期化時に追加分関連の状態をクリア
      State.hoverDetection.detectedImages.clear();
      State.hoverDetection.isScanning = false;
      State.ui.manualUrls.clear();
      
      // 完全リソース収集（HTML解析込み）
      const resources = await ResourceCollector.collectAllResources();
      
      // リソースをグローバル状態に保存
      resources.forEach(resource => {
        State.resources.set(resource.url, resource);
      });
      
      console.log(`📊 収集完了: ${resources.length}個のリソース`);
      
      // UIパネル作成
      const panel = UI.createPanel(resources);
      
      // ファイルサイズを非同期で計算
      setTimeout(() => {
        ResourceCollector.calculateFileSizes(resources);
      }, 1000);
      
      console.log('✅ リソースマネージャー初期化完了');
      console.log('💡 使い方: ①必要に応じてホバー画像検出 ②手動URL追加 ③ZIPダウンロード');
      
    } catch (error) {
      console.error('❌ 初期化エラー:', error);
      UI.showNotification('初期化中にエラーが発生しました', true);
    }
  })();
  
  // =============================================================================
  // 追加メソッド（ファイルサイズ計算など）
  // =============================================================================
  
  // ResourceCollectorに追加メソッドを拡張
  Object.assign(ResourceCollector, {
    /**
     * ファイルサイズを非同期で計算
     */
    async calculateFileSizes(resources) {
      console.log('📐 ファイルサイズを計算中...');
      let totalSize = 0;
      let calculated = 0;
      
      const batchProcessor = async (resource) => {
        try {
          const response = await fetch(resource.url, { method: 'HEAD' });
          const size = parseInt(response.headers.get('content-length')) || 0;
          
          if (size > 0) {
            totalSize += size;
            const sizeElement = document.getElementById(`size-${resource.url.hashCode()}`);
            if (sizeElement) {
              sizeElement.textContent = Utils.formatFileSize(size);
            }
          }
        } catch (e) {
          // ファイルサイズ取得失敗は無視
        }
        
        calculated++;
        
        // 統計更新
        if (calculated % 10 === 0 || calculated === resources.length) {
          this.updateSizeStats(calculated, resources.length, totalSize);
        }
      };
      
      await Utils.processBatch(resources, batchProcessor, 5);
    },
    
    /**
     * サイズ統計更新
     */
    updateSizeStats(calculated, total, totalSize) {
      const statsEl = document.getElementById('rm-stats');
      if (statsEl) {
        const progress = Math.round((calculated / total) * 100);
        statsEl.innerHTML = `総ファイル数: ${total}件 | 重複除去済み | 予想サイズ: ${Utils.formatFileSize(totalSize)} (${progress}% 計算済み)`;
      }
    }
  });
  
})();