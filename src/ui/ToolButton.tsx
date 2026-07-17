import { forwardRef, type ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
  iconOnly?: boolean;
}

export const ToolButton = forwardRef<HTMLButtonElement, Props>(function ToolButton(
  { variant = "default", iconOnly = false, className = "", ...rest },
  ref,
) {
  const cls = ["tool-btn", variant !== "default" ? variant : "", iconOnly ? "icon-only" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button ref={ref} type="button" className={cls} {...rest} />;
});
