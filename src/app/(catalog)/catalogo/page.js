import { CatalogFilters, CatalogFooter, CatalogShell, OfflineNotice, ProductGrid } from "@/components/catalog-public";
import { getPublicCatalog } from "@/lib/services/public-catalog";

function one(value) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

export default async function CatalogPage({ searchParams }) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    categoria: one(params.categoria),
    unidade: one(params.unidade),
  };
  const catalog = await getPublicCatalog(filters);

  return (
    <CatalogShell>
      {catalog.online ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produtos disponíveis</h1>
            <p className="mt-1 text-sm text-muted">
              {catalog.total === 1 ? "1 unidade em estoque." : `${catalog.total} unidades em estoque.`}
            </p>
          </div>
          <CatalogFilters catalog={catalog} filters={filters} />
          <ProductGrid items={catalog.items} filtered={Boolean(filters.q || filters.categoria || filters.unidade)} />
        </div>
      ) : (
        <OfflineNotice message={catalog.offlineMessage} />
      )}
      {catalog.online ? <CatalogFooter catalog={catalog} /> : null}
    </CatalogShell>
  );
}
