import { notFound } from "next/navigation";
import { CatalogFooter, CatalogShell, OfflineNotice, ProductDetail } from "@/components/catalog-public";
import { getPublicCatalogItem } from "@/lib/services/public-catalog";

export default async function CatalogItemPage({ params }) {
  const { key } = await params;
  const catalog = await getPublicCatalogItem(key);
  if (!catalog.online) {
    return (
      <CatalogShell>
        <OfflineNotice message={catalog.offlineMessage} />
      </CatalogShell>
    );
  }
  if (!catalog.item) notFound();

  return (
    <CatalogShell>
      <ProductDetail item={catalog.item} />
      <CatalogFooter catalog={catalog} />
    </CatalogShell>
  );
}
