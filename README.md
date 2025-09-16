# SiTest Replacer

## 🎯 概要

**SiTest Replacer**は、SiTest案件において納品作業を効率化するためのJavaScriptツールです。実際のSiTestサービスを使用する前に、クライアントとの確認作業や修正作業をスムーズに行うことができます。

### 🚀 主な目的

- **SiTest案件の納品効率化**: 実際のSiTestを使わずに差し替え内容の事前確認
- **クライアント確認の円滑化**: 視覚的なプレビューとリアルタイムな修正
- **作業工数の削減**: 手動での差し替え作業からの解放
- **品質向上**: 事前テストによるエラーの早期発見

---

## 📦 機能一覧

### ✨ 基本機能
- **DOM要素の動的差し替え**: innerHTML, outerHTML, insertAfter, insertBefore, remove
- **複数操作の連続実行**: 1つの要素に対して複数の操作を順次実行
- **プレビューモード**: 実際の差し替えを行わずに視覚的確認
- **リアルタイム操作**: サイドメニューからワンクリックで実行・復元

### 🎨 UI/UX機能
- **サイドメニューコントロール**: 右側固定、折りたたみ可能
- **要素ハイライト**: 差し替え対象の視覚的表示
- **スムーズナビゲーション**: 要素への自動スクロール
- **一括操作**: 全要素の一括実行・復元

### 📄 プレビュー機能
- **HTMLソースプレビュー**: 差し替え予定のHTMLコードを表示・コピー
- **CSSプレビュー**: スタイルシートの表示・コピー
- **操作詳細表示**: 実行予定の操作内容を事前確認

### 🎛️ CSS管理
- **外部CSS読み込み**: スタイルタグではなく別ファイルで管理
- **動的CSS挿入**: head要素の最後に自動挿入
- **CSSプレビュー**: スタイルシートのソースコード表示

---

## 🛠️ セットアップ

### 📁 ファイル構成

SiTest案件の基本的なファイル構成：

```
project/
├── index.html              # メインHTMLファイル
├── sitest-replacer.js       # 本ツール（必須）
├── sitest-styles.css        # SiTest用CSS（推奨）
├── replacement/             # 差し替え用HTMLファイル
│   ├── header.html
│   ├── content.html
│   └── footer.html
└── assets/                  # その他リソース
    ├── images/
    └── css/
```

### 📋 基本セットアップ

#### 1. JavaScriptファイルの配置と読み込み

```html
<!DOCTYPE html>
<html>
<head>
    <title>SiTest案件 - プレビュー</title>
</head>
<body>
    <!-- あなたの既存コンテンツ -->
    
    <!-- SiTest Replacerの読み込み（bodyの最後に配置） -->
    <script src="sitest-replacer.js"></script>
</body>
</html>
```

#### 2. プレビューモードの有効化

URLに以下のパラメータを追加するとプレビューモードで起動：

```
https://example.com/index.html?preview
https://example.com/index.html?delivery
https://example.com/index.html?sitest-preview
```

---

## 🎯 使用方法

### 📝 HTML側の設定

差し替えたい要素に以下の属性を設定：

#### 基本的な差し替え（単一操作）

```html
<!-- innerHTML: 要素の内容を置換 -->
<div data-sitest-type="innerHTML" data-sitest-url="replacement/content.html">
    既存のコンテンツ
</div>

<!-- outerHTML: 要素全体を置換 -->
<section data-sitest-type="outerHTML" data-sitest-url="replacement/section.html">
    置換される要素全体
</section>

<!-- remove: 要素を削除 -->
<div data-sitest-type="remove">
    削除される要素
</div>

<!-- insertAfter: 要素の後に挿入 -->
<h2 data-sitest-type="insertAfter" data-sitest-url="replacement/banner.html">
    見出し
</h2>

<!-- insertBefore: 要素の前に挿入 -->
<footer data-sitest-type="insertBefore" data-sitest-url="replacement/notice.html">
    フッター
</footer>
```

#### 複数操作の連続実行

1つの要素に対して複数の操作を順次実行：

```html
<!-- 内容変更 → 後に要素追加 → さらに後に要素追加 -->
<div data-sitest-type="innerHTML" data-sitest-url="replacement/new-content.html"
     data-sitest-type-2="insertAfter" data-sitest-url-2="replacement/banner.html"
     data-sitest-type-3="insertAfter" data-sitest-url-3="replacement/cta.html">
    元のコンテンツ
</div>

<!-- 要素削除 → 新しい要素を後に挿入 -->
<div data-sitest-type="remove"
     data-sitest-type-2="insertAfter" data-sitest-url-2="replacement/new-element.html">
    削除して置き換える要素
</div>
```

### ⚙️ JavaScript側の設定

#### デフォルト設定（自動初期化）

```javascript
// ファイルを読み込むだけで自動実行
// プレビューモードは自動判定
```

#### カスタム設定

```javascript
// カスタム設定で初期化
sitestInit({
    baseUrl: '/assets/replacement/',     // HTMLファイルのベースパス
    cssFile: 'custom-sitest.css',       // CSSファイル名
    cssUrl: '/assets/css/sitest.css',    // CSS完全URL（baseUrlと組み合わせ）
    autoInjectCSS: true,                 // CSS自動挿入（デフォルト: true）
    waitTime: 1000,                      // DOM安定待機時間（ミリ秒）
    debug: true,                         // デバッグモード
    retryCount: 5,                       // リトライ回数
    retryDelay: 2000,                    // リトライ間隔（ミリ秒）
    previewMode: true                    // 強制プレビューモード
});
```

### 🎛️ CSS管理

#### 外部CSSファイルの利用

HTMLファイル内にstyleタグを埋め込むのではなく、別ファイルで管理：

```css
/* sitest-styles.css */
.sitest-custom-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    text-align: center;
}

.sitest-cta-button {
    background: #ff6b35;
    color: white;
    padding: 15px 30px;
    border: none;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
}

.sitest-cta-button:hover {
    background: #e55a2b;
    transform: translateY(-2px);
}
```

#### CSS自動読み込み設定

```javascript
sitestInit({
    cssFile: 'sitest-styles.css',  // CSSファイル名
    autoInjectCSS: true            // 自動読み込み有効
});
```

---

## 🎮 操作方法

### 📱 サイドメニューの使用方法

プレビューモードで起動すると、画面右側にコントロールメニューが表示されます。

#### メニュー構成

```
🎯 SiTest Controller                    [🎨][✕]
┌─────────────────────────────────────────────┐
│ 📍 div.header-section                      │
│ 2個の操作: innerHTML, insertAfter          │
│ [⚡] [📍] [💻] [🎨] [↶]                   │
├─────────────────────────────────────────────┤
│ 📍 section#main-content                    │
│ 1個の操作: outerHTML                       │
│ [⚡] [📍] [💻] [🎨] [↶]                   │
└─────────────────────────────────────────────┘
🔧 一括操作
[▶️ 全実行] [↶ 全復元] [🔄 リセット]
[🎨 CSS読込] [📄 CSS表示]
全3個 | 実行済み0個 | 待機中3個
```

#### ボタンの機能

| ボタン | 機能 | 説明 |
|--------|------|------|
| ⚡ | 実行 | 該当要素の操作を実行 |
| 📍 | 移動 | 要素へスムーズスクロール |
| 💻 | Code Preview | HTMLソースコードを表示・コピー |
| 🎨 | CSS Preview | CSSファイルを表示・コピー |
| ↶ | 元に戻す | 操作を取り消して元の状態に復元 |

#### 一括操作

| ボタン | 機能 |
|--------|------|
| ▶️ 全実行 | 全ての要素の操作を一括実行 |
| ↶ 全復元 | 全ての操作を一括で元に戻す |
| 🔄 リセット | ページをリロードして初期状態に戻す |
| 🎨 CSS読込 | CSSファイルを再読み込み |
| 📄 CSS表示 | CSSプレビューウィンドウを開く |

### 💻 プレビュー機能

#### HTMLソースプレビュー

💻 Code Previewボタンを押すと、以下の情報が表示されます：

- **実行予定の操作一覧**
- **各操作のHTMLソースコード**（テキストエリア）
- **ワンクリックコピー機能**
- **エラー情報**（ファイル取得失敗時）

#### CSSプレビュー

🎨 CSS Previewボタンを押すと、以下が表示されます：

- **CSSファイルの完全なソースコード**
- **ファイル情報**（ファイル名、サイズ）
- **ワンクリックコピー機能**

---

## 📖 実際の案件での運用方法

### 🔄 SiTest案件のワークフロー

#### 1. 案件準備フェーズ

```bash
# プロジェクトフォルダ作成
mkdir sitest-project-20241201
cd sitest-project-20241201

# 必要ファイルの配置
cp /path/to/sitest-replacer.js ./
touch sitest-styles.css
mkdir replacement
```

#### 2. クライアント要件の実装

```html
<!-- クライアント要求: ヘッダーの差し替え -->
<header data-sitest-type="outerHTML" data-sitest-url="replacement/new-header.html">
    現在のヘッダー
</header>

<!-- クライアント要求: CTAボタンの追加 -->
<section data-sitest-type="insertAfter" data-sitest-url="replacement/cta-section.html">
    メインコンテンツ
</section>
```

#### 3. 差し替えファイルの作成

```html
<!-- replacement/new-header.html -->
<header class="sitest-custom-header">
    <h1>新しいヘッダーデザイン</h1>
    <nav>
        <a href="#home">ホーム</a>
        <a href="#about">概要</a>
        <a href="#contact">お問い合わせ</a>
    </nav>
</header>
```

```html
<!-- replacement/cta-section.html -->
<div class="sitest-cta-section">
    <h2>今すぐお申し込み</h2>
    <button class="sitest-cta-button">無料体験を始める</button>
</div>
```

#### 4. スタイルの実装

```css
/* sitest-styles.css */
.sitest-custom-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
}

.sitest-cta-section {
    text-align: center;
    padding: 40px 20px;
    background: #f8f9fa;
}

.sitest-cta-button {
    background: #ff6b35;
    color: white;
    padding: 15px 30px;
    border: none;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
}
```

#### 5. クライアント確認

```
# プレビューURLの送付
https://staging.example.com/sitest-project/?preview

# クライアントでの確認作業
1. プレビューモードで全体確認
2. 個別要素の実行・復元テスト
3. HTMLソースコードの確認
4. 修正要望のフィードバック
```

#### 6. 修正・再確認

```javascript
// 修正が必要な場合の設定調整
sitestInit({
    baseUrl: '/v2/replacement/',  // 修正版ファイルパス
    debug: true,                  // デバッグモード有効
    waitTime: 1000               // 読み込み待機時間調整
});
```

#### 7. 本番適用準備

```javascript
// 本番用設定
sitestInit({
    debug: false,        // デバッグモード無効
    previewMode: false  // 実際の差し替えモード
});
```

### 🎯 案件タイプ別の設定例

#### A/Bテスト案件

```javascript
sitestInit({
    baseUrl: '/ab-test/variant-b/',
    cssFile: 'ab-test-styles.css',
    previewMode: true,
    debug: true
});
```

#### LP改善案件

```javascript
sitestInit({
    baseUrl: '/lp-improvement/',
    cssFile: 'lp-styles.css',
    waitTime: 1500,  // LP読み込み待機
    retryCount: 5
});
```

#### 緊急修正案件

```javascript
sitestInit({
    baseUrl: '/hotfix/',
    autoInjectCSS: false,  // CSS読み込みスキップ
    waitTime: 0,           // 待機時間なし
    debug: false
});
```

---

## 🔧 高度な設定

### 📋 全オプション一覧

```javascript
sitestInit({
    // === 基本設定 ===
    attributeName: 'data-sitest-type',     // 差し替え属性名
    baseUrl: '',                           // HTMLファイルベースURL
    waitTime: 500,                         // DOM安定待機時間（ms）
    debug: false,                          // デバッグモード
    
    // === 通信設定 ===
    retryCount: 3,                         // リトライ回数
    retryDelay: 1000,                      // リトライ間隔（ms）
    
    // === プレビュー設定 ===
    previewMode: 'auto',                   // auto/true/false
    previewPosition: 'top-right',          // サイドメニュー表示位置
    
    // === CSS設定 ===
    cssFile: 'sitest-styles.css',          // CSSファイル名
    cssUrl: '',                            // CSS完全URL
    autoInjectCSS: true                    // CSS自動挿入
});
```

### 🎛️ 動的制御

```javascript
// 手動でのCSS読み込み
await sitestReplacer.loadAndInjectCSS();

// 手動での要素処理実行
await sitestReplacer.execute();

// 状態のリセット
sitestReplacer.reset();

// プレビューモード確認
const isPreview = sitestIsPreview();

// CSS表示
sitestReplacer.showCSSPreview();
```

---

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### ❌ CSSが読み込まれない

```javascript
// デバッグモードで確認
sitestInit({
    debug: true,
    cssFile: 'sitest-styles.css'
});

// コンソールでエラー確認
// [SiTestReplacer] Failed to fetch CSS: ...
```

**解決方法:**
- CSSファイルパスの確認
- CORSエラーの場合はサーバー設定確認
- 手動読み込み: 一括操作から「🎨 CSS読込」

#### ❌ HTMLファイルが取得できない

```javascript
// リトライ設定を調整
sitestInit({
    retryCount: 5,
    retryDelay: 2000,
    debug: true
});
```

**解決方法:**
- ファイルパスの確認
- 待機時間の調整（`waitTime`を増加）
- ネットワーク環境の確認

#### ❌ 要素が見つからない

```html
<!-- セレクターが正しく設定されているか確認 -->
<div data-sitest-type="innerHTML" data-sitest-url="replacement/content.html">
    対象コンテンツ
</div>
```

**解決方法:**
- HTML属性の記述確認
- DOM読み込み完了後の実行確認
- 要素の動的生成がある場合は`waitTime`調整

#### ❌ プレビューモードが有効にならない

```
# URLパラメータの確認
✅ https://example.com/?preview
✅ https://example.com/?delivery
✅ https://example.com/?sitest-preview
❌ https://example.com/#preview
```

**解決方法:**
- URLパラメータの確認
- 強制プレビューモード: `previewMode: true`

---

## 📚 開発者向け情報

### 🔧 カスタマイズ

#### 新しい操作タイプの追加

```javascript
// executeSingleOperation関数を拡張
case 'custom-operation':
    // カスタム処理
    break;
```

#### イベントフックの追加

```javascript
// 操作実行前後の処理
sitestReplacer.onBeforeExecute = (element, operations) => {
    console.log('操作実行前', element, operations);
};

sitestReplacer.onAfterExecute = (element, result) => {
    console.log('操作実行後', element, result);
};
```

### 📊 パフォーマンス最適化

```javascript
sitestInit({
    waitTime: 0,           // 読み込み待機なし
    retryCount: 1,         // リトライ最小
    autoInjectCSS: false,  // CSS読み込みスキップ
    debug: false          // ログ出力なし
});
```

---

## 📄 ライセンス

本ツールはSiTest案件の効率化を目的として開発されました。
プロジェクト内での利用・改変は自由に行ってください。

---

## 🤝 サポート

### 質問・要望

SiTest案件での運用について質問や機能追加の要望がある場合は、開発チームまでお気軽にご連絡ください。

### 更新履歴

- **v1.0.0**: 基本的なDOM差し替え機能
- **v2.0.0**: 複数操作対応、プレビューモード
- **v3.0.0**: サイドメニューUI、CSS管理機能
- **v3.1.0**: HTMLソースプレビュー、ワンクリックコピー

---

## 🎯 まとめ

SiTest Replacerを活用することで、SiTest案件の納品作業が大幅に効率化されます：

- ✅ **事前確認**: 実際のSiTest実行前にクライアント確認
- ✅ **作業効率**: 手動作業から自動化への移行
- ✅ **品質向上**: 視覚的プレビューによるエラー防止
- ✅ **コスト削減**: 修正工数の削減

適切な設定を行い、案件の特性に応じてカスタマイズしてご利用ください。
