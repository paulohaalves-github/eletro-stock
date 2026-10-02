import Link from "next/link";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { CatalogHighlights } from "@/components/catalog-highlights";
import { formatCurrency } from "@/lib/format";
import { whatsAppHref } from "@/lib/services/public-catalog";

const PAYMENT_ICONS = {
  cash: Banknote,
  card: CreditCard,
  pix: QrCode,
};

function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44zM12.07 21.15h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.64-.24-.38a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.09 3.2 5.07 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}

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
    <footer className="mt-12 space-y-8">
      <CatalogHighlights />
      <div className="grid gap-8 border-t border-border pt-8 lg:grid-cols-3">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Retirada</h2>
          <p className="mt-2 text-sm leading-6">{catalog.pickupNote || "Os produtos devem ser retirados na loja."}</p>
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Pagamento</h2>
          {catalog.payments.length ? (
            <ul className="mt-3 space-y-3 text-sm">
              {catalog.payments.map((item) => {
                const Icon = PAYMENT_ICONS[item.id] || CreditCard;
                return (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#1e3a8a]" />
                    <span>
                      <span className="font-medium">{item.label}</span>
                      {item.note ? <span className="mt-0.5 block text-xs text-[#1e3a8a]">{item.note}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">Consulte a loja.</p>}
        </section>
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Lojas</h2>
          <div className="mt-2 space-y-4">
            {catalog.stores.map((store) => <StoreContact key={store.id} store={store} />)}
            {!catalog.stores.length ? <p className="text-sm text-muted">Nenhuma loja publicada no catálogo.</p> : null}
          </div>
        </section>
      </div>
    </footer>
  );
}

function StoreContact({ store, interest, showName = true }) {
  const whatsapp = whatsAppHref(store.whatsapp || store.phone, interest);
  return (
    <article className="text-sm leading-6">
      {showName ? <p className="font-semibold">{store.name}</p> : null}
      {store.address ? <p className="text-muted">{store.address}</p> : null}
      {store.phone ? <p><a className="text-[#1e3a8a] hover:underline" href={`tel:${store.phone}`}>{store.phone}</a></p> : null}
      {store.phoneSecondary ? <p><a className="text-[#1e3a8a] hover:underline" href={`tel:${store.phoneSecondary}`}>{store.phoneSecondary}</a></p> : null}
      {store.email ? <p><a className="text-[#1e3a8a] hover:underline" href={`mailto:${store.email}`}>{store.email}</a></p> : null}
      {store.mapsUrl ? <p><a className="font-medium text-[#1e3a8a] hover:underline" href={store.mapsUrl} target="_blank" rel="noreferrer">Ver no mapa</a></p> : null}
      {whatsapp ? (
        <p className="mt-2">
          <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#128C7E] px-3 py-1.5 text-xs font-semibold text-white">
            <WhatsAppIcon className="h-3.5 w-3.5" />
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
                <StoreContact store={unit} showName={false} interest={`${interest} Loja: ${unit.name}.`} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
