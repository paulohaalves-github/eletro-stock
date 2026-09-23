"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { ScanField } from "@/components/scan-field";
import { CLOSED_STATUSES, EXIT_REASONS, STOCK_EXIT_REASON_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, canAccessSaleOrderRecord, PERMISSIONS } from "@/lib/permissions";

function SaidaContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = usePagedList();
  const [product, setProduct] = useState(null);
  const [reason, setReason] = useState(EXIT_REASONS.RETURN);
  const [observation, setObservation] = useState("");
  const [me, setMe] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/auth/me").then((data) => setMe(data.user)).catch(() => {});
    const id = params.get("id");
    if (id) api(`/api/products/${id}`).then((data) => setProduct(data.product));
  }, [params]);

  async function searchProducts(text) {
    const value = text !== undefined ? text : query;
    if (text !== undefined) setQuery(text);
    if (!String(value || "").trim()) {
      results.setItems([]);
      return;
    }
    const loader = (page, pageSize) => api(`/api/search?${listQuery({ q: value }, page, pageSize)}`);
    await results.search(loader);
  }

  async function confirmExit() {
    setLoading(true);
    try {
      const data = await api("/api/stock/exit", {
        method: "POST",
          json: {
            productId: product.id,
            reason,
            observation,
          },
      });
      toast.success(data.message);
      setConfirmOpen(false);
      router.push(`/estoque/${product.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const commercialLock = Boolean(product?.openSaleOrder);
  const blocked = product && (["VENDIDO", "TRANSFERIDO", "DESCARTADO", "EM_TRANSITO", "EM_REPARO"].includes(product.status)
    || (CLOSED_STATUSES.includes(product.status) && product.status !== "DEVOLVIDO")
    || commercialLock);
  const saleIncomplete = reason === EXIT_REASONS.OTHER && !observation.trim();

  return (
    <div>
      <PageHeader title="Saída de estoque" subtitle="Baixa por devolução, avaria ou descarte. Venda de produto é feita em Comercial > Vendas." />
      <Card className="mb-4">
        <Field label="Localizar produto">
          <ScanField
            value={query}
            onChange={setQuery}
            onScan={(parsed) => void searchProducts(parsed.query ?? parsed.raw ?? "")}
          />
        </Field>
        <div className="mt-3">
          <SearchActions
            loading={results.loading}
            onSearch={() => void searchProducts()}
            onClear={() => {
              setQuery("");
              results.setItems([]);
            }}
          />
        </div>
        {results.items.length ? (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {results.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2"
                onClick={() => {
                  setProduct(item);
                  results.setItems([]);
                  setQuery("");
                }}
              >
                <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{formatProductId(item.id)} · {item.commercialName || item.supplierModelCode || item.serialOnyx}</p>
                  <p className="text-xs text-muted">{item.category?.name}</p>
                </div>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>
        ) : null}
        <LoadMore
          shown={results.items.length}
          total={results.total}
          hasMore={results.hasMore}
          loading={results.loadingMore}
          onClick={() => void results.loadMore()}
        />
      </Card>

      {product ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <img src={product.primaryImage?.fileUrl || product.images?.[0]?.fileUrl || "/logo.svg"} alt="" className="h-40 w-full rounded-xl object-cover sm:w-48" />
            <div className="space-y-2">
              <p className="font-mono text-accent">{formatProductId(product.id)}</p>
              <p className="font-medium">{product.commercialName || product.supplierModelCode || "Sem model code"}</p>
              <p className="text-sm text-muted">Serial Onyx: {product.serialOnyx || "—"}</p>
              <p className="text-sm text-muted">{product.category?.name}</p>
              <div className="flex gap-2">
                <ConditionBadge condition={product.condition} />
                <StatusBadge status={product.status} />
              </div>
              <p className="text-lg font-semibold">{formatCurrency(product.cashPrice)}</p>
            </div>
          </div>
          {commercialLock ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              Este produto está em uma venda comercial
              {me && can(me.role, PERMISSIONS.SALE_VIEW) && canAccessSaleOrderRecord(me, product.openSaleOrder)
                ? <> ({product.openSaleOrder.number}{product.openSaleOrder.reservedUntil ? ` · reserva até ${formatDate(product.openSaleOrder.reservedUntil)}` : ""}). <Link className="text-accent underline" href={`/vendas/${product.openSaleOrder.id}`}>Abrir venda</Link></>
                : ". Conclua ou libere pelo fluxo comercial."}
            </p>
          ) : blocked ? (
            <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
              Não é permitido dar baixa em produto vendido, descartado ou transferido.
            </p>
          ) : (
            <>
              <Field label="Motivo da saída" required>
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {Object.entries(STOCK_EXIT_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Observação" required={reason === EXIT_REASONS.OTHER}>
                <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
              </Field>
              <Button disabled={saleIncomplete} onClick={() => setConfirmOpen(true)}>Confirmar baixa</Button>
            </>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar baixa"
        message="A unidade permanecerá no histórico. O status será alterado e a movimentação será registrada com o seu usuário."
        confirmLabel="Confirmar saída"
        danger
        loading={loading}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmExit}
      />
    </div>
  );
}

export default function SaidaPage() {
  return (
    <Suspense>
      <SaidaContent />
    </Suspense>
  );
}
