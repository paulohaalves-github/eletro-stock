import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getProductsByIds } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet } from "@/components/price-tag";
import { LABEL_MODELS, LABEL_MODEL_OPTIONS, resolveLabelModel } from "@/lib/constants";

export default async function BatchLabelsPage({ searchParams }) {
  const session = await getSession();
  const params = await searchParams;
  const model = resolveLabelModel(params?.modelo);
  const option = LABEL_MODEL_OPTIONS.find((item) => item.id === model);
  const ids = String(params.ids || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  const products = await getProductsByIds(ids, session);
  const printedAt = new Date();
  const paperHint = model === LABEL_MODELS.PRECOS_02
    ? <>papel <strong>103 × 25 mm</strong>, margens <strong>Nenhuma</strong>, escala <strong>100%</strong></>
    : <>papel <strong>90 × 45 mm</strong></>;

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
          {products.length} etiqueta(s) · {option?.label} ({option?.description}). Na impressora, escolha {paperHint} e desative cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={products} printedAt={printedAt} model={model} />
    </>
  );
}
