"use client";

import { useEffect, useRef } from "react";
import {
  LABEL_02_CM,
  LABEL_02_PX,
  chunkPairs,
  drawModelo2Label,
  loadLabelLogo,
  printModelo2Labels,
} from "@/lib/label-modelo-2";

function LabelCanvas({ product }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !product) return;
    let cancelled = false;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    loadLabelLogo().then((logo) => {
      if (cancelled) return;
      drawModelo2Label(ctx, product, LABEL_02_PX.width, LABEL_02_PX.height, logo);
    });

    return () => {
      cancelled = true;
    };
  }, [product]);

  return (
    <canvas
      ref={ref}
      className="price-tag--modelo-2-canvas"
      width={LABEL_02_PX.width}
      height={LABEL_02_PX.height}
      style={{
        width: `${LABEL_02_CM.width}cm`,
        height: `${LABEL_02_CM.height}cm`,
        display: "block",
        background: "#fff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
      aria-label="Prévia da etiqueta"
    />
  );
}

export function Modelo2LabelSheet({ products, option }) {
  const rows = chunkPairs(products || []);

  async function handlePrint() {
    try {
      await printModelo2Labels(products);
    } catch (error) {
      window.alert(error.message || "Não foi possível abrir a impressão.");
    }
  }

  return (
    <>
      <div className="label-print-toolbar no-print">
        <div className="max-w-3xl text-sm leading-relaxed">
          <p className="font-semibold">
            {(products || []).length} etiqueta(s) · {option?.label} · 2 por linha
          </p>
          <p className="mt-1 text-muted">
            Cada etiqueta: <strong>{LABEL_02_CM.width} × {LABEL_02_CM.height} cm</strong>. Gap:{" "}
            <strong>{LABEL_02_CM.gap} cm</strong>. Página enviada:{" "}
            <strong>
              {LABEL_02_CM.pageWidth} × {LABEL_02_CM.height} cm
            </strong>
            .
          </p>
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            <strong>ZDesigner GC420t — obrigatório:</strong> em Opções → Tamanho, mude a{" "}
            <strong>Largura para 10,30 cm</strong> e mantenha a <strong>Altura em 2,50 cm</strong>.
            Com largura 5,00 cm a impressora comprime as 2 colunas e a etiqueta sai errada. Deixe
            “rotate 180°” desmarcado; se sair invertida, marque só no driver.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Imprimir
        </button>
      </div>

      <div className="price-tag-sheet price-tag-sheet--modelo-2 no-print">
        {rows.map((row, rowIndex) => (
          <div
            key={`preview-row-${rowIndex}`}
            className="price-tag-row"
            style={{
              display: "flex",
              width: `${LABEL_02_CM.pageWidth}cm`,
              height: `${LABEL_02_CM.height}cm`,
              gap: `${LABEL_02_CM.gap}cm`,
              marginBottom: "12px",
            }}
          >
            {row.map((product) => (
              <LabelCanvas key={product.id} product={product} />
            ))}
            {row.length === 1 ? (
              <div
                style={{
                  width: `${LABEL_02_CM.width}cm`,
                  height: `${LABEL_02_CM.height}cm`,
                  border: "1px dashed #ccc",
                }}
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
