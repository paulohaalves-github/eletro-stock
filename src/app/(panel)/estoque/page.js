"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { CONDITION_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatProductId } from "@/lib/format";
import { ScanField } from "@/components/scan-field";

function EstoqueContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState("table");
  const [data, setData] = useState({ items: [], total: 0 });
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [filters, setFilters] = useState({
    categoryId: "",
    condition: "",
    status: "",
    minPrice: "",
    maxPrice: "",
    from: "",
    to: "",
  });

  const query = useMemo(() => {
    const search = new URLSearchParams({ q, view, pageSize: "40", ...filters });
    for (const [key, value] of search.entries()) {
      if (!value) search.delete(key);
    }
    return search.toString();
  }, [q, view, filters]);

  useEffect(() => {
    api("/api/categories").then((res) => setCategories(res.items || []));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      api(`/api/products?${query}`).then(setData);
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle={`${data.total} unidade(s) rastreadas`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setView(view === "table" ? "cards" : "table")}>
              {view === "table" ? "Ver cards" : "Ver tabela"}
            </Button>
            <Link href="/entrada">
              <Button>Nova entrada</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4 space-y-3">
        <ScanField
          value={q}
          onChange={setQ}
          onScan={(parsed) => {
            setQ(parsed.query);
            router.push(`/estoque?q=${encodeURIComponent(parsed.query)}`);
          }}
          placeholder="ID, Serial Onyx, EAN, model code, categoria..."
        />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}>
            <option value="">Categoria</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </Select>
          <Select value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })}>
            <option value="">Condição</option>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Status</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Input placeholder="Preço mín." value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} />
          <Input placeholder="Preço máx." value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
          <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
      </Card>

      {view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <Link key={item.id} href={`/estoque/${item.id}`} className="card overflow-hidden hover:border-accent/50">
              <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-40 w-full object-cover bg-surface-2" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm text-accent">{formatProductId(item.id)}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="font-medium">{item.commercialName || item.supplierModelCode || item.category?.name}</p>
                <p className="text-xs text-muted">{item.serialOnyx} · {item.category?.name}</p>
                <div className="flex items-center justify-between">
                  <ConditionBadge condition={item.condition} />
                  <span className="text-sm font-semibold">{formatCurrency(item.cashPrice)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                {["Foto", "ID", "Serial Onyx", "Nome comercial", "Categoria", "Model Code", "EAN", "Capacidade", "Condição", "À vista", "Parcelado", "Status", "Entrada"].map((col) => (
                  <th key={col} className="px-3 py-3 font-semibold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => router.push(`/estoque/${item.id}`)}>
                  <td className="px-3 py-2">
                    <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  </td>
                  <td className="px-3 py-2 font-mono text-accent">{formatProductId(item.id)}</td>
                  <td className="px-3 py-2">{item.serialOnyx || "—"}</td>
                  <td className="px-3 py-2">{item.commercialName || "—"}</td>
                  <td className="px-3 py-2">{item.category?.name}</td>
                  <td className="px-3 py-2">{item.supplierModelCode || "—"}</td>
                  <td className="px-3 py-2">{item.ean || "—"}</td>
                  <td className="px-3 py-2">{item.capacitySizeType || "—"}</td>
                  <td className="px-3 py-2"><ConditionBadge condition={item.condition} /></td>
                  <td className="px-3 py-2">{formatCurrency(item.cashPrice)}</td>
                  <td className="px-3 py-2">{formatCurrency(item.installmentPrice)}</td>
                  <td className="px-3 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-3 py-2">{formatDate(item.entryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function EstoquePage() {
  return (
    <Suspense>
      <EstoqueContent />
    </Suspense>
  );
}
