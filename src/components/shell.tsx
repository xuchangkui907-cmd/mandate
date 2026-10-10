import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/console", label: "Console" },
  { to: "/architecture", label: "Architecture" },
  { to: "/submit", label: "Submission" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-fg no-underline">
            <span className="flex size-7 items-center justify-center rounded-sm border border-border-strong font-display text-sm tracking-tight">
              M
            </span>
            <span className="font-display text-lg tracking-tight">Mandate</span>
            <span className="hidden text-xs uppercase tracking-[0.16em] text-subtle sm:inline">Tempo</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm no-underline transition-colors duration-150",
                    active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
