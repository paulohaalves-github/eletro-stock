"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { ConditionBadge, StatusBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/modal";
import { ScanField } from "@/components/scan-field";
import { CLOSED_STATUSES, EXIT_REASON_LABELS, EXIT_REASONS } from "@/lib/constants";
import { formatCurrency, formatProductId } from "@/lib/format";

function SaidaContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [product, setProduct] = useState(null);
  const [reason, setReason] = useState(EXIT_REASONS.SALE);
  const [observation, setObservation] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = params.get("id");
    if (id) api(`/api/products/${id}`).then((data) => setProduct(data.product));
  }, [params]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(data.items || []);
    }, 180);
    return () => clearTimeout(timeout);
  }, [query]);

  async function confirmExit() {
    setLoading(true);
    try {
      const data = await api("/api/stock/exit", {
        method: "POST",
        json: { productId: product.id, reason, observation },
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

  const blocked = product && CLOSED_STATUSES.includes(product.status) && product.status !== "DEVOLVIDO"
    ? true
    : product && ["VENDIDO", "TRANSFERIDO", "DESCARTADO"].includes(product.status);

  return (
    <div>
      <PageHeader title="Saída de estoque" subtitle="Localize a unidade e confirme a baixa sem apagar o histórico." />
      <Card className="mb-4">
        <Field label="Localizar produto">
          <ScanField value={query} onChange={setQuery} onScan={(parsed) => setQuery(parsed.query)} />
        </Field>
        {results.length ? (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {results.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2"
                onClick={() => {
                  setProduct(item);
                  setResults([]);
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
              <Field label="Observação" required={reason === EXIT_REASONS.OTHER}>
                <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} />
              </Field>
              <Button onClick={() => setConfirmOpen(true)}>Confirmar baixa</Button>
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
