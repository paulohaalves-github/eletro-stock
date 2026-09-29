import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { whatsAppHref } from "@/lib/services/public-catalog";

function priceText(from, to) {
  if (!(from > 0)) return "Consulte";
  const value = formatCurrency(from);
  return to > from ? `A partir de ${value}` : value;
}

function countText(count) {
  return count === 1 ? "1 disponível" : `${count} disponíveis`;
}

export function CatalogShell({ children }) {
  return (
    <div className="catalog-root">
      <header className="bg-[#1e3a8a] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/catalogo" className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Eletromall Outlet</p>
            <p className="truncate text-lg font-semibold">Catálogo de produtos</p>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function OfflineNotice({ message }) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <p className="text-lg font-semibold">Catálogo fora do ar</p>
      <p className="mt-3 text-sm leading-6 text-muted">{message || "Catálogo temporariamente indisponível."}</p>
    </section>
  );
}

export function CatalogFilters({ catalog, filters }) {
  return (
    <form method="get" action="/catalogo" className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_180px_180px_auto]">
      <input
        name="q"
        defaultValue={filters.q}
        placeholder="Buscar produto"
        className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />
      <select name="categoria" defaultValue={filters.categoria} className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none">
        <option value="">Todas as categorias</option>
        {catalog.categories.map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
      <select name="unidade" defaultValue={filters.unidade} className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none">
        <option value="">Todas as lojas</option>
        {catalog.stockedStores.map((store) => (
          <option key={store.id} value={store.id}>{store.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" className="rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white">Buscar</button>
        {filters.q || filters.categoria || filters.unidade ? (
          <Link href="/catalogo" className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted">Limpar</Link>
        ) : null}
      </div>
    </form>
  );
}

function ProductCard({ item }) {
  return (
    <Link href={`/catalogo/item/${item.key}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:-translate-y-0.5 hover:border-[#1e3a8a]/40">
      <div className="flex h-48 items-center justify-center bg-white">
        {item.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/catalog/media/${item.imageId}`} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">Sem foto</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {item.categoryName ? <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">{item.categoryName}</p> : null}
        <h2 className="text-base font-semibold leading-snug">{item.name}</h2>
        <p className="text-sm text-muted">
          {[item.voltageLabel, item.conditionLabel, countText(item.count)].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-auto pt-2 text-lg font-semibold">{priceText(item.cashFrom, item.cashTo)}</p>
        {item.installmentFrom > 0 ? (
          <p className="text-sm text-muted">Parcelado {priceText(item.installmentFrom, item.installmentTo).replace("A partir de ", "a partir de ")}</p>
        ) : null}
        <p className="text-xs text-muted">{item.units.map((unit) => unit.name).join(" · ")}</p>
      </div>
    </Link>
  );
}

export function ProductGrid({ items, filtered }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted">
        {filtered ? "Nenhum produto disponível com esses filtros." : "Nenhum produto disponível no momento."}
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => <ProductCard key={item.key} item={item} />)}
    </div>
  );
}

export function CatalogFooter({ catalog }) {
  return (
    <footer className="mt-12 grid gap-8 border-t border-border pt-8 lg:grid-cols-3">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Retirada</h2>
        <p className="mt-2 text-sm leading-6">{catalog.pickupNote || "Os produtos devem ser retirados na loja."}</p>
      </section>
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pagamento</h2>
        {catalog.payments.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {catalog.payments.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">Consulte a loja.</p>}
      </section>
      <section className="lg:col-span-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Lojas</h2>
        <div className="mt-2 space-y-4">
          {catalog.stores.map((store) => <StoreContact key={store.id} store={store} />)}
          {!catalog.stores.length ? <p className="text-sm text-muted">Nenhuma loja publicada no catálogo.</p> : null}
        </div>
      </section>
    </footer>
  );
}

function StoreContact({ store, interest }) {
  const whatsapp = whatsAppHref(store.whatsapp || store.phone, interest);
  return (
    <article className="text-sm leading-6">
      <p className="font-semibold">{store.name}</p>
      {store.address ? <p className="text-muted">{store.address}</p> : null}
      {store.phone ? <p><a className="text-[#1e3a8a] hover:underline" href={`tel:${store.phone}`}>{store.phone}</a></p> : null}
      {store.phoneSecondary ? <p><a className="text-[#1e3a8a] hover:underline" href={`tel:${store.phoneSecondary}`}>{store.phoneSecondary}</a></p> : null}
      {store.email ? <p><a className="text-[#1e3a8a] hover:underline" href={`mailto:${store.email}`}>{store.email}</a></p> : null}
      {store.mapsUrl ? <p><a className="font-medium text-[#1e3a8a] hover:underline" href={store.mapsUrl} target="_blank" rel="noreferrer">Ver no mapa</a></p> : null}
      {whatsapp ? (
        <p className="mt-2">
          <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[#128C7E] px-3 py-1.5 text-xs font-semibold text-white">
            Pedir no WhatsApp
          </a>
        </p>
      ) : null}
    </article>
  );
}

export function ProductDetail({ item }) {
  const interest = `Olá, tenho interesse em ${item.name}${item.voltageLabel ? ` ${item.voltageLabel}` : ""}${item.conditionLabel ? `, ${item.conditionLabel}` : ""}.`;
  return (
    <article className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-white">
        {item.imageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/catalog/media/${item.imageId}`} alt="" className="max-h-[28rem] w-full object-contain" />
        ) : (
          <span className="text-sm text-muted">Sem foto</span>
        )}
      </div>
      <div>
        <Link href="/catalogo" className="text-sm font-medium text-[#1e3a8a] hover:underline">Voltar ao catálogo</Link>
        {item.categoryName ? <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">{item.categoryName}</p> : null}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{item.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {[item.voltageLabel, item.conditionLabel, countText(item.count)].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-4 text-2xl font-semibold">{priceText(item.cashFrom, item.cashTo)}</p>
        {item.installmentFrom > 0 ? (
          <p className="text-sm text-muted">Parcelado {priceText(item.installmentFrom, item.installmentTo).replace("A partir de ", "a partir de ")}</p>
        ) : null}
        <div className="mt-6 space-y-3">
          {item.units.map((unit) => (
            <section key={unit.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">{unit.name}</h2>
                <p className="text-sm text-muted">{countText(unit.count)}</p>
              </div>
              <p className="mt-1 text-sm">{priceText(unit.cashFrom, unit.cashTo)}{unit.installmentFrom > 0 ? ` · parcelado ${priceText(unit.installmentFrom, unit.installmentTo).replace("A partir de ", "a partir de ")}` : ""}</p>
              <div className="mt-3">
                <StoreContact store={unit} interest={`${interest} Loja: ${unit.name}.`} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
