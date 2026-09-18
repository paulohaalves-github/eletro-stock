"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { ScanField } from "@/components/scan-field";
import { CLOSED_STATUSES, EXIT_REASON_LABELS, EXIT_REASONS, WARRANTY_MONTHS } from "@/lib/constants";
import { formatCurrency, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { CustomerPicker } from "@/components/customer-picker";

function SaidaContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const results = usePagedList();
  const [product, setProduct] = useState(null);
  const [reason, setReason] = useState(EXIT_REASONS.SALE);
  const [observation, setObservation] = useState("");
  const [customer, setCustomer] = useState(null);
  const [warrantyMonths, setWarrantyMonths] = useState("3");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
          ...(reason === EXIT_REASONS.SALE
            ? { customerId: customer?.id, warrantyMonths: Number(warrantyMonths), invoiceNumber }
            : {}),
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

  const blocked = product && (["VENDIDO", "TRANSFERIDO", "DESCARTADO", "EM_TRANSITO", "EM_REPARO"].includes(product.status)
    || (CLOSED_STATUSES.includes(product.status) && product.status !== "DEVOLVIDO"));
  const saleIncomplete = reason === EXIT_REASONS.SALE && (!customer || !invoiceNumber.trim());

  return (
    <div>
      <PageHeader title="Saída de estoque" subtitle="Localize a unidade e confirme a baixa sem apagar o histórico." />
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
          {blocked ? (
            <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
              Não é permitido dar baixa em produto vendido, descartado ou transferido.
            </p>
          ) : (
            <>
              <Field label="Motivo da saída" required>
                <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {Object.entries(EXIT_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              {reason === EXIT_REASONS.SALE ? (
                <>
                  <Field label="Cliente" required>
                    <CustomerPicker value={customer} onChange={setCustomer} />
                  </Field>
                  <Field label="Número NF" required hint="Número da nota fiscal da venda.">
                    <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex.: 123456" />
                  </Field>
                  <Field label="Garantia" required hint="Prazo escolhido na venda, de 1 a 12 meses.">
                    <Select value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)}>
                      {WARRANTY_MONTHS.map((months) => (
                        <option key={months} value={months}>{months} {months === 1 ? "mês" : "meses"}</option>
                      ))}
                    </Select>
                  </Field>
                </>
              ) : null}
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
