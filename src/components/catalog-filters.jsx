"use client";

import { useEffect, useRef, useState } from "react";
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
      className={`inline-flex shrink-0 items-center rounded-full border bg-white px-4 py-2 text-sm font-medium text-[#1d4ed8] transition ${
        active ? "border-[#1d4ed8] shadow-[0_0_0_1px_#1d4ed8]" : "border-slate-200 hover:border-[#1d4ed8]/40"
      }`}
    >
      {children}
    </Link>
  );
}

function ChipScroller({ label, children }) {
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    function update() {
      setEdges({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollBy(direction) {
    scroller.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {edges.left ? (
        <button
          type="button"
          aria-label={`${label} anteriores`}
          onClick={() => scrollBy(-1)}
          className="absolute top-1/2 left-0 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
        >
          ‹
        </button>
      ) : null}
      <div
        ref={scroller}
        className="flex gap-2 overflow-x-auto scroll-smooth px-10 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edges.right ? (
        <button
          type="button"
          aria-label={`Próximas ${label}`}
          onClick={() => scrollBy(1)}
          className="absolute top-1/2 right-0 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
        >
          ›
        </button>
      ) : null}
    </div>
  );
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
            className="w-full rounded-full border border-slate-200 bg-white py-3 pr-12 pl-5 text-sm outline-none placeholder:text-slate-400 focus:border-[#1d4ed8]"
          />
          <button
            type="submit"
            aria-label="Pesquisar"
            className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#1d4ed8]"
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

      <ChipScroller label="categorias">
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
      </ChipScroller>

      {catalog.stockedStores.length > 1 ? (
        <ChipScroller label="lojas">
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
        </ChipScroller>
      ) : null}
    </div>
  );
}
