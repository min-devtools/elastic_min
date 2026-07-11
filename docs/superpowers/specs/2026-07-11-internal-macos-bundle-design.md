# Internal macOS Bundle Script Design

## Goal

Provide a root-level `bundle-macos.sh` that builds an unsigned ElasticMin `.app` for internal distribution to Apple Silicon Macs. The user may ZIP the app manually.

## Behavior

- Require macOS on Apple Silicon (`arm64`).
- Require `node`, `npm`, and `cargo`.
- Run `npm ci` only when `node_modules` is absent.
- Run Tauri with the `app` bundle target.
- Verify that `src-tauri/target/release/bundle/macos/ElasticMin.app` exists.
- Print the artifact path and the recipient-side `xattr` command.
- Exit immediately with a useful error when a prerequisite or build step fails.

## Distribution

The output is unsigned and not notarized. After copying the app into `/Applications`, recipients remove macOS quarantine and launch it with:

```bash
sudo xattr -rd com.apple.quarantine /Applications/ElasticMin.app
open /Applications/ElasticMin.app
```

## Documentation

README instructions will be provided in English and Vietnamese. They will explain the Apple Silicon limitation, local build command, output path, optional ZIP command, and recipient installation steps.

## Verification

- Validate shell syntax with `bash -n bundle-macos.sh`.
- Execute `./bundle-macos.sh` on the current Apple Silicon Mac.
- Confirm the expected `.app` directory exists after the build.
