# SiTest Replacer

🚀 **SiTestswの納品ファイルを開発用ライブラリ**

テスト環境や納品ファイルで、SiTestと同じ挙動を確認できる軽量なスクリプトです。

## ✨ 特徴

- 🔄 **完全自動**: スクリプト読み込みだけで動作開始
- 📱 **インタラクティブプレビュー**: URLパラメータで納品用プレビュー表示
- 🎯 **SiTest互換**: outerHTML, innerHTML, insertAfter, insertBefore, remove対応
- ⚡ **軽量**: 依存関係なし、単一ファイル（~20KB）
- 🛠️ **カスタマイズ可能**: 豊富な設定オプション
- 🔧 **本番対応**: エラーハンドリング完備

## 🚀 クイックスタート

### 1. HTMLマークアップ
```html
<!DOCTYPE html>
<html>
<head>
    <title>マイサイト</title>
</head>
<body>
    <!-- 差し替え対象要素 -->
    <div data-sitest-type="outerHTML" data-sitest-url="new-header.html">
        <h1>古いヘッダー</h1>
    </div>
    
    <section data-sitest-type="innerHTML" data-sitest-url="new-content.html">
        <p>この内容が差し替わります</p>
    </section>
    
    <aside data-sitest-type="remove">
        この要素は削除されます
    </aside>

    <!-- スクリプト読み込み -->
    <script src="sitest-replacer.js"></script>
</body>
</html>
```

### 2. 差し替え用HTMLファイル
```html
<!-- new-header.html -->
<header class="new-header">
    <h1>新しいヘッダー</h1>
    <nav>
        <a href="#home">ホーム</a>
        <a href="#about">について</a>
    </nav>
    <style>
        .new-header { background: #007bff; color: white; }
    </style>
</header>
```

### 3. プレビューモード
```
通常表示: https://example.com/page.html
プレビュー: https://example.com/page.html?preview
```

## 🎨 プレビューモード

URLにパラメータを追加するだけで、インタラクティブなプレビューモードに切り替わります。

```
https://example.com/page.html?preview
https://example.com/page.html?delivery
https://example.com/page.html?sitest-preview
```

### プレビューモードの機能

| 表示 | 説明 |
|------|------|
| 🟠 **オレンジ枠** | 差し替え予定要素 |
| 🔴 **赤枠** | 削除予定要素 |
| 🟢 **緑枠** | 差し替え済み要素 |
| ⚡ **右上ボタン** | クリックで差し替え実行 |
| ↶ **元に戻すボタン** | 差し替え後に元に戻す |
| 📋 **要素クリック** | 詳細情報表示 |
| 🔍 **オーバーレイクリック** | HTMLプレビュー |

## 📝 差し替えタイプ

| タイプ | 別名 | 動作 | HTMLファイル |
|-------|------|------|-------------|
| `outerHTML` | `outer` | 要素全体を置換 | 必要 |
| `innerHTML` | `inner` | 要素の内容のみ置換 | 必要 |
| `insertAfter` | `after` | 要素の直後に挿入 | 必要 |
| `insertBefore` | `before` | 要素の直前に挿入 | 必要 |
| `remove` | - | 要素を削除 | 不要 |

### 使用例
```html
<!-- 要素全体を差し替え -->
<div data-sitest-type="outerHTML" data-sitest-url="new-section.html">
    元のコンテンツ
</div>

<!-- 要素の後に挿入 -->
<div data-sitest-type="insertAfter" data-sitest-url="additional.html">
    既存コンテンツ
</div>

<!-- 要素を削除（HTMLファイル不要） -->
<div data-sitest-type="remove">
    削除される要素
</div>
```

## ⚙️ 設定オプション

### 基本設定
```javascript
sitestInit({
    baseUrl: '/replacements/',    // HTMLファイルのベースURL
    debug: false,                 // デバッグログの表示
    waitTime: 500,               // DOM安定後の待機時間（ms）
    previewPosition: 'top-right' // プレビューUI表示位置
});
```

### 詳細設定
```javascript
const replacer = new SiTestReplacer({
    baseUrl: 'https://cdn.example.com/ab-test/',
    waitTime: 1000,
    debug: true,
    retryCount: 5,
    retryDelay: 2000,
    previewMode: true,
    previewPosition: 'center',
    attributeName: 'data-custom-type'
});
```

### 設定オプション一覧

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `baseUrl` | `''` | HTMLファイルの基本URL |
| `waitTime` | `500` | DOM安定後の追加待機時間（ms） |
| `debug` | `false` | デバッグログの表示 |
| `retryCount` | `3` | ネットワークエラー時のリトライ回数 |
| `retryDelay` | `1000` | リトライ間隔（ms） |
| `previewMode` | `false` | プレビューモードの強制有効化 |
| `previewPosition` | `'top-right'` | プレビューUI表示位置 |
| `attributeName` | `'data-sitest-type'` | 差し替えタイプ指定の属性名 |

### プレビュー表示位置
- `top-left`: 左上
- `top-right`: 右上（デフォルト）
- `center`: 中央
- `bottom-left`: 左下
- `bottom-right`: 右下

## 🔧 API

### グローバル関数

```javascript
// 手動実行
sitestExecute();

// 状態リセット
sitestReset();

// プレビューモードか確認
sitestIsPreview(); // true/false

// カスタム設定で初期化
sitestInit({
    baseUrl: '/custom-path/',
    debug: true
});
```

### クラスメソッド

```javascript
const replacer = new SiTestReplacer(options);

// 初期化
await replacer.init();

// 手動実行
await replacer.execute();

// 状態リセット
replacer.reset();
```

## 💼 使用例

### 開発環境
```javascript
sitestInit({
    baseUrl: '/dev-assets/',
    debug: true,
    waitTime: 1000
});
```

### 本番環境
```javascript
sitestInit({
    baseUrl: 'https://cdn.example.com/replacements/',
    debug: false,
    waitTime: 200,
    retryCount: 5
});
```

### A/Bテスト
```html
<div data-sitest-type="outerHTML" data-sitest-url="pattern-a.html">
    デフォルトコンテンツ
</div>

<script>
// 条件に応じてパターン変更
if (Math.random() > 0.5) {
    document.querySelector('[data-sitest-type]')
        .setAttribute('data-sitest-url', 'pattern-b.html');
}
</script>
```

## 🛠️ ファイル構成例

```
project/
├── index.html              # メインページ
├── sitest-replacer.js      # スクリプト
├── replacements/           # 差し替え用HTMLファイル
│   ├── new-header.html
│   ├── new-content.html
│   ├── additional-info.html
│   └── banner.html
└── assets/
    ├── css/
    └── js/
```

## 🔍 トラブルシューティング

### よくある問題

**Q: 差し替えが実行されない**
```javascript
// デバッグモードで確認
sitestInit({ debug: true });
// コンソールログを確認してください
```

**A: 考えられる原因**
- HTMLファイルのパスが間違っている
- CORSエラー（ローカルファイルアクセス制限）
- DOM読み込み前にスクリプトが実行された

**Q: HTMLファイルが見つからない**
```javascript
// baseURLを正しく設定
sitestInit({
    baseUrl: '/correct-path/',
    debug: true
});
```

**Q: プレビューモードにならない**
```javascript
// URLパラメータを確認するか、強制有効化
sitestInit({ previewMode: true });
```

### エラーコード

| エラー | 原因 | 解決策 |
|-------|------|--------|
| `HTTP 404` | HTMLファイルが見つからない | パスを確認 |
| `CORS Error` | クロスオリジンアクセス制限 | サーバー経由でアクセス |
| `HTML parsing failed` | 不正なHTML | HTMLの構文を確認 |

**報告時に含めてほしい情報：**
- ブラウザとバージョン
- エラーメッセージ
- 再現手順
- 期待する動作
