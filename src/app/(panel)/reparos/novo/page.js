"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ScanField } from "@/components/scan-field";
import { CustomerPicker } from "@/components/customer-picker";
import { ImagePicker } from "@/components/images";
import { StatusBadge } from "@/components/badges";
import { SERVICE_PLACE_LABELS, SERVICE_PLACES, WARRANTY_MONTHS } from "@/lib/constants";
import { formatDate, formatProductId } from "@/lib/format";

export default function NovaOsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [product, setProduct] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [warrantyMonths, setWarrantyMonths] = useState("3");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [soldAt, setSoldAt] = useState("");
  const [servicePlace, setServicePlace] = useState(SERVICE_PLACES.LAB);
  const [reportedDefect, setReportedDefect] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search(value) {
    const text = String(value ?? "");
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const data = await api(`/api/work-orders?lookup=1&q=${encodeURIComponent(text)}`);
    setResults(data.items || []);
  }

  function selectProduct(item) {
    setProduct(item);
    setCustomer(item.latestSale?.customer || null);
    setWarrantyMonths(String(item.latestSale?.warrantyMonths || 3));
    setInvoiceNumber(item.latestSale?.invoiceNumber || "");
    setResults([]);
    setQuery("");
  }

  async function submit(event) {
    event.preventDefault();
    if (!product) return toast.error("Selecione o produto vendido.");
    if (!reportedDefect.trim()) return toast.error("Descreva o defeito.");
    if (!product.latestSale && !customer) return toast.error("Informe o cliente da venda.");
    if (!product.latestSale && !invoiceNumber.trim()) return toast.error("Informe o número da NF.");
    setLoading(true);
    try {
      const data = await api("/api/work-orders", {
        method: "POST",
        json: {
          productId: product.id,
          servicePlace,
          reportedDefect,
          customerId: product.latestSale ? undefined : customer?.id,
          warrantyMonths: product.latestSale ? undefined : Number(warrantyMonths),
          invoiceNumber: product.latestSale ? undefined : invoiceNumber,
          soldAt: product.latestSale ? undefined : soldAt || undefined,
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

  return (
    <div>
      <PageHeader title="Nova ordem de serviço" subtitle="Localize o aparelho vendido na garantia e registre o defeito." />
      <Card className="mb-4">
        <Field label="Produto vendido">
          <ScanField value={query} onChange={search} onScan={(parsed) => search(parsed.query ?? parsed.raw ?? "")} />
        </Field>
        {results.length ? (
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {results.map((item) => (
              <button key={item.id} type="button" className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2" onClick={() => selectProduct(item)}>
                <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{formatProductId(item.id)} · {item.commercialName || item.serialOnyx}</p>
                  <p className="text-xs text-muted">{item.latestSale?.customer?.name || "Venda sem cliente vinculado"}</p>
                </div>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {product ? (
        <form onSubmit={submit}>
          <Card className="space-y-4">
            <div>
              <p className="font-mono text-accent">{formatProductId(product.id)}</p>
              <p className="font-medium">{product.commercialName || product.serialOnyx}</p>
              <p className="text-sm text-muted">Serial: {product.serialOnyx}</p>
            </div>
            {product.latestSale ? (
              <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                Cliente {product.latestSale.customer?.name} · NF {product.latestSale.invoiceNumber || "—"} · garantia de {product.latestSale.warrantyMonths} meses · venda em {formatDate(product.latestSale.soldAt)}
              </p>
            ) : (
              <>
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                  Esta venda ainda não tem cliente, NF e garantia. Preencha para abrir a OS.
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
            )}
            <Field label="Onde será o reparo?" required>
              <Select value={servicePlace} onChange={(e) => setServicePlace(e.target.value)}>
                {Object.entries(SERVICE_PLACE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Defeito relatado" required>
              <Textarea value={reportedDefect} onChange={(e) => setReportedDefect(e.target.value)} placeholder="O que o cliente informou" />
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
