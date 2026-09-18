"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/format";

export function ActionMenu({ items = [], label = "Ações" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const visible = items.filter(Boolean);

  useEffect(() => {
    if (!open) return undefined;
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        {label}
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-2",
                item.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
