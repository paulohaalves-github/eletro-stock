import Link from "next/link";
import { getProductsByIds } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet } from "@/components/price-tag";

export default async function BatchLabelsPage({ searchParams }) {
  const params = await searchParams;
  const ids = String(params.ids || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  const products = await getProductsByIds(ids);
  const printedAt = new Date();

  if (!products.length) {
    return (
      <div className="label-print-toolbar">
        <p>Nenhum produto selecionado para impressão.</p>
        <Link href="/estoque" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Voltar ao estoque
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="label-print-toolbar no-print">
        <p>
          {products.length} etiqueta(s) de 9 × 4,5 cm. Na impressora, escolha papel <strong>90 × 45 mm</strong> e desative cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={products} printedAt={printedAt} />
    </>
  );
}
