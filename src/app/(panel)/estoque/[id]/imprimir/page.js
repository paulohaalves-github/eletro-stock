import { getSession } from "@/lib/auth";
import { getProduct } from "@/lib/services/products";
import { CONDITION_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatProductId } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { redirect } from "next/navigation";

export default async function PrintPage({ params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const product = await getProduct(id);

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-900 print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>
      <header className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Eletromall" className="h-12 w-12" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Eletromall</p>
            <h1 className="text-2xl font-semibold">Eletro-Stock</h1>
          </div>
        </div>
        <p className="font-mono text-xl">{formatProductId(product.id)}</p>
      </header>
      <div className="mt-6 grid grid-cols-[180px_1fr] gap-6">
        <img src={product.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-44 w-full rounded-lg object-cover border" />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Item label="Serial Onyx" value={product.serialOnyx} />
          <Item label="Nome comercial" value={product.commercialName} />
          <Item label="Model Code" value={product.supplierModelCode} />
          <Item label="EAN" value={product.ean} />
          <Item label="Categoria" value={product.category?.name} />
          <Item label="Condição" value={CONDITION_LABELS[product.condition]} />
          <Item label="Status" value={STATUS_LABELS[product.status]} />
          <Item label="Data de entrada" value={formatDateTime(product.entryDate)} />
          <Item label="Capacidade" value={product.capacitySizeType} />
        </dl>
      </div>
      <section className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Mercado</p><p className="text-lg font-semibold">{formatCurrency(product.marketPrice)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">À vista</p><p className="text-lg font-semibold">{formatCurrency(product.cashPrice)}</p></div>
        <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Parcelado</p><p className="text-lg font-semibold">{formatCurrency(product.installmentPrice)}</p></div>
      </section>
      <section className="mt-6 text-sm">
        <h2 className="font-semibold">Descrição</h2>
        <p className="mt-1">{product.description || "—"}</p>
        {product.damageDescription ? (
          <>
            <h2 className="mt-4 font-semibold">Avarias</h2>
            <p className="mt-1">{product.damageDescription}</p>
          </>
        ) : null}
      </section>
      <p className="mt-10 text-xs text-slate-500">
        Ficha individual para rastreabilidade. Arquitetura preparada para etiquetas com QR Code no futuro.
      </p>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
