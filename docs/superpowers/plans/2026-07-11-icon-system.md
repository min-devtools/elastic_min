# Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Unicode action glyphs with a unified Lucide icon system and make compact action controls icon-only with accessible tooltips.

**Architecture:** `src/ui/Icon.tsx` will be the single adapter from semantic app icon names to Lucide components. UI surfaces use that adapter: action buttons render only the icon, while navigation and menus pair the icon with existing labels.

**Tech Stack:** React 18, TypeScript, Lucide React, Vite.

## Global Constraints

- Add `lucide-react` as the only external icon dependency.
- Do not alter current interaction behavior, keyboard shortcuts, layout structure, status dots, badges, or text labels used for navigation.
- Every icon-only button has both `title` and `aria-label`.
- Use `src/ui/Icon.tsx` for every Lucide icon reference.

---

### Task 1: Establish The Lucide Adapter And Icon Button Primitive

**Files:**
- Modify: `package.json`
- Modify: `src/ui/Icon.tsx`
- Modify: `src/ui/ToolButton.tsx`
- Modify: `src/styles/components.css`

**Interfaces:**
- Produces: `IconName`, `Icon({ name, size, style, className })`, and `ToolButton` support for `iconOnly`.

- [ ] **Step 1: Add the dependency**

Run: `npm install lucide-react`

- [ ] **Step 2: Replace inline SVG paths with semantic Lucide mappings**

Map app action names such as `play`, `plus`, `x`, `refresh`, `search`, `settings`, `save`, `copy`, `trash`, `filter`, `pencil`, `panel-left`, and `panel-right` to their corresponding Lucide components. Preserve the current `Icon` props.

- [ ] **Step 3: Add icon-only button styling**

Extend `ToolButton` with `iconOnly?: boolean` and emit the `icon-only` class. Set its width and padding so the existing 28px control becomes a square button without affecting labeled buttons.

- [ ] **Step 4: Build the project**

Run: `npm run build`

Expected: TypeScript compilation and Vite build complete with exit code 0.

### Task 2: Convert Shared Action Controls

**Files:**
- Modify: `src/components/Titlebar.tsx`
- Modify: `src/components/TabsBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Icon`, `ToolButton({ iconOnly })` from Task 1.

- [ ] **Step 1: Convert titlebar actions to icon-only controls**

Render `Icon` children for Run, Query, Cancel, Refresh, theme, compact density, and Settings. Preserve each existing `title`, add matching `aria-label`, and pass `iconOnly`.

- [ ] **Step 2: Convert tab and panel controls**

Use `Icon` for tab close, new tab, rename, close others, and both bottom panel toggles. Keep the `Query` label in the tab-add control because it is navigation, not a compact action.

- [ ] **Step 3: Build the project**

Run: `npm run build`

Expected: TypeScript compilation and Vite build complete with exit code 0.

### Task 3: Convert Navigation, Menus, And View Actions

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/views/QueryView.tsx`
- Modify: `src/components/views/QuickQueryView.tsx`
- Modify: `src/components/views/ResultsPanel.tsx`
- Modify: `src/components/views/IndexesView.tsx`
- Modify: other React UI files found by searching action glyphs.

**Interfaces:**
- Consumes: `Icon` from Task 1.

- [ ] **Step 1: Convert sidebar and command-palette item icons**

Represent workspace destinations, connection actions, saved queries, index actions, and command palette entries with semantic `Icon` elements. Keep all visible labels, metadata, shortcuts, badges, and status dots unchanged.

- [ ] **Step 2: Convert remaining action glyphs**

Replace text close/edit/delete/add/copy/filter controls in views with appropriate `Icon` elements. When the control has no visible text, add `aria-label` and `title`.

- [ ] **Step 3: Verify action-glyph cleanup and build**

Run: `npm run build && rg '[✦✧✎×＋◨◧◆◇●○▣▤⚙☰⌥↗⌄]' src --glob '*.tsx'`

Expected: build succeeds; remaining matches are only semantic text or keyboard notation, never interactive action controls.

### Task 4: Review UI States

**Files:**
- Modify only when required by findings from review.

- [ ] **Step 1: Run the app**

Run: `npm run dev`

- [ ] **Step 2: Review both themes and interaction states**

Check toolbar, sidebar, tabs, context menus, command palette, query actions, disabled Cancel, and bottom panel toggles in light and dark modes. Confirm icon color inherits the prior control color and tooltips expose each icon-only action.

- [ ] **Step 3: Run the final build**

Run: `npm run build`

Expected: TypeScript compilation and Vite build complete with exit code 0.
