"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { LIST_PAGE_SIZE } from "@/lib/constants";

export function usePagedList() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const loaderRef = useRef(null);

  const run = useCallback(async (loader, pageNumber, { append = false } = {}) => {
    if (typeof loader !== "function") return null;
    loaderRef.current = loader;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await loader(pageNumber, LIST_PAGE_SIZE);
      const nextItems = result.items || [];
      setItems((current) => (append ? [...current, ...nextItems] : nextItems));
      setTotal(Number(result.total ?? nextItems.length));
      setPage(pageNumber);
      pageRef.current = pageNumber;
      return result;
    } catch (error) {
      toast.error(error.message);
      if (!append) {
        setItems([]);
        setTotal(0);
      }
      return null;
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const search = useCallback((loader) => run(loader, 1), [run]);
  const loadMore = useCallback(
    (loader) => run(loader || loaderRef.current, pageRef.current + 1, { append: true }),
    [run],
  );

  return {
    items,
    setItems,
    total,
    page,
    loading,
    loadingMore,
    hasMore: items.length < total,
    search,
    loadMore,
  };
}
