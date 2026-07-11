#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$ROOT_DIR/src-tauri/target/release/bundle/macos/ElasticMin.app"

[[ "$(uname -s)" == "Darwin" ]] || { echo "Error: macOS is required." >&2; exit 1; }
[[ "$(uname -m)" == "arm64" ]] || { echo "Error: Apple Silicon (arm64) is required." >&2; exit 1; }

for command in node npm cargo; do
  command -v "$command" >/dev/null || { echo "Error: '$command' is required." >&2; exit 1; }
done

cd "$ROOT_DIR"
[[ -d node_modules ]] || npm ci
npm run tauri build -- --bundles app

[[ -d "$APP_PATH" ]] || { echo "Error: bundle was not created at $APP_PATH" >&2; exit 1; }

printf '\nBuilt: %s\n\nOn the receiving Mac:\n' "$APP_PATH"
printf '  sudo xattr -rd com.apple.quarantine /Applications/ElasticMin.app\n'
printf '  open /Applications/ElasticMin.app\n'
