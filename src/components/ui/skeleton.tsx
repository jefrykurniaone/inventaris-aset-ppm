import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * shadcn's standard placeholder block, for route-level loading skeletons
 * (ticket #84). `bg-muted` is the same token `DashboardBarChart`'s decorative
 * progress track already uses for a shape that carries no text — it needs no
 * new contrast assertion in `color-contrast.test.ts` beyond that precedent —
 * and `animate-pulse` is a built-in Tailwind utility, so the shimmer needs no
 * keyframes of its own.
 */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
