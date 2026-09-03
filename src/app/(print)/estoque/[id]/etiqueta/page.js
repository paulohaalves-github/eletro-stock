import { notFound } from "next/navigation";
import { getProduct } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet } from "@/components/price-tag";

export default async function ProductLabelPage({ params }) {
  const { id } = await params;
  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  const printedAt = new Date();

  return (
    <>
      <div className="label-print-toolbar no-print">
        <p>
          Etiqueta 9 × 4,5 cm. Na impressora, escolha papel <strong>90 × 45 mm</strong> e desative cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={[product]} printedAt={printedAt} />
    </>
  );
}
