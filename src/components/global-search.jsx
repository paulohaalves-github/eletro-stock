"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { formatCurrency, formatProductId } from "@/lib/format";
import { ConditionBadge, StatusBadge } from "./badges";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setItems([]);
        return;
      }
      try {
        const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
        setItems(data.items || []);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const onClick = (event) => {
      if (!boxRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && query.trim()) {
            router.push(`/estoque?q=${encodeURIComponent(query.trim())}`);
            setOpen(false);
          }
        }}
        placeholder="Buscar ID, Serial Onyx, EAN, model code, TV 55..."
        className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && items.length > 0 ? (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/estoque/${item.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2"
            >
              <img
                src={item.primaryImage?.fileUrl || "/logo.svg"}
                alt=""
                className="h-10 w-10 rounded-lg object-cover bg-surface-2"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {formatProductId(item.id)} · {item.commercialName || item.supplierModelCode || item.serialOnyx}
                </p>
                <p className="truncate text-xs text-muted">
                  {item.serialOnyx || "s/ serial"} · {formatCurrency(item.cashPrice)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={item.status} />
                <ConditionBadge condition={item.condition} />
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
