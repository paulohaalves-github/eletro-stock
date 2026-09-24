"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadWithProgress } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { Modal } from "@/components/modal";
import { formatCurrency } from "@/lib/format";

export function PriceImportButton({ onApplied }) {
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  function reset() {
    fileRef.current = null;
    setFileName("");
    setPreview(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (loading || applying) return;
    setOpen(false);
    reset();
  }

  async function send(apply) {
    const file = fileRef.current;
    if (!file) {
      toast.error("Selecione a planilha da Onyx.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    if (apply) form.append("apply", "1");
    if (apply) setApplying(true);
    else setLoading(true);
    setProgress(0);
    try {
      const data = await uploadWithProgress("/api/products/import-prices", form, setProgress);
      setPreview(data);
      if (apply) {
        toast.success(data.message);
        onApplied?.();
      } else {
        toast.success(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setApplying(false);
      setProgress(null);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Atualizar preços
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          fileRef.current = file;
          setFileName(file?.name || "");
          setPreview(null);
        }}
      />
      <Modal
        open={open}
        title="Atualizar preços pela planilha Onyx"
        onClose={close}
        className="max-w-3xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={close} disabled={loading || applying}>
              Fechar
            </Button>
            {preview && preview.updatedCount == null ? (
              <Button
                type="button"
                onClick={() => void send(true)}
                disabled={applying || loading || !preview.summary?.productsToUpdate}
              >
                {applying ? "Gravando..." : `Confirmar ${preview.summary?.productsToUpdate || 0} aparelho(s)`}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            Use a tabela da Onyx como está. O sistema lê Referência do Fornecedor (Model Code), preço de mercado,
            parcelado e à vista, e atualiza os aparelhos em estoque vivo. Vendidos e descartados ficam de fora.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={loading || applying}>
              Selecionar planilha
            </Button>
            <Button type="button" onClick={() => void send(false)} disabled={!fileName || loading || applying}>
              {loading ? "Lendo..." : "Conferir"}
            </Button>
            {fileName ? <span className="text-muted">{fileName}</span> : null}
          </div>
          {progress != null ? (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {preview?.updatedCount ? (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
              {preview.message}
            </p>
          ) : null}

          {preview?.summary ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Summary label="Modelos na planilha" value={preview.summary.spreadsheetModels} />
              <Summary label="Aparelhos a atualizar" value={preview.summary.productsToUpdate} />
              <Summary label="Já estavam iguais" value={preview.summary.productsUnchanged} />
              <Summary label="Sem estoque ativo" value={preview.summary.missingModels} />
              <Summary label="Linhas inválidas" value={preview.summary.invalidRows} />
              <Summary label="Códigos repetidos" value={preview.summary.duplicateModels} />
            </div>
          ) : null}

          {preview?.models?.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-left">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Model Code</th>
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Unid.</th>
                    <th className="px-3 py-2 font-semibold">À vista</th>
                    <th className="px-3 py-2 font-semibold">Parcelado</th>
                    <th className="px-3 py-2 font-semibold">Mercado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.models.map((item) => (
                    <tr key={item.supplierModelCode} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{item.supplierModelCode}</td>
                      <td className="px-3 py-2 text-muted">{item.commercialName || "—"}</td>
                      <td className="px-3 py-2">{item.changeCount}</td>
                      <td className="px-3 py-2">{formatCurrency(item.prices.cashPrice)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.prices.installmentPrice)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.prices.marketPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {preview?.missing?.length ? (
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer font-medium">
                Modelos sem estoque ativo ({preview.summary.missingModels})
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-muted">
                {preview.missing.map((item) => (
                  <li key={`${item.row}-${item.supplierModelCode}`}>
                    Linha {item.row}: {item.supplierModelCode}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {preview?.invalid?.length ? (
            <details className="rounded-xl border border-danger/30 bg-danger/5 p-3">
              <summary className="cursor-pointer font-medium">
                Linhas inválidas ({preview.summary.invalidRows})
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {preview.invalid.map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Linha {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
