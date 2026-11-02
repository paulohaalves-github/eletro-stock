"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";

function catalogHref({ q, categoria, unidade, fabricante, ordem }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (categoria) params.set("categoria", categoria);
  if (unidade) params.set("unidade", unidade);
  if (fabricante) params.set("fabricante", fabricante);
  if (ordem === "preco-desc") params.set("ordem", ordem);
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

function FilterSelect({ label, value, options, onChange, highlight }) {
  const active = highlight ?? Boolean(value);
  return (
    <label className="relative min-w-[10.5rem] flex-1 sm:max-w-[16rem]">
      <span className="sr-only">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full cursor-pointer appearance-none rounded-full border bg-white py-2.5 pr-10 pl-4 text-sm outline-none transition focus:border-[#0482a4] ${
          active ? "border-[#0482a4] font-medium text-[#0482a4]" : "border-slate-200 text-slate-600"
        }`}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
    </label>
  );
}

function ActiveChip({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#0482a4]/30 bg-[#0482a4]/5 px-3 py-1.5 text-sm font-medium text-[#0482a4] hover:bg-[#0482a4]/10"
    >
      {children}
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function CatalogFilters({ catalog, filters }) {
  const router = useRouter();
  const ordem = filters.ordem === "preco-desc" ? "preco-desc" : "preco-asc";
  const shared = {
    q: filters.q,
    categoria: filters.categoria,
    unidade: filters.unidade,
    fabricante: filters.fabricante,
    ordem,
  };
  const go = (patch) => router.push(catalogHref({ ...shared, ...patch }));

  const category = catalog.categories.find((item) => String(item.id) === filters.categoria);
  const manufacturer = catalog.manufacturers.find((item) => String(item.id) === filters.fabricante);
  const store = catalog.stockedStores.find((item) => String(item.id) === filters.unidade);
  const active = [filters.q, category, manufacturer, store].filter(Boolean);
  const clearFiltersHref = catalogHref({ q: filters.q, ordem });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form method="get" action="/catalogo" className="relative min-w-0 flex-1">
          {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
          {filters.fabricante ? <input type="hidden" name="fabricante" value={filters.fabricante} /> : null}
          {filters.unidade ? <input type="hidden" name="unidade" value={filters.unidade} /> : null}
          {ordem === "preco-desc" ? <input type="hidden" name="ordem" value="preco-desc" /> : null}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Pesquisar"
            className="w-full rounded-full border border-slate-200 bg-white py-3 pr-12 pl-5 text-sm outline-none placeholder:text-slate-400 focus:border-[#0482a4]"
          />
          <button
            type="submit"
            aria-label="Pesquisar"
            className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#0482a4]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        <FilterSelect
          label="Ordenar"
          value={ordem}
          highlight={false}
          onChange={(value) => go({ ordem: value })}
          options={[
            { value: "preco-asc", label: "Menor preço" },
            { value: "preco-desc", label: "Maior preço" },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {catalog.categories.length ? (
          <FilterSelect
            label="Categoria"
            value={filters.categoria}
            onChange={(value) => go({ categoria: value })}
            options={[
              { value: "", label: "Categoria" },
              ...catalog.categories.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        ) : null}
        {catalog.manufacturers.length ? (
          <FilterSelect
            label="Marca"
            value={filters.fabricante}
            onChange={(value) => go({ fabricante: value })}
            options={[
              { value: "", label: "Marca" },
              ...catalog.manufacturers.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        ) : null}
        {catalog.stockedStores.length > 1 ? (
          <FilterSelect
            label="Loja"
            value={filters.unidade}
            onChange={(value) => go({ unidade: value })}
            options={[
              { value: "", label: "Loja" },
              ...catalog.stockedStores.map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        ) : null}
      </div>

      {active.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {filters.q ? <ActiveChip href={catalogHref({ ...shared, q: "" })}>Busca: {filters.q}</ActiveChip> : null}
          {category ? <ActiveChip href={catalogHref({ ...shared, categoria: "" })}>{category.name}</ActiveChip> : null}
          {manufacturer ? <ActiveChip href={catalogHref({ ...shared, fabricante: "" })}>{manufacturer.name}</ActiveChip> : null}
          {store ? <ActiveChip href={catalogHref({ ...shared, unidade: "" })}>{store.name}</ActiveChip> : null}
          {active.length > 1 || category || manufacturer || store ? (
            <Link href={clearFiltersHref} className="text-sm font-medium text-slate-500 hover:text-[#0482a4]">
              Limpar filtros
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
