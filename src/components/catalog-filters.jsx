"use client";

import Link from "next/link";

function catalogHref({ q, categoria, unidade, ordem }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (categoria) params.set("categoria", categoria);
  if (unidade) params.set("unidade", unidade);
  if (ordem === "preco-desc") params.set("ordem", ordem);
  const query = params.toString();
  return query ? `/catalogo?${query}` : "/catalogo";
}

function Chip({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center rounded-full border bg-white px-4 py-2 text-sm font-medium text-[#0482a4] transition ${
        active ? "border-[#0482a4] shadow-[0_0_0_1px_#0482a4]" : "border-slate-200 hover:border-[#0482a4]/40"
      }`}
    >
      {children}
    </Link>
  );
}

function ChipRow({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function CatalogFilters({ catalog, filters }) {
  const ordem = filters.ordem === "preco-desc" ? "preco-desc" : "preco-asc";
  const nextOrder = ordem === "preco-desc" ? "preco-asc" : "preco-desc";
  const shared = { q: filters.q, unidade: filters.unidade, ordem };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form method="get" action="/catalogo" className="relative min-w-0 flex-1">
          {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
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
        <Link
          href={catalogHref({ ...shared, ordem: nextOrder, categoria: filters.categoria })}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M8 7h10M8 7l2.5-2.5M8 7l2.5 2.5M16 17H6M16 17l-2.5-2.5M16 17l-2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {ordem === "preco-desc" ? "Preço: Maior a Menor" : "Preço: Menor a Maior"}
        </Link>
      </div>

      <ChipRow>
        <Chip href={catalogHref({ ...shared, categoria: "" })} active={!filters.categoria}>Todos</Chip>
        {catalog.categories.map((category) => (
          <Chip
            key={category.id}
            href={catalogHref({ ...shared, categoria: String(category.id) })}
            active={filters.categoria === String(category.id)}
          >
            {category.name}
          </Chip>
        ))}
      </ChipRow>

      {catalog.stockedStores.length > 1 ? (
        <ChipRow>
          <Chip href={catalogHref({ ...shared, categoria: filters.categoria, unidade: "" })} active={!filters.unidade}>Todas as lojas</Chip>
          {catalog.stockedStores.map((store) => (
            <Chip
              key={store.id}
              href={catalogHref({ ...shared, categoria: filters.categoria, unidade: String(store.id) })}
              active={filters.unidade === String(store.id)}
            >
              {store.name}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
    </div>
  );
}
