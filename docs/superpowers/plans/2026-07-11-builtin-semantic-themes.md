# Built-in Semantic Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply every built-in palette consistently to all application UI and Monaco through one typed semantic theme contract.

**Architecture:** Replace generated CSS selectors with a typed built-in registry whose selected palette is written as CSS variables on `document.body`. Central CSS tokens derive interaction effects from that semantic palette, so components consume roles rather than palette-specific or literal colors. Monaco receives the same semantic palette for syntax and editor chrome.

**Tech Stack:** React 18, TypeScript 5.6, Zustand 5, CSS custom properties and `color-mix()`, Monaco Editor 0.52, Vite 5.

## Global Constraints

- Support built-in themes only. Do not add custom-theme file loading, import/export, sharing, or Settings controls for it.
- Preserve all existing built-in theme IDs and persisted `elasticmin:theme` selection.
- Use a versioned internal JSON-compatible semantic contract in TypeScript.
- Components must not add color literals; use central semantic CSS variables and derived CSS tokens.
- Keep `netherize_editor/config/themes` as the source palette reference.
- Do not overwrite unrelated uncommitted work already present in the workspace.

---

## File Structure

- Create: `src/lib/themeContract.ts` - semantic theme TypeScript interfaces, default palette, validation-free CSS variable map, and selection fallback.
- Modify: `src/lib/themes.ts` - built-in metadata and palettes converted from the existing generated CSS collection into the semantic registry.
- Modify: `src/App.tsx` - apply selected semantic variables to `document.body` and pass the palette to Monaco.
- Modify: `src/lib/monaco.ts` - map semantic palette to Monaco syntax and editor chrome colors.
- Modify: `src/styles/tokens.css` - declare default semantic and derived tokens, removing legacy base-specific palette overrides.
- Modify: `src/styles/themes.css` - remove generated per-theme `body[data-theme]` palette definitions after registry migration.
- Modify: `src/styles/base.css`, `src/styles/layout.css`, `src/styles/components.css`, `src/styles/views.css` - replace literal and legacy-role color usage with semantic tokens.
- Modify: `src/components/views/SettingsView.tsx` - source theme count and options from the semantic built-in registry.
- Test: `npm run build` - TypeScript and production bundle validation.

### Task 1: Establish the semantic theme contract and built-in registry

**Files:**
- Create: `src/lib/themeContract.ts`
- Modify: `src/lib/themes.ts`
- Modify: `src/store.ts:112-113,194,360-370`

**Interfaces:**
- Produces `SemanticTheme`, `ThemeColors`, `DEFAULT_THEME_ID`, `getTheme(id: string): SemanticTheme`, and `themeBase(id: string): "dark" | "light"`.
- Consumed by `App`, `SettingsView`, `Titlebar`, `store`, and Monaco integration.

- [ ] **Step 1: Add a compile-time semantic contract**

```ts
export interface ThemeColors {
  surface: { app: string; window: string; panel: string; raised: string; hover: string; editor: string; overlay: string };
  text: { primary: string; secondary: string; muted: string; onAccent: string };
  border: { default: string; strong: string };
  accent: { primary: string; secondary: string; focus: string };
  status: { success: string; warning: string; danger: string; info: string };
  syntax: { key: string; string: string; number: string; boolean: string; null: string; punctuation: string };
}

export interface SemanticTheme {
  version: 1;
  id: string;
  label: string;
  base: "dark" | "light";
  colors: ThemeColors;
}
```

- [ ] **Step 2: Implement built-in lookup with persisted-ID fallback**

```ts
export const DEFAULT_THEME_ID = "dark";

export function getTheme(id: string): SemanticTheme {
  return THEMES.find((theme) => theme.id === id)
    ?? THEMES.find((theme) => theme.id === DEFAULT_THEME_ID)!;
}

export const themeBase = (id: string) => getTheme(id).base;
```

- [ ] **Step 3: Convert each current generated palette to `SemanticTheme` entries**

Use every existing `body[data-theme="..."]` definition in `src/styles/themes.css`. Map `app-bg`, `window`, `pane`, `pane-2`, `pane-3`, `glass`, `text`, `text-2`, `text-3`, `line`, `line-2`, `blue`, `blue-2`, `green`, `orange`, `red`, and `purple` into the contract. Set `text.onAccent` to the palette's editor/app surface where it gives readable primary-action text. Keep IDs and labels unchanged.

- [ ] **Step 4: Ensure the store cannot retain an unavailable theme ID**

```ts
import { DEFAULT_THEME_ID, getTheme, themeBase } from "./lib/themes";

theme: getTheme(localStorage.getItem("elasticmin:theme") || DEFAULT_THEME_ID).id,

setTheme: (id) => {
  const theme = getTheme(id).id;
  localStorage.setItem("elasticmin:theme", theme);
  set({ theme });
},
```

- [ ] **Step 5: Run the production build**

Run: `npm run build`

Expected: exits `0`; TypeScript accepts all registry entries and current consumers.

- [ ] **Step 6: Commit the isolated contract work**

```bash
git add src/lib/themeContract.ts src/lib/themes.ts src/store.ts
git commit -m "feat: add semantic builtin theme registry"
```

### Task 2: Apply one selected palette to CSS custom properties

**Files:**
- Modify: `src/App.tsx:56-90`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/themes.css`

**Interfaces:**
- Consumes `getTheme(theme).colors`.
- Produces body-scoped CSS properties `--surface-*`, `--text-*`, `--border-*`, `--accent-*`, `--status-*`, and `--syntax-*`.
- Consumed by all stylesheet files and `retintMonaco`.

- [ ] **Step 1: Add a single palette-to-CSS-variable function**

```ts
function applyTheme(theme: SemanticTheme) {
  const style = document.body.style;
  const entries = [
    ["--surface-app", theme.colors.surface.app],
    ["--surface-window", theme.colors.surface.window],
    ["--surface-panel", theme.colors.surface.panel],
    ["--surface-raised", theme.colors.surface.raised],
    ["--surface-hover", theme.colors.surface.hover],
    ["--surface-editor", theme.colors.surface.editor],
    ["--surface-overlay", theme.colors.surface.overlay],
    ["--text-primary", theme.colors.text.primary],
    ["--text-secondary", theme.colors.text.secondary],
    ["--text-muted", theme.colors.text.muted],
    ["--text-on-accent", theme.colors.text.onAccent],
  ] as const;
  for (const [name, value] of entries) style.setProperty(name, value);
}
```

Add all border, accent, status, and syntax paths following the same explicit mapping. Invoke it before reading computed values and retinting Monaco.

- [ ] **Step 2: Declare semantic defaults and derived tokens in `tokens.css`**

```css
:root {
  --surface-app: #08090c;
  --surface-window: #111216;
  --surface-panel: #15171c;
  --surface-raised: #191b21;
  --surface-hover: #20232a;
  --text-primary: #f4f5f7;
  --text-secondary: #a4a8b2;
  --text-muted: #717680;
  --accent-primary: #5aa7ff;
  --accent-secondary: #1f6feb;
  --status-success: #58d68d;
  --status-warning: #f7b267;
  --status-danger: #ff6b75;
  --status-info: #5aa7ff;
  --row: color-mix(in oklab, var(--surface-panel), var(--text-primary) 3%);
  --row-alt: color-mix(in oklab, var(--surface-panel), var(--text-primary) 5%);
  --surface-selected: color-mix(in oklab, var(--accent-primary), transparent 86%);
  --focus-ring: color-mix(in oklab, var(--accent-focus), transparent 84%);
  --modal-backdrop: color-mix(in oklab, var(--surface-app), transparent 28%);
}
```

Keep temporary aliases (`--app-bg`, `--pane`, `--text`, `--blue`, and equivalent) only during the stylesheet migration. Remove aliases when all consumers use semantic names.

- [ ] **Step 3: Remove generated CSS theme selectors and legacy light override**

Delete the per-theme rules in `src/styles/themes.css`; retain no `body[data-theme]` color definitions. Delete `body.light` palette values from `tokens.css`. Keep `data-theme` only if required as an inspectable theme identifier.

- [ ] **Step 4: Verify runtime switching and fallback**

Run: `npm run dev`

Expected: changing Settings theme immediately changes body semantic variables; replacing `elasticmin:theme` with an invalid ID and reloading selects `dark` without console errors.

- [ ] **Step 5: Commit the CSS-variable application layer**

```bash
git add src/App.tsx src/styles/tokens.css src/styles/themes.css
git commit -m "feat: apply builtin themes through semantic tokens"
```

### Task 3: Make Monaco fully consume the semantic palette

**Files:**
- Modify: `src/lib/monaco.ts:14-44`
- Modify: `src/App.tsx:71-84`
- Modify: `src/ui/JsonEditor.tsx:87-107`

**Interfaces:**
- Consumes computed CSS variables for surface, text, border, accent, status, and syntax roles.
- Produces the `elasticmin-live` Monaco theme with editor, widget, selection, validation, and JSON token colors.

- [ ] **Step 1: Expand the palette passed by `App`**

```ts
retintMonaco(activeTheme.base, {
  surfaceEditor: value("--surface-editor"),
  surfaceRaised: value("--surface-raised"),
  textPrimary: value("--text-primary"),
  textMuted: value("--text-muted"),
  borderDefault: value("--border-default"),
  accentPrimary: value("--accent-primary"),
  accentFocus: value("--accent-focus"),
  statusDanger: value("--status-danger"),
  statusWarning: value("--status-warning"),
  syntaxKey: value("--syntax-key"),
  syntaxString: value("--syntax-string"),
  syntaxNumber: value("--syntax-number"),
  syntaxBoolean: value("--syntax-boolean"),
  syntaxNull: value("--syntax-null"),
});
```

- [ ] **Step 2: Define Monaco JSON tokens and chrome colors from those roles**

```ts
rules: [
  { token: "string.key.json", foreground: bare(p.syntaxKey, "5aa7ff") },
  { token: "string.value.json", foreground: bare(p.syntaxString, "58d68d") },
  { token: "number", foreground: bare(p.syntaxNumber, "79c0ff") },
  { token: "keyword.json", foreground: bare(p.syntaxBoolean, "b794f4") },
  { token: "delimiter", foreground: bare(p.textMuted, "717680") },
],
colors: {
  "editor.background": withHash(p.surfaceEditor, "0d0f14"),
  "editor.foreground": withHash(p.textPrimary, "d7dce5"),
  "editorCursor.foreground": withHash(p.accentFocus, "5aa7ff"),
  "editor.selectionBackground": alpha(p.accentPrimary, "33"),
  "editor.lineHighlightBackground": alpha(p.accentPrimary, "12"),
  "editorWidget.background": withHash(p.surfaceRaised, "191b21"),
  "editorWidget.border": withHash(p.borderDefault, "333842"),
  "editorError.foreground": withHash(p.statusDanger, "ff6b75"),
  "editorWarning.foreground": withHash(p.statusWarning, "f7b267"),
}
```

Implement `alpha()` only for valid `#RRGGBB` values; use a safe fallback for non-hex theme tokens.

- [ ] **Step 3: Preserve explicit editor visual behavior**

Keep minimap disabled, `renderLineHighlight: "none"`, and custom field highlight decorations in `JsonEditor`. Confirm the new Monaco colors do not introduce an unwanted active-line background.

- [ ] **Step 4: Verify an editor under dark and light themes**

Run: `npm run build`

Expected: exits `0`. In the app, JSON keys, strings, numbers, booleans, nulls, cursor, autocomplete widget, selection, warning/error, and clicked-field highlight all change with the selected theme.

- [ ] **Step 5: Commit Monaco integration**

```bash
git add src/App.tsx src/lib/monaco.ts src/ui/JsonEditor.tsx
git commit -m "feat: synchronize monaco with semantic theme colors"
```

### Task 4: Migrate every application surface and interaction state

**Files:**
- Modify: `src/styles/base.css`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/components.css`
- Modify: `src/styles/views.css`

**Interfaces:**
- Consumes semantic and derived variables from `src/styles/tokens.css`.
- Produces palette-neutral styling for all UI components.

- [ ] **Step 1: Replace legacy surface, text, and border variables**

Map all declarations as follows:

```css
/* old role                 new semantic role */
var(--app-bg)                var(--surface-app)
var(--window)                var(--surface-window)
var(--pane)                  var(--surface-panel)
var(--pane-2)                var(--surface-raised)
var(--pane-3)                var(--surface-hover)
var(--glass)                 var(--surface-overlay)
var(--editor-bg)             var(--surface-editor)
var(--text)                  var(--text-primary)
var(--text-2)                var(--text-secondary)
var(--text-3)                var(--text-muted)
var(--line)                  var(--border-default)
var(--line-2)                var(--border-strong)
```

- [ ] **Step 2: Replace accents and statuses by meaning**

```css
.tool-btn.primary { color: var(--text-on-accent); background: var(--accent-secondary); border-color: var(--accent-primary); }
.toast { background: var(--surface-overlay); border-color: var(--border-strong); }
.health-pill.green { color: var(--status-success); background: color-mix(in oklab, var(--status-success), transparent 90%); }
.health-pill.orange { color: var(--status-warning); background: color-mix(in oklab, var(--status-warning), transparent 90%); }
.health-pill.red { color: var(--status-danger); background: color-mix(in oklab, var(--status-danger), transparent 90%); }
```

Use `accent.primary` for active, selected, linked, and focus visuals. Use `status.info` only for informational status. Use syntax roles for JSON and quick-query syntax classes.

- [ ] **Step 3: Remove literal palette-dependent effects**

Replace all `#fff`, `#6f5bff`, fixed `rgba(0, 0, 0, ...)`, fixed `rgba(255, 255, 255, ...)`, and `color-mix(..., black ...)` declarations that determine UI colors. Use `--text-on-accent`, `--modal-backdrop`, `--shadow`, or new centrally-defined derived variables. Preserve only transparent constants and non-color sizing values.

- [ ] **Step 4: Standardize data presentation**

Ensure table headers use muted text and panel surface, rows use `--row` and `--row-alt`, hover/selected rows use `--surface-selected`, and all typed cells use syntax/status/accent roles. Ensure `.json-tree`, `.quick-query-code`, create preview, docs preview, and diff use the matching `--syntax-*` classes and semantic foreground/surface colors.

- [ ] **Step 5: Standardize overlays and transient UI**

Set command palette, context menu, combobox list, toast, modal, diff dialog, cards, badges, form controls, tabs, tooltips, and AI chat bubbles to semantic surface/text/border tokens. Modal and command overlays must use `--modal-backdrop`; primary and segmented active buttons must use `--text-on-accent`.

- [ ] **Step 6: Verify stylesheet migration is complete**

Run: `rg --glob '*.css' '#[0-9A-Fa-f]{3,8}|rgba\(|color-mix\([^\n]*black' src/styles`

Expected: only default semantic token declarations and approved derived-token definitions in `tokens.css`; no component-level fixed palette colors.

- [ ] **Step 7: Run production build**

Run: `npm run build`

Expected: exits `0`.

- [ ] **Step 8: Commit the UI migration**

```bash
git add src/styles/base.css src/styles/layout.css src/styles/components.css src/styles/views.css src/styles/tokens.css
git commit -m "feat: use semantic tokens across application ui"
```

### Task 5: Validate built-in selection and regressions

**Files:**
- Modify: `src/components/views/SettingsView.tsx:4,75-94`
- Modify: `README.md`

**Interfaces:**
- Consumes `THEMES`, `getTheme`, and `themeBase` from the semantic registry.
- Documents built-in-only support and the internal future-compatible JSON contract.

- [ ] **Step 1: Update Settings copy to accurately describe the registry**

```tsx
desc={`${THEMES.length} built-in themes using one semantic color contract.`}
```

Keep the Dark and Light groups based on each registry entry's `base` field.

- [ ] **Step 2: Document theme architecture without exposing custom loading**

Add a README section stating that built-in themes are normalized through the semantic contract, reference `src/lib/themeContract.ts`, and state that user theme import/export is intentionally out of scope.

- [ ] **Step 3: Manually test representative palettes**

Run: `npm run dev`

Verify `dark`, `light`, `ayu-mirage`, `bearded-hc-flurry`, `cyberpunk-neon`, and `sakura-pastel` in Settings. For each, check application chrome, a query editor, Quick Query preview, Documents table and JSON preview, inspector editor, card/form controls, command palette, toast, badge/status pill, modal, and selected/hover/focus states.

- [ ] **Step 4: Verify persistence and unavailable-ID fallback**

In browser devtools, set `localStorage.setItem("elasticmin:theme", "missing")`, reload, and confirm Settings selects `ElasticMin Dark`. Then choose `sakura-pastel`, reload, and confirm the selection and all surfaces restore.

- [ ] **Step 5: Run final static checks**

Run: `git diff --check && npm run build`

Expected: both commands exit `0`.

- [ ] **Step 6: Commit docs and Settings copy**

```bash
git add README.md src/components/views/SettingsView.tsx
git commit -m "docs: describe builtin semantic themes"
```

## Self-Review

- Spec coverage: Tasks 1 and 2 establish the built-in-only JSON-compatible registry and runtime CSS application; Task 3 covers Monaco; Task 4 covers every stated UI family and hard-coded colors; Task 5 covers Settings, docs, persistence, and representative theme verification.
- Placeholder scan: no unresolved placeholders or deferred implementation steps remain.
- Type consistency: `SemanticTheme`, `ThemeColors`, `getTheme`, `THEMES`, `DEFAULT_THEME_ID`, and `themeBase` retain the same names between all tasks.
