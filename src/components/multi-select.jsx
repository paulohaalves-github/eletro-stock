"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { parseFilterList, toggleFilterValue } from "@/lib/filter-list";
import { cn } from "@/lib/format";

export function MultiSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "Selecionar",
  disabled = false,
  emptyLabel,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = parseFilterList(value);
  const selectedSet = new Set(selected);
  const labels = options.filter((item) => selectedSet.has(String(item.value))).map((item) => item.label);
  const summary = !labels.length
    ? placeholder
    : labels.length === 1
      ? labels[0]
      : `${labels[0]} +${labels.length - 1}`;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-left text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50",
          labels.length ? "text-text" : "text-muted/70",
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-surface-2"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {emptyLabel || placeholder}
          </button>
          {options.map((item) => {
            const key = String(item.value);
            const checked = selectedSet.has(key);
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(toggleFilterValue(value, key))}
                />
                <span className="min-w-0 truncate">{item.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
