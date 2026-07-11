# Internal macOS Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reliable command that builds an unsigned ElasticMin `.app` for internal distribution to Apple Silicon Macs.

**Architecture:** A root-level Bash script validates its host and toolchain, installs locked Node dependencies when needed, delegates bundling to Tauri, and verifies the expected artifact. The README documents build and recipient installation flows in English and Vietnamese.

**Tech Stack:** Bash, npm, Tauri 2, Rust/Cargo, macOS `xattr`

---

### Task 1: Add the bundle script

**Files:**
- Create: `bundle-macos.sh`

- [ ] **Step 1: Verify the script does not exist**

Run: `test ! -e bundle-macos.sh`
Expected: exit status 0.

- [ ] **Step 2: Create the script**

Create a strict Bash script that resolves the repository root, requires Darwin/arm64 and `node`, `npm`, `cargo`, installs with `npm ci` only when `node_modules` is absent, runs `npm run tauri build -- --bundles app`, verifies `src-tauri/target/release/bundle/macos/ElasticMin.app`, and prints the artifact and recipient commands.

- [ ] **Step 3: Make it executable and validate syntax**

Run: `chmod +x bundle-macos.sh && bash -n bundle-macos.sh`
Expected: exit status 0.

### Task 2: Document internal distribution

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add English instructions**

Document `./bundle-macos.sh`, the Apple Silicon requirement, artifact path, optional ZIP command, and recipient `xattr`/`open` commands.

- [ ] **Step 2: Add equivalent Vietnamese instructions**

Keep all commands and paths identical to the English section.

### Task 3: Verify the complete flow

**Files:**
- Test: `bundle-macos.sh`
- Test: `src-tauri/target/release/bundle/macos/ElasticMin.app`

- [ ] **Step 1: Run the bundle script**

Run: `./bundle-macos.sh`
Expected: Tauri build succeeds and the script prints the `.app` path.

- [ ] **Step 2: Verify the artifact and repository diff**

Run: `test -d src-tauri/target/release/bundle/macos/ElasticMin.app && git diff --check`
Expected: exit status 0.
