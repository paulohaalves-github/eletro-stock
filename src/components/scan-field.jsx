"use client";

import { useEffect, useRef, useState } from "react";
import { createScannerAdapter, parseQrPayload } from "@/lib/scanner";
import { Input } from "./ui";

export function ScanField({ value, onChange, onScan, placeholder = "Digite ou leia o código", autoFocus = false, refocusKey = 0, disabled = false }) {
  const inputRef = useRef(null);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (autoFocus && !disabled) inputRef.current?.focus();
  }, [autoFocus, refocusKey, disabled]);

  function submit(raw) {
    const parsed = parseQrPayload(raw);
    setHint(parsed.type !== "UNKNOWN" ? `Tipo detectado: ${parsed.type}` : "");
    onScan?.(parsed);
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit(value);
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          className="rounded-xl border border-border px-3 text-sm font-semibold text-accent hover:bg-surface-2 disabled:opacity-50"
          onClick={() => {
            const adapter = createScannerAdapter({
              onScan: (parsed) => {
                onChange(parsed.query ?? parsed.raw ?? "");
                onScan?.(parsed);
              },
              onError: () => {
                setHint("Câmera de código pronta para evolução. Use o leitor USB ou digite o código.");
                inputRef.current?.focus();
              },
            });
            adapter.start();
            if (value) submit(value);
          }}
        >
          Ler
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
