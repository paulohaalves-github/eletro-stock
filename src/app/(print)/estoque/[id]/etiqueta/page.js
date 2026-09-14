import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { assertCanViewProduct, getProduct } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet } from "@/components/price-tag";
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
  const paperHint = model === LABEL_MODELS.PRECOS_02
    ? <>papel <strong>50 × 25 mm</strong></>
    : <>papel <strong>90 × 45 mm</strong></>;

  return (
    <>
      <div className="label-print-toolbar no-print">
        <p>
          {option?.label}. {option?.description}. Na impressora, escolha {paperHint} e desative cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={[product]} printedAt={printedAt} model={model} />
    </>
  );
}
