"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

/** The nearest ancestor that scrolls, so the prefetch margin applies to it (null: the window). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Put after a paged list: loads the next page when the user scrolls near the end,
 * one page at a time. A new observer is made once each page lands, so a list that
 * is still shorter than the screen keeps loading until it fills it.
 */
export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onLoadMoreRef.current();
        }
      },
      { root: scrollParent(el), rootMargin: "0px 0px 800px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex h-16 items-center justify-center" aria-live="polite">
      {loading && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t.common.loading}
        </span>
      )}
    </div>
  );
}
