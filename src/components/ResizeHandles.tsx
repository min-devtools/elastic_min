import { useEffect } from "react";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function restoreLayoutSizes() {
  const left = Number(localStorage.getItem("elasticmin:left-w"));
  const right = Number(localStorage.getItem("elasticmin:right-w"));
  const queryTop = Number(localStorage.getItem("elasticmin:query-top"));
  if (left) document.body.style.setProperty("--left-w", `${left}px`);
  if (right) document.body.style.setProperty("--right-w", `${right}px`);
  if (queryTop) document.body.style.setProperty("--query-top", `${queryTop}px`);
}

export function startResize(
  event: React.PointerEvent,
  axis: "left" | "right" | "query",
) {
  event.preventDefault();
  const main = document.querySelector(".main");
  const query = document.querySelector(".query-view.active");
  const vertical = axis === "query";
  document.body.classList.add(vertical ? "resizing-y" : "resizing");
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  // delta-based: anchor to the pane's actual rendered height + pointer movement, so a
  // click with no drag doesn't snap --query-top to the pointer's absolute position
  const startY = event.clientY;
  const topPane = query?.firstElementChild as HTMLElement | undefined;
  const startTop = topPane ? topPane.getBoundingClientRect().height : 0;
  const move = (e: PointerEvent) => {
    if (axis === "left" && main) {
      const rect = main.getBoundingClientRect();
      const max = Math.min(430, rect.width - 760);
      const next = clamp(e.clientX - rect.left, 190, max);
      document.body.style.setProperty("--left-w", `${Math.round(next)}px`);
    }
    if (axis === "right" && main) {
      const rect = main.getBoundingClientRect();
      const max = Math.min(700, rect.width - 760);
      const next = clamp(rect.right - e.clientX, 260, max);
      document.body.style.setProperty("--right-w", `${Math.round(next)}px`);
    }
    if (axis === "query" && query && topPane) {
      const rect = query.getBoundingClientRect();
      const max = Math.max(300, rect.height - 190);
      const next = clamp(startTop + (e.clientY - startY), 240, max);
      document.body.style.setProperty("--query-top", `${Math.round(next)}px`);
    }
  };
  const stop = () => {
    document.body.classList.remove("resizing", "resizing-y");
    window.removeEventListener("pointermove", move);
    // persist once at drag end — sync localStorage writes at 60-120Hz stutter the drag
    const persist = (key: string, cssVar: string) => {
      const v = parseInt(document.body.style.getPropertyValue(cssVar), 10);
      if (v) localStorage.setItem(key, String(v));
    };
    if (axis === "left") persist("elasticmin:left-w", "--left-w");
    if (axis === "right") persist("elasticmin:right-w", "--right-w");
    if (axis === "query") persist("elasticmin:query-top", "--query-top");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop, { once: true });
}

export function PanelResizeHandles() {
  useEffect(() => {
    restoreLayoutSizes();
  }, []);
  return (
    <>
      <div
        className="resize-handle vertical left"
        title="Resize left sidebar"
        aria-label="Resize left sidebar"
        onPointerDown={(e) => startResize(e, "left")}
      />
      <div
        className="resize-handle vertical right"
        title="Resize right inspector"
        aria-label="Resize right inspector"
        onPointerDown={(e) => startResize(e, "right")}
      />
    </>
  );
}
