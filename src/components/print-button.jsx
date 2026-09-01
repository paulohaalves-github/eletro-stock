"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print rounded-lg bg-slate-900 px-4 py-2 text-white">
      Imprimir
    </button>
  );
}
