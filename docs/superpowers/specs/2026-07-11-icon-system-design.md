# Icon System Design

## Goal

Replace inconsistent Unicode glyphs in interactive UI controls with Lucide SVG icons. Add icons where an action is currently text-only, while preserving the existing desktop layout and behavior.

## Scope

- Add `lucide-react` as the icon source.
- Make `src/ui/Icon.tsx` the only adapter over Lucide, using semantic names shared by all UI surfaces.
- Convert toolbar and compact action controls to icon-only buttons with `title` and `aria-label` tooltips.
- Convert sidebar navigation, tabs, command palette, and context menus to Lucide icons while retaining their text labels.
- Replace close, add, edit, delete, copy, filter, panel-toggle, and navigation glyphs wherever they represent actions.
- Keep keyboard shortcut notation, data badges, HTTP method badges, numeric metadata, and status dots as text or existing primitives.

## Interaction And Accessibility

- Icon-only buttons are 28px square and use a 15-16px icon.
- Every icon-only control exposes a readable `aria-label` and native `title` tooltip.
- Icons are decorative when adjacent to a visible action label and do not duplicate accessible names.
- Existing click, keyboard, drag, disabled, and context-menu behavior is unchanged.

## Validation

- TypeScript build passes.
- Search confirms interactive Unicode action glyphs are removed from the React UI.
- Visual regression review covers dark/light themes, hover, active, disabled, and compact controls.
