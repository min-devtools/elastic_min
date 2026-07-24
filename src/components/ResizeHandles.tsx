import { useEffect } from "react";
import { useApp } from "../store";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function restoreLayoutSizes() {
  const left = Number(localStorage.getItem("elasticmin:left-w"));
  const right = Number(localStorage.getItem("elasticmin:right-w"));
  const queryTop = Number(localStorage.getItem("elasticmin:query-top"));
  if (left) document.body.style.setProperty("--left-w", `${Math.max(left, 298)}px`);
  if (right) document.body.style.setProperty("--right-w", `${Math.max(right, 406)}px`);
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
  const handleEl = event.currentTarget as HTMLElement;
  const pointerId = event.pointerId;
  handleEl.setPointerCapture?.(pointerId);
  // delta-based: anchor to the pane's actual rendered height + pointer movement, so a
  // click with no drag doesn't snap --query-top to the pointer's absolute position
  const startY = event.clientY;
  const topPane = query?.firstElementChild as HTMLElement | undefined;
  const startTop = topPane ? topPane.getBoundingClientRect().height : 0;

  const move = (e: PointerEvent) => {
    if (axis === "left" && main) {
      const rect = main.getBoundingClientRect();
      const raw = e.clientX - rect.left;
      const overshoot = 298 - raw;
      if (overshoot >= 150) {
        stop();
        useApp.setState({ leftCollapsed: true });
        return;
      }
      // narrow window can push rect.width - 760 below the min — keep max ≥ min
      const max = Math.max(298, Math.min(430, rect.width - 760));
      const next = clamp(raw, 298, max);
      document.body.style.setProperty("--left-w", `${Math.round(next)}px`);
    }
    if (axis === "right" && main) {
      const rect = main.getBoundingClientRect();
      const raw = rect.right - e.clientX;
      const overshoot = 406 - raw;
      if (overshoot >= 150) {
        stop();
        useApp.setState({ rightCollapsed: true });
        return;
      }
      const max = Math.max(406, Math.min(700, rect.width - 760));
      const next = clamp(raw, 406, max);
      document.body.style.setProperty("--right-w", `${Math.round(next)}px`);
    }
    if (axis === "query" && query && topPane) {
      const rect = query.getBoundingClientRect();
      const max = Math.max(300, rect.height - 190);
      const next = clamp(startTop + (e.clientY - startY), 60, max);
      document.body.style.setProperty("--query-top", `${Math.round(next)}px`);
    }
  };
  const stop = () => {
    document.body.classList.remove("resizing", "resizing-y", "resizing-x");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
    try {
      if (handleEl.hasPointerCapture?.(pointerId)) {
        handleEl.releasePointerCapture(pointerId);
      }
    } catch {}
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
  window.addEventListener("pointercancel", stop, { once: true });
}

export function toggleQueryExpand() {
  const query = document.querySelector(".query-view.active");
  const topPane = query?.firstElementChild as HTMLElement | undefined;
  if (!topPane) return;
  const currentHeight = topPane.getBoundingClientRect().height;
  if (currentHeight <= 100) {
    const last = Number(localStorage.getItem("elasticmin:last-query-top")) || 340;
    const target = Math.max(240, last);
    document.body.style.setProperty("--query-top", `${target}px`);
    localStorage.setItem("elasticmin:query-top", String(target));
  } else {
    localStorage.setItem("elasticmin:last-query-top", String(Math.round(currentHeight)));
    document.body.style.setProperty("--query-top", "60px");
    localStorage.setItem("elasticmin:query-top", "60px");
  }
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
