"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ImagePicker } from "@/components/images";
import { SpreadsheetImport } from "@/components/spreadsheet-import";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";

const STEPS = ["Identificação", "Preços e detalhes", "Condição e fotos", "Confirmar"];

const empty = {
  serialOnyx: "",
  supplierModelCode: "",
  commercialName: "",
  ean: "",
  categoryId: "",
  lineId: "",
  capacitySizeType: "",
  condition: "NOVO",
  damageDescription: "",
  description: "",
  installmentPrice: "",
  cashPrice: "",
  marketPrice: "",
  origin: "",
  observation: "",
};

export default function EntradaPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState("unidade");

  useEffect(() => {
    Promise.all([api("/api/categories"), api("/api/lines"), api("/api/auth/me")]).then(([c, l, auth]) => {
      setCategories((c.items || []).filter((item) => item.active));
      setLines((l.items || []).filter((item) => item.active));
      setMe(auth.user);
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const code = form.supplierModelCode.trim();
      if (!code) return;
      try {
        const data = await api(`/api/catalog-models?code=${encodeURIComponent(code)}`);
        if (data.item?.commercialName) {
          setForm((current) =>
            current.supplierModelCode.trim() === code
              ? { ...current, commercialName: data.item.commercialName }
              : current,
          );
        }
      } catch {
        // busca opcional
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [form.supplierModelCode]);

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep() {
    if (step === 0) {
      if (!form.serialOnyx.trim()) {
        toast.error("Informe o Serial Onyx.");
        return false;
      }
      if (!form.categoryId) {
        toast.error("Informe a categoria.");
        return false;
      }
      if (form.supplierModelCode.trim() && !form.commercialName.trim()) {
        toast.error("Informe o nome comercial para este Model Code.");
        return false;
      }
    }
    if (step === 2) {
      if (!form.condition) {
        toast.error("Informe a condição do produto.");
        return false;
      }
      if (form.condition === CONDITIONS.NEW_DAMAGE && !form.damageDescription.trim()) {
        toast.error("Preencha a descrição da avaria.");
        return false;
      }
      if (form.condition === CONDITIONS.NEW_DAMAGE && files.length === 0) {
        toast.error("Anexe fotos da avaria para evidência visual.");
        return false;
      }
    }
    return true;
  }

  async function submit() {
    if (!validateStep()) return;
    setLoading(true);
    try {
      const created = await api("/api/products", { method: "POST", json: form });
      if (files.length) {
        const data = new FormData();
        files.forEach((file) => data.append("files", file));
        setProgress(0);
        await uploadWithProgress(`/api/products/${created.product.id}/images`, data, setProgress);
      }
      toast.success("Entrada de estoque registrada.");
      router.push(`/estoque/${created.product.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  if (me && !can(me.role, PERMISSIONS.STOCK_ENTRY)) {
    return <p className="text-danger">Você não tem permissão para dar entrada no estoque.</p>;
  }

  return (
    <div>
      <PageHeader title="Entrada de estoque" subtitle="Cadastre uma unidade individual ou importe várias pela planilha." />
      <div className="mb-4 flex gap-2">
        <Button type="button" variant={mode === "unidade" ? "primary" : "secondary"} onClick={() => setMode("unidade")}>
          Unidade
        </Button>
        <Button type="button" variant={mode === "planilha" ? "primary" : "secondary"} onClick={() => setMode("planilha")}>
          Planilha
        </Button>
      </div>
      {mode === "planilha" ? <SpreadsheetImport /> : null}
      {mode === "unidade" ? (
        <>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(index)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${index === step ? "bg-accent text-slate-950" : "bg-surface-2 text-muted"}`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Serial Onyx" required>
              <Input value={form.serialOnyx} onChange={(e) => set("serialOnyx", e.target.value)} placeholder="Identificador único — não pode repetir" />
            </Field>
            <Field label="Referência / Model Code">
              <Input value={form.supplierModelCode} onChange={(e) => set("supplierModelCode", e.target.value)} />
            </Field>
            <Field label="Nome comercial" hint="Vinculado ao Model Code. Unidades com o mesmo código compartilham este nome." required={Boolean(form.supplierModelCode.trim())}>
              <Input value={form.commercialName} onChange={(e) => set("commercialName", e.target.value)} placeholder="Ex.: Smart TV Samsung 55 Crystal UHD" />
            </Field>
            <Field label="EAN">
              <Input value={form.ean} onChange={(e) => set("ean", e.target.value)} />
            </Field>
            <Field label="Categoria" required>
              <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">Selecione</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Linha">
              <Select value={form.lineId} onChange={(e) => set("lineId", e.target.value)}>
                <option value="">Selecione</option>
                {lines.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Capacidade / Tamanho / Tipo">
              <Input value={form.capacitySizeType} onChange={(e) => set("capacitySizeType", e.target.value)} placeholder="55 polegadas, 12 kg, 128 GB..." />
            </Field>
            <Field label="Origem">
              <Input value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Fornecedor, devolução, vitrine..." />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Preço à vista">
              <Input type="number" step="0.01" value={form.cashPrice} onChange={(e) => set("cashPrice", e.target.value)} />
            </Field>
            <Field label="Preço parcelado">
              <Input type="number" step="0.01" value={form.installmentPrice} onChange={(e) => set("installmentPrice", e.target.value)} />
            </Field>
            <Field label="Preço de mercado">
              <Input type="number" step="0.01" value={form.marketPrice} onChange={(e) => set("marketPrice", e.target.value)} />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Descrição">
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Informações gerais do produto" />
              </Field>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <Field label="Condição" required>
              <Select value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            {form.condition === CONDITIONS.NEW_DAMAGE ? (
              <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
                Obrigatório informar a descrição da avaria e anexar fotos de evidência.
              </div>
            ) : null}
            <Field label="Descrição das avarias" required={form.condition === CONDITIONS.NEW_DAMAGE}>
              <Textarea
                value={form.damageDescription}
                onChange={(e) => set("damageDescription", e.target.value)}
                placeholder="Pequeno risco na lateral, amassado, embalagem danificada..."
              />
            </Field>
            <ImagePicker
              files={files}
              onChange={setFiles}
              requiredHint={form.condition === CONDITIONS.NEW_DAMAGE ? "Anexe fotos da avaria. No celular, use Tirar foto para abrir a câmera." : "No celular, use Tirar foto para evidenciar o estado na entrada."}
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 text-sm">
            <p><strong>Categoria:</strong> {categories.find((item) => String(item.id) === String(form.categoryId))?.name || "—"}</p>
            <p><strong>Serial Onyx:</strong> {form.serialOnyx || "—"}</p>
            <p><strong>Model Code:</strong> {form.supplierModelCode || "—"}</p>
            <p><strong>Nome comercial:</strong> {form.commercialName || "—"}</p>
            <p><strong>Condição:</strong> {CONDITION_LABELS[form.condition]}</p>
            <p><strong>À vista:</strong> {formatCurrency(form.cashPrice || 0)}</p>
            <p><strong>Fotos:</strong> {files.length}</p>
            <Field label="Observação da entrada">
              <Input value={form.observation} onChange={(e) => set("observation", e.target.value)} />
            </Field>
            {progress != null ? (
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-between pt-2">
          <Button type="button" variant="secondary" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Voltar
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => validateStep() && setStep(step + 1)}>
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={loading}>
              {loading ? "Salvando..." : "Confirmar entrada"}
            </Button>
          )}
        </div>
      </Card>
        </>
      ) : null}
    </div>
  );
}
