"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { ScanField } from "@/components/scan-field";
import { CustomerPicker } from "@/components/customer-picker";
import { ImagePicker } from "@/components/images";
import { StatusBadge, WorkOrderTypeBadge } from "@/components/badges";
import { SERVICE_PLACE_LABELS, SERVICE_PLACES, WARRANTY_MONTHS, WORK_ORDER_TYPES, isWarrantyValid } from "@/lib/constants";
import { formatDate, formatProductId, formatWarrantyRemaining } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

function NovaOsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const results = usePagedList();
  const [product, setProduct] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [warrantyMonths, setWarrantyMonths] = useState("3");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [soldAt, setSoldAt] = useState("");
  const [servicePlace, setServicePlace] = useState(SERVICE_PLACES.LAB);
  const [reportedDefect, setReportedDefect] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const presetId = params.get("productId") || params.get("id");

  function selectProduct(item) {
    setProduct(item);
    setCustomer(item.latestSale?.customer || null);
    setWarrantyMonths(String(item.latestSale?.warrantyMonths || 3));
    setInvoiceNumber(item.latestSale?.invoiceNumber || "");
    if (item.workOrderType === WORK_ORDER_TYPES.STOCK_REPAIR) {
      setServicePlace(SERVICE_PLACES.LAB);
    }
    results.setItems([]);
    setQuery("");
  }

  useEffect(() => {
    if (!presetId) return;
    let cancelled = false;
    api(`/api/work-orders?lookup=1&productId=${encodeURIComponent(presetId)}`)
      .then((data) => {
        if (cancelled) return;
        const item = data.items?.[0];
        if (!item) {
          toast.error("Este produto não está disponível para abrir OS.");
          return;
        }
        selectProduct(item);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId]);

  async function search(value) {
    const text = String(value ?? query);
    setQuery(text);
    if (!text.trim()) {
      results.setItems([]);
      return;
    }
    await results.search((page, pageSize) => api(`/api/work-orders?lookup=1&${listQuery({ q: text }, page, pageSize)}`));
  }

  const isAfterSales = product?.workOrderType === WORK_ORDER_TYPES.AFTER_SALES;

  async function submit(event) {
    event.preventDefault();
    if (!product) return toast.error("Selecione o produto.");
    if (!reportedDefect.trim()) return toast.error("Descreva o defeito.");
    if (isAfterSales && !product.latestSale && !customer) return toast.error("Informe o cliente da venda.");
    if (isAfterSales && !product.latestSale && !invoiceNumber.trim()) return toast.error("Informe o número da NF.");
    setLoading(true);
    try {
      const data = await api("/api/work-orders", {
        method: "POST",
        json: {
          productId: product.id,
          servicePlace,
          reportedDefect,
          customerId: isAfterSales && !product.latestSale ? customer?.id : undefined,
          warrantyMonths: isAfterSales && !product.latestSale ? Number(warrantyMonths) : undefined,
          invoiceNumber: isAfterSales && !product.latestSale ? invoiceNumber : undefined,
          soldAt: isAfterSales && !product.latestSale ? soldAt || undefined : undefined,
        },
      });
      if (files.length) {
        const form = new FormData();
        files.forEach((file) => form.append("files", file));
        const opening = data.workOrder.events?.find((event) => event.type === "ABERTURA");
        if (opening) form.append("eventId", String(opening.id));
        await uploadWithProgress(`/api/work-orders/${data.workOrder.id}/images`, form);
      }
      toast.success(data.message);
      router.push(`/reparos/${data.workOrder.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  const saleDate = product?.latestSale?.soldAt || soldAt || new Date();
  const saleMonths = product?.latestSale?.warrantyMonths || Number(warrantyMonths);
  const warrantyRemaining = isAfterSales ? formatWarrantyRemaining(saleDate, saleMonths) : null;
  const warrantyValid = isAfterSales ? isWarrantyValid(saleDate, saleMonths) : true;

  return (
    <div>
      <PageHeader title="Nova ordem de serviço" subtitle="Abra OS de pós-venda ou de reparo de estoque. O tipo é definido pelo produto." />
      <Card className="mb-4">
        <Field label="Produto">
          <ScanField
            value={query}
            onChange={setQuery}
            onScan={(parsed) => search(parsed.query ?? parsed.raw ?? "")}
            placeholder="ID, Serial Onyx, EAN ou nome comercial"
          />
        </Field>
        <div className="mt-3">
          <SearchActions
            loading={results.loading}
            onSearch={() => void search()}
            onClear={() => {
              setQuery("");
              results.setItems([]);
            }}
          />
        </div>
        {results.items.length ? (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {results.items.map((item) => (
              <button key={item.id} type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2" onClick={() => selectProduct(item)}>
                <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{formatProductId(item.id)} · {item.commercialName || item.serialOnyx}</p>
                  <p className="text-xs text-muted">
                    {item.workOrderType === WORK_ORDER_TYPES.AFTER_SALES
                      ? (item.latestSale?.customer?.name || "Venda sem cliente vinculado")
                      : "Produto em estoque"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <WorkOrderTypeBadge type={item.workOrderType} />
                  <StatusBadge status={item.status} />
                </div>
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
        <form onSubmit={submit}>
          <Card className="space-y-4">
            <div>
              <p className="font-mono text-accent">{formatProductId(product.id)}</p>
              <p className="font-medium">{product.commercialName || product.serialOnyx}</p>
              <p className="text-sm text-muted">Serial: {product.serialOnyx}</p>
              <div className="mt-2">
                <WorkOrderTypeBadge type={product.workOrderType} />
              </div>
            </div>
            {isAfterSales && warrantyRemaining ? (
              <p className={`rounded-xl border p-3 text-sm ${warrantyValid ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"}`}>
                {warrantyRemaining}
              </p>
            ) : null}
            {isAfterSales && product.latestSale ? (
              <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                Cliente {product.latestSale.customer?.name} · NF {product.latestSale.invoiceNumber || "—"} · garantia de {product.latestSale.warrantyMonths} meses · venda em {formatDate(product.latestSale.soldAt)}
              </p>
            ) : null}
            {isAfterSales && !product.latestSale ? (
              <>
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Esta venda ainda não tem cliente, NF e garantia. Preencha para abrir a OS de pós-venda.
                </p>
                <Field label="Cliente" required>
                  <CustomerPicker value={customer} onChange={setCustomer} />
                </Field>
                <Field label="Número NF" required>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ex.: 123456" />
                </Field>
                <Field label="Garantia" required>
                  <Select value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)}>
                    {WARRANTY_MONTHS.map((months) => (
                      <option key={months} value={months}>{months} {months === 1 ? "mês" : "meses"}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Data da venda">
                  <input
                    type="date"
                    value={soldAt}
                    onChange={(e) => setSoldAt(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </Field>
              </>
            ) : null}
            {!isAfterSales ? (
              <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                OS de reparo de estoque. O aparelho permanece sem vínculo com cliente e volta ao estoque ao encerrar.
              </p>
            ) : null}
            <Field label="Onde será o reparo?" required>
              <Select
                value={servicePlace}
                onChange={(e) => setServicePlace(e.target.value)}
                disabled={!isAfterSales}
              >
                {Object.entries(SERVICE_PLACE_LABELS)
                  .filter(([value]) => isAfterSales || value === SERVICE_PLACES.LAB)
                  .map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
              </Select>
            </Field>
            <Field label="Defeito relatado" required>
              <Textarea
                value={reportedDefect}
                onChange={(e) => setReportedDefect(e.target.value)}
                placeholder={isAfterSales ? "O que o cliente informou" : "Descreva o defeito encontrado no estoque"}
              />
            </Field>
            <Field label="Evidências (fotos)">
              <ImagePicker files={files} onChange={setFiles} />
            </Field>
            <Button disabled={loading}>{loading ? "Abrindo..." : "Abrir ordem de serviço"}</Button>
          </Card>
        </form>
      ) : null}
    </div>
  );
}

export default function NovaOsPage() {
  return (
    <Suspense fallback={<p className="text-muted">Carregando ordem de serviço...</p>}>
      <NovaOsContent />
    </Suspense>
  );
}
