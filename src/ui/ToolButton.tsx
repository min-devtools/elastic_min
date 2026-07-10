import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger";
}

export function ToolButton({ variant = "default", className = "", ...rest }: Props) {
  const cls = ["tool-btn", variant !== "default" ? variant : "", className]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={cls} {...rest} />;
}
