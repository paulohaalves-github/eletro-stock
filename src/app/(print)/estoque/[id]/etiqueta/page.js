import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { assertCanViewProduct, getProduct } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet, toModelo2Product } from "@/components/price-tag";
import { Modelo2LabelSheet } from "@/components/modelo-2-label-sheet";
import { LABEL_MODELS, LABEL_MODEL_OPTIONS, resolveLabelModel } from "@/lib/constants";

export default async function ProductLabelPage({ params, searchParams }) {
  const session = await getSession();
  if (!session) notFound();
  const { id } = await params;
  const query = await searchParams;
  const model = resolveLabelModel(query?.modelo);
  const option = LABEL_MODEL_OPTIONS.find((item) => item.id === model);
  let product;
  try {
    product = await getProduct(id);
    assertCanViewProduct(session, product);
  } catch {
    notFound();
  }

  const printedAt = new Date();

  if (model === LABEL_MODELS.PRECOS_02) {
    return (
      <Modelo2LabelSheet
        products={[toModelo2Product(product)]}
        option={option}
      />
    );
  }

  return (
    <>
      <div className="label-print-toolbar no-print">
        <p>
          {option?.label}. {option?.description}. Na impressora, escolha papel <strong>90 × 45 mm</strong> e desative
          cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={[product]} printedAt={printedAt} model={model} />
    </>
  );
}
