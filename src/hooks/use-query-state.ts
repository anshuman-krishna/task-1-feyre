"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

// thin url-state hook. read/write a single search param without rerender storms.
export function useQueryState(key: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const value = params.get(key) ?? "";

  const set = useCallback(
    (next: string | null) => {
      const p = new URLSearchParams(params.toString());
      if (next == null || next === "") p.delete(key);
      else p.set(key, next);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, pathname, params, router],
  );

  return [value, set] as const;
}
