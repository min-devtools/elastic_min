# ElasticMin

Minimal Elasticsearch desktop client. Design source: `design/index.html` (static prototype).

## Stack

- **Shell**: Tauri 2 (Rust backend: reqwest + tokio, `es_request` proxy command — no CORS, custom TLS)
- **Frontend**: React 18 + TypeScript + Vite
- **State**: Zustand (`src/store.ts`) · **Server cache**: TanStack Query (`src/lib/queries.ts`)
- **Editor**: Monaco (JSON, bundled locally)
- **Persistence**: tauri-plugin-store (`elasticmin.json` — connections), localStorage (layout/theme)

## Run

```bash
npm install
npm run tauri dev      # dev app
npm run tauri build    # release bundle (.app / .dmg)
```

## Internal macOS build (English)

Build an unsigned `.app` for internal use on Apple Silicon Macs:

```bash
./bundle-macos.sh
```

Requirements: macOS on Apple Silicon (`arm64`), Node.js/npm, and the Rust toolchain. The app is created at:

```text
src-tauri/target/release/bundle/macos/ElasticMin.app
```

To transfer it, optionally create a ZIP while preserving the app bundle:

```bash
ditto -c -k --keepParent src-tauri/target/release/bundle/macos/ElasticMin.app ElasticMin-macos-arm64.zip
```

On the receiving Mac, copy `ElasticMin.app` to `/Applications`, then remove the quarantine attribute and launch it:

```bash
sudo xattr -rd com.apple.quarantine /Applications/ElasticMin.app
open /Applications/ElasticMin.app
```

This internal build is unsigned and not notarized. Only run builds received from a trusted source.

## Build macOS nội bộ (Tiếng Việt)

Build `.app` chưa ký để dùng nội bộ trên máy Mac Apple Silicon:

```bash
./bundle-macos.sh
```

Yêu cầu: macOS chạy Apple Silicon (`arm64`), Node.js/npm và Rust toolchain. App được tạo tại:

```text
src-tauri/target/release/bundle/macos/ElasticMin.app
```

Có thể tạo file ZIP để chuyển sang máy khác mà vẫn giữ đúng cấu trúc app bundle:

```bash
ditto -c -k --keepParent src-tauri/target/release/bundle/macos/ElasticMin.app ElasticMin-macos-arm64.zip
```

Trên máy nhận, chép `ElasticMin.app` vào `/Applications`, sau đó gỡ thuộc tính quarantine và mở app:

```bash
sudo xattr -rd com.apple.quarantine /Applications/ElasticMin.app
open /Applications/ElasticMin.app
```

Đây là bản build nội bộ chưa ký và chưa notarize. Chỉ chạy bản build nhận từ nguồn đáng tin cậy.

## Layout

```
src/
  styles/       design tokens + CSS ported from the prototype (tokens/base/layout/components/views)
  ui/           design-system primitives (ToolButton, Badge, Pills, JsonView, MiniTabs, ...)
  components/   app shell (Titlebar, Sidebar, TabsBar, Inspector, Statusbar, palette, toast)
  components/views/  one file per workspace tab (Query, QuickQuery, Docs, Indexes, ...)
  lib/          es client, query hooks, formatters, monaco setup, persistence
src-tauri/      Rust backend (es_request command)
```

## Features

- Connections: API key / basic / no auth, self-signed TLS opt-in, live handshake checks, saved + switchable
- Query editor: Monaco JSON, method+path, ⌘↵ run, results table with JSON-path columns (normalized/raw), pagination, bulk delete (_bulk), copy NDJSON
- Quick Query: mapping-driven filter builder → generated \_search body → open in Query tab
- Documents: browse/filter (query_string), inline JSON edit with diff review + optimistic concurrency (if_seq_no)
- All Indexes: live _cat/indices + aliases, context menu (query/docs/mapping/copy)
- Create Index: settings + aliases + mapping builder with dotted paths → PUT preview
- Cluster: health, shards, heap pressure, largest indexes
- Mapping viewer, inspector panel (JSON/metadata/actions), command palette (⌘K), light/dark, compact mode, resizable panels
