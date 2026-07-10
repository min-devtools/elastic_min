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
  const move = (e: PointerEvent) => {
    if (axis === "left" && main) {
      const rect = main.getBoundingClientRect();
      const max = Math.min(430, rect.width - 760);
      const next = clamp(e.clientX - rect.left, 190, max);
      document.body.style.setProperty("--left-w", `${Math.round(next)}px`);
      localStorage.setItem("elasticmin:left-w", String(Math.round(next)));
    }
    if (axis === "right" && main) {
      const rect = main.getBoundingClientRect();
      const max = Math.min(700, rect.width - 760);
      const next = clamp(rect.right - e.clientX, 260, max);
      document.body.style.setProperty("--right-w", `${Math.round(next)}px`);
      localStorage.setItem("elasticmin:right-w", String(Math.round(next)));
    }
    if (axis === "query" && query) {
      const rect = query.getBoundingClientRect();
      const max = Math.max(300, rect.height - 190);
      const next = clamp(e.clientY - rect.top, 240, max);
      document.body.style.setProperty("--query-top", `${Math.round(next)}px`);
      localStorage.setItem("elasticmin:query-top", String(Math.round(next)));
    }
  };
  const stop = () => {
    document.body.classList.remove("resizing", "resizing-y");
    window.removeEventListener("pointermove", move);
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
