import type { KeyboardEvent } from "react";

/** Props making a clickable div keyboard-accessible (Enter/Space activate). */
export function pressable(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
