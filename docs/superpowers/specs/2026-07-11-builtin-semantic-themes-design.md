# Built-in Semantic Themes

## Goal

Make every built-in theme apply consistently across the application: application chrome, tables, JSON views, query previews, Monaco editors, cards, badges, toasts, forms, menus, modals, hover/focus/selection states, and status states.

The theme format must be a stable internal JSON contract so future user-supplied theme files can use the same model without changing UI components.

## Scope

- Convert the built-in themes derived from `netherize_editor/config/themes` to a common versioned semantic JSON format.
- Load and apply built-in themes only.
- Keep the existing Settings theme selector, populated from the new built-in registry.
- Do not add user theme directories, importing, exporting, sharing, or a custom-theme editor.

## Theme Contract

Each built-in theme contains metadata and colors grouped by visual role rather than component name.

```json
{
  "version": 1,
  "id": "ayu-mirage",
  "label": "Ayu Mirage",
  "base": "dark",
  "colors": {
    "surface": {
      "app": "#1F2430",
      "window": "#171B24",
      "panel": "#1F2430",
      "raised": "#242936",
      "hover": "#33415E",
      "editor": "#1F2430",
      "overlay": "rgba(23, 27, 36, 0.82)"
    },
    "text": {
      "primary": "#CBCCC6",
      "secondary": "#9DAAB6",
      "muted": "#5C6773",
      "onAccent": "#1F2430"
    },
    "border": {
      "default": "rgba(16, 21, 33, 0.55)",
      "strong": "rgba(16, 21, 33, 0.9)"
    },
    "accent": {
      "primary": "#FFCC66",
      "secondary": "#73D0FF",
      "focus": "#73D0FF"
    },
    "status": {
      "success": "#BAE67E",
      "warning": "#FFAE57",
      "danger": "#F07178",
      "info": "#73D0FF"
    },
    "syntax": {
      "key": "#FFCC66",
      "string": "#BAE67E",
      "number": "#73D0FF",
      "boolean": "#D2A6FF",
      "null": "#F07178",
      "punctuation": "#5C6773"
    }
  }
}
```

Derived effects, including alternating table rows, selected rows, focus rings, tooltip surfaces, modal backdrops, and shadows, are created with `color-mix()` from these tokens. Components must not embed color literals.

## Architecture

- A typed built-in theme registry owns metadata and semantic color values.
- A small application function maps one registry entry to CSS custom properties on `document.body`.
- CSS components consume only those semantic properties and derived properties declared centrally in `tokens.css`.
- The existing `data-theme` selector is replaced by runtime token application, removing the generated per-theme CSS selectors and obsolete `body.light` palette overrides.
- Monaco receives the active semantic palette and defines all relevant editor, selection, gutter, widget, validation, and JSON syntax colors under the existing live Monaco theme name.

## UI Rules

- Surface colors are used for application chrome, panes, raised controls, editors, and overlays.
- Text colors are used for primary, secondary, muted, and accent-on text. Buttons must use `text.onAccent`, never fixed white.
- Accent colors are used for primary actions, selection, focus, active controls, and informational emphasis.
- Status colors are used exclusively for success, warning, danger, and informational states in toasts, badges, dots, validation, and health indicators.
- Syntax colors are used by `JsonView`, quick-query preview, and Monaco JSON rules.
- Table header, body text, zebra rows, hover, selected state, and typed-cell styles are all derived from semantic variables.
- Cards, badges, menus, modals, inputs, tabs, and tooltips use semantic surface, border, text, accent, and status variables.

## Error Handling

Built-in registry entries are validated by TypeScript at build time. Theme lookup falls back to the default dark built-in theme when persisted state references an unavailable ID. Monaco uses safe default colors only if a semantic token is unexpectedly absent.

## Verification

- Type-check and build the application.
- Switch between representative dark, light, high-contrast, and unconventional-accent built-in themes.
- Verify visual contrast and semantic coloring in every supported UI family.
- Verify Monaco updates its editor surface, syntax tokens, selection, widgets, and validation colors immediately on theme switch.
- Verify persisted theme selection restores after reload and unavailable IDs fall back cleanly.
