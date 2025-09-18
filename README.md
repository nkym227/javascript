# SiTest Replacer 使い方マニュアル

## 概要
SiTest Replacerは、SiTestを使わずに同様のDOM差し替えを再現するためのJavaScriptライブラリです。プレビュー機能、複数操作対応、メディアファイルの自動パス置換など、実用的な機能を搭載しています。

## 基本的な使い方

### 1. 初期化

```javascript
// 基本的な初期化
const replacer = new SiTestReplacer({
  baseUrl: 'https://example.com/',  // HTMLファイルのベースURL
  previewMode: true,                // プレビューモードで起動
  debug: true                       // デバッグログを有効化
});

// 処理開始
replacer.start();
```

### 2. HTML要素の設定

差し替えたい要素に属性を設定します：

```html
<!-- 基本的な差し替え -->
<div data-sitest-type="innerHTML" data-sitest-url="new-content.html">
  元のコンテンツ
</div>

<!-- Remove操作 -->
<div data-sitest-type="remove" data-sitest-url="dummy.html">
  削除される要素
</div>

<!-- 複数操作（順次実行） -->
<div data-sitest-type="innerHTML" data-sitest-url="step1.html"
     data-sitest-type-2="after" data-sitest-url-2="step2.html">
  複数操作される要素
</div>
```

## オプション設定

### 全オプション一覧

```javascript
const replacer = new SiTestReplacer({
  // 基本設定
  attributeName: 'data-sitest-type',    // 対象要素の属性名
  baseUrl: 'https://example.com/',      // HTMLファイルのベースURL
  waitTime: 500,                        // 追加待機時間（ミリ秒）
  debug: false,                         // デバッグモード
  retryCount: 3,                        // リトライ回数
  retryDelay: 1000,                     // リトライ間隔（ミリ秒）
  
  // プレビューモード設定
  previewMode: false,                   // プレビューモード（URLパラメータで自動判定）
  previewPosition: 'top-right',         // プレビューメニューの位置
  
  // CSS管理設定
  cssFile: 'sitest-style.css',          // CSSファイル名
  cssUrl: '',                           // CSSファイルのURL
  autoInjectCSS: true,                  // CSS自動挿入
  
  // JavaScript管理設定
  scriptFile: 'sitest-script.js',       // サイトスクリプトファイル名
  scriptUrl: '',                        // サイトスクリプトファイルのURL
  autoExecuteScript: true,              // サイトスクリプト自動実行
  executeAfterAllReplacements: true,    // 全差し替え完了後実行
  executeScripts: true,                 // 挿入されたスクリプトの実行
  scriptTimeout: 5000,                  // スクリプト実行タイムアウト
  
  // メディア置換設定
  mediaReplacement: {
    enabled: true,                      // メディア置換機能の有効/無効
    localPath: '/sitest/img/',          // 開発時のローカルパス
    productionPath: 'https://sitest.cdn.com/uploads/'  // 本番のアップロード先パス
  }
});
```

## 操作タイプ

### 対応する操作

| タイプ | 説明 | 例 |
|--------|------|-----|
| `innerHTML` / `inner` | 要素の内容を置換 | `<div>新しい内容</div>` |
| `outerHTML` / `outer` | 要素全体を置換 | 要素ごと差し替え |
| `insertAfter` / `after` | 要素の後に挿入 | 要素はそのまま、後に追加 |
| `insertBefore` / `before` | 要素の前に挿入 | 要素はそのまま、前に追加 |
| `remove` | 要素を削除 | 要素を非表示 |

### 複数操作の設定

```html
<!-- 最大10個まで操作可能 -->
<div data-sitest-type="innerHTML" data-sitest-url="step1.html"
     data-sitest-type-2="after" data-sitest-url-2="step2.html"
     data-sitest-type-3="before" data-sitest-url-3="step3.html">
  複数操作される要素
</div>
```

## プレビューモード

### 有効化方法

以下のいずれかの方法でプレビューモードが有効になります：

1. **URLパラメータ**（自動判定）：
   - `?preview=1`
   - `?delivery=1` 
   - `?sitest-preview=1`

2. **オプション指定**：
   ```javascript
   new SiTestReplacer({ previewMode: true });
   ```

### プレビューモードの機能

- **サイドメニュー表示**：右側に操作パネルが表示
- **要素ハイライト**：対象要素が色付きオーバーレイで可視化
- **操作タグ**：各要素に操作内容がタグで表示
- **個別実行**：要素ごとに実行・復元が可能
- **一括操作**：全要素の一括実行・復元・リセット
- **コードプレビュー**：HTML/CSS/JavaScriptソースの表示

### サイドメニューの操作

- **実行**：個別の要素操作を実行
- **↶元に戻す**：実行した操作を復元
- **要素へ移動**：対象要素までスムーズスクロール
- **💻コード**：操作予定のHTMLソースを表示

### 一括操作ボタン

- **▶️ 全実行**：全ての操作を一括実行
- **↶ 全復元**：実行済みの操作を一括復元
- **🔄 リセット**：ページを再読み込み
- **🎨 CSS読込**：CSSファイルを手動読み込み
- **📄 CSS表示**：CSSファイルの内容をプレビュー
- **⚡ JS実行**：JavaScriptを手動実行
- **📄 JS表示**：JavaScriptファイルの内容をプレビュー

## メディア置換機能

### 設定方法

```javascript
const replacer = new SiTestReplacer({
  mediaReplacement: {
    enabled: true,                                    // 機能を有効化
    localPath: '/sitest/img/',                        // 開発時のパス
    productionPath: 'https://sitest.cdn.com/uploads/' // 本番のパス
  }
});
```

### 置換される例

**HTML内**：
```html
<!-- 置換前 -->
<img src="/sitest/img/hero.jpg" alt="ヒーロー画像">

<!-- 置換後 -->
<img src="https://sitest.cdn.com/uploads/hero.jpg" alt="ヒーロー画像">
```

**CSS内**：
```css
/* 置換前 */
.hero { background-image: url(/sitest/img/background.jpg); }

/* 置換後 */
.hero { background-image: url(https://sitest.cdn.com/uploads/background.jpg); }
```

**JavaScript内**：
```javascript
// 置換前
var iconPath = "/sitest/img/icon.png";

// 置換後  
var iconPath = "https://sitest.cdn.com/uploads/icon.png";
```

### 運用フロー

1. **開発時**：ローカルディレクトリに画像配置
2. **プレビュー**：置換後のパスで動作確認
3. **本番投入**：SiTestに同名ファイルをアップロード
4. **自動置換**：本番パスに自動変換されて実行

## 実装例

### 基本的なサンプル

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SiTest Replacer サンプル</title>
</head>
<body>
  <!-- 差し替え対象要素 -->
  <div data-sitest-type="innerHTML" data-sitest-url="new-content.html" 
       class="target-element">
    元のコンテンツがここに表示されます
  </div>

  <!-- Remove対象要素 -->
  <div data-sitest-type="remove" data-sitest-url="dummy.html" 
       class="remove-target">
    この要素は削除されます
  </div>

  <!-- 複数操作の要素 -->
  <div data-sitest-type="innerHTML" data-sitest-url="step1.html"
       data-sitest-type-2="after" data-sitest-url-2="step2.html"
       class="multiple-operation">
    複数の操作が順次実行されます
  </div>

  <script src="sitest-replacer.js"></script>
  <script>
    // SiTest Replacer初期化
    const replacer = new SiTestReplacer({
      baseUrl: './',
      previewMode: true,
      debug: true,
      mediaReplacement: {
        enabled: true,
        localPath: '/sitest/img/',
        productionPath: 'https://your-sitest-cdn.com/uploads/'
      }
    });

    // 処理開始
    replacer.start();
  </script>
</body>
</html>
```

### 高度な設定例

```javascript
const replacer = new SiTestReplacer({
  // 基本設定
  baseUrl: 'https://cdn.example.com/sitest/',
  previewMode: new URLSearchParams(location.search).has('preview'),
  debug: process.env.NODE_ENV === 'development',
  
  // パフォーマンス設定
  retryCount: 5,
  retryDelay: 2000,
  waitTime: 1000,
  
  // CSS・JS管理
  cssFile: 'styles/sitest.css',
  scriptFile: 'scripts/sitest.js',
  autoInjectCSS: true,
  autoExecuteScript: true,
  executeAfterAllReplacements: true,
  
  // メディア置換
  mediaReplacement: {
    enabled: true,
    localPath: '/assets/sitest/media/',
    productionPath: 'https://sitest-uploads.cdn.com/project123/'
  }
});

// エラーハンドリング
replacer.start().catch(error => {
  console.error('SiTest Replacer failed:', error);
});
```

## デバッグとトラブルシューティング

### デバッグモードの有効化

```javascript
const replacer = new SiTestReplacer({
  debug: true  // 詳細ログを出力
});
```

### よくある問題と解決方法

**1. 要素が見つからない**
- `data-sitest-type`属性が正しく設定されているか確認
- 要素がDOM読み込み後に追加されている場合は、遅延実行を検討

**2. HTMLファイルが読み込めない**
- `baseUrl`の設定を確認
- ファイルパスが正しいか確認
- CORSポリシーの問題がないか確認

**3. プレビューモードが動作しない**
- URLパラメータまたは`previewMode: true`オプションを確認
- JavaScript実行エラーがないかコンソールを確認

**4. メディア置換が動作しない**
- `mediaReplacement.enabled: true`が設定されているか確認
- `localPath`と`productionPath`が正しく設定されているか確認
- パスが絶対パス（`/`で始まる）であるか確認

### パフォーマンス最適化

```javascript
const replacer = new SiTestReplacer({
  // 待機時間を短縮
  waitTime: 100,
  
  // リトライ設定を調整
  retryCount: 2,
  retryDelay: 500,
  
  // 不要な機能を無効化
  autoExecuteScript: false,  // 手動でJS実行する場合
  executeScripts: false      // HTMLに含まれるスクリプトを実行しない場合
});
```

## ベストプラクティス

### 1. ファイル構成
```
project/
├── sitest-replacer.js     # ライブラリ本体
├── sitest-style.css       # 共通CSS
├── sitest-script.js       # 共通JavaScript
├── html/                  # 差し替え用HTMLファイル
│   ├── hero.html
│   ├── cta.html
│   └── form.html
└── media/                 # メディアファイル（開発時）
    ├── hero.jpg
    └── icon.png
```

### 2. 命名規則
- HTMLファイル：`操作内容-要素名.html`（例：`hero-section.html`）
- 属性値：小文字で統一（`innerHTML`, `remove`など）
- ID付与：`data-sitest-id`属性で一意性を確保

### 3. エラーハンドリング
```javascript
const replacer = new SiTestReplacer({
  debug: true,
  retryCount: 3
});

replacer.start().then(() => {
  console.log('SiTest Replacer initialized successfully');
}).catch(error => {
  console.error('Initialization failed:', error);
  // フォールバック処理
});
```

このマニュアルを参考に、効率的なSiTest案件対応を行ってください！
