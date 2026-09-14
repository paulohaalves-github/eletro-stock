import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getProductsByIds } from "@/lib/services/products";
import { PrintButton } from "@/components/print-button";
import { PriceTagSheet, toModelo2Product } from "@/components/price-tag";
import { Modelo2LabelSheet } from "@/components/modelo-2-label-sheet";
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

  if (model === LABEL_MODELS.PRECOS_02) {
    return (
      <Modelo2LabelSheet
        products={products.map(toModelo2Product)}
        option={option}
      />
    );
  }

  return (
    <>
      <div className="label-print-toolbar no-print">
        <p>
          {products.length} etiqueta(s) · {option?.label} ({option?.description}). Na impressora, escolha papel{" "}
          <strong>90 × 45 mm</strong> e desative cabeçalhos.
        </p>
        <PrintButton />
      </div>
      <PriceTagSheet products={products} printedAt={printedAt} model={model} />
    </>
  );
}
