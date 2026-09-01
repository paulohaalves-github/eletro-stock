"use client";

import { useRef, useState } from "react";
import { createScannerAdapter, detectCodeType } from "@/lib/scanner";
import { Input } from "./ui";

export function ScanField({ value, onChange, onScan, placeholder = "Digite ou leia o código" }) {
  const inputRef = useRef(null);
  const [hint, setHint] = useState("");

  function submit(raw) {
    const type = detectCodeType(raw);
    setHint(type !== "UNKNOWN" ? `Tipo detectado: ${type}` : "");
    onScan?.({ raw, type });
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
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
          className="rounded-xl border border-border px-3 text-sm font-semibold text-accent hover:bg-surface-2"
          onClick={() => {
            const adapter = createScannerAdapter({
              onScan: (parsed) => {
                onChange(parsed.query);
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
