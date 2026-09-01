"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Card, PageHeader, Select } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

const TYPES = [
  { id: "stock", label: "Estoque atual" },
  { id: "entries", label: "Entradas por período" },
  { id: "exits", label: "Saídas por período" },
  { id: "sold", label: "Produtos vendidos" },
  { id: "condition", label: "Produtos por condição" },
  { id: "category", label: "Produtos por categoria" },
  { id: "value", label: "Valor total do estoque" },
  { id: "movements", label: "Histórico de movimentações" },
];

export default function RelatoriosPage() {
  const [type, setType] = useState("stock");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);

  function query(format) {
    const params = new URLSearchParams({ type, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }

  useEffect(() => {
    const params = new URLSearchParams({ type, format: "json" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    api(`/api/reports?${params}`).then(setReport);
  }, [type, from, to]);

  async function download(format) {
    const response = await fetch(`/api/reports?${query(format)}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}.${format === "xlsx" ? "xlsx" : "csv"}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Exporte o estoque e o histórico para Excel, CSV ou PDF (impressão)."
        actions={
          <>
            <Button variant="secondary" onClick={() => download("csv")}>CSV</Button>
            <Button variant="secondary" onClick={() => download("xlsx")}>Excel</Button>
            <Button variant="secondary" onClick={() => window.print()}>PDF / Imprimir</Button>
          </>
        }
      />
      <Card className="mb-4 grid gap-2 sm:grid-cols-3">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-border bg-bg px-3 py-2.5 text-sm" />
      </Card>
      {report ? (
        <Card className="overflow-x-auto">
          <h2 className="mb-3 text-lg font-semibold">{report.title}</h2>
          {report.summary ? (
            <p className="mb-3 text-sm text-muted">
              {report.summary.count} itens · à vista {formatCurrency(report.summary.cash)} · parcelado {formatCurrency(report.summary.installment)} · mercado {formatCurrency(report.summary.market)}
            </p>
          ) : null}
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                {report.columns.map((col) => <th key={col} className="px-2 py-2">{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2">{String(cell ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
