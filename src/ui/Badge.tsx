import type { CSSProperties, ReactNode } from "react";

export function Badge({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="badge" style={style}>{children}</span>;
}
