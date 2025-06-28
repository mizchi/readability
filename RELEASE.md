# リリース手順

## 自動リリース（推奨）

1. バージョンを更新
   ```bash
   npm version patch  # または minor, major
   ```

2. タグをプッシュ
   ```bash
   git push origin main --tags
   ```

3. GitHub Actionsが自動的に以下を実行：
   - プロジェクトのビルド
   - DXTパッケージの作成
   - GitHubリリースの作成
   - DXTファイルのアップロード

## 手動リリース

1. ビルドとパッケージ作成
   ```bash
   npm install
   npm run build
   npm install -g @anthropic-ai/dxt
   dxt pack .
   ```

2. GitHubで手動リリース作成
   - [Releases](https://github.com/mizchi/readability/releases) ページへ
   - "Draft a new release" をクリック
   - タグとリリース名を設定
   - `readability.dxt` ファイルをアップロード

## リリースノート例

```markdown
## Readability MCP Server v0.6.8

### 新機能
- DXT (Desktop Extensions) サポートを追加
- Claude Desktopでワンクリックインストール可能に

### インストール方法
1. `readability-0.6.8.dxt` をダウンロード
2. Claude Desktopを開く
3. .dxtファイルをドラッグ&ドロップ
4. "Install" をクリック

### 使用方法
`read_url_content_as_markdown` ツールを使用してWebページから読みやすいコンテンツを抽出できます。
```