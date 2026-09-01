"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card } from "@/components/ui";

export function SpreadsheetImport() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function downloadTemplate() {
    const response = await fetch("/api/products/import/template");
    if (!response.ok) {
      toast.error("Não foi possível baixar o modelo.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eletro-stock-entrada.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!file) {
      toast.error("Selecione uma planilha.");
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await uploadWithProgress("/api/products/import", form, setProgress);
      setResult(data);
      if (data.createdCount) toast.success(data.message);
      else toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Entrada via planilha</h2>
        <p className="mt-1 text-sm text-muted">
          Cada linha vira uma unidade. Serial Onyx é obrigatório e único. O nome comercial fica vinculado ao Model Code.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={downloadTemplate}>
          Baixar modelo Excel
        </Button>
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          Selecionar planilha
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setResult(null);
          }}
        />
      </div>
      {file ? <p className="text-sm">Arquivo: {file.name}</p> : null}
      {progress != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      <Button type="button" onClick={submit} disabled={loading || !file}>
        {loading ? "Importando..." : "Confirmar entrada da planilha"}
      </Button>
      {result ? (
        <div className="space-y-2 text-sm">
          <p>
            Importados: <strong>{result.createdCount}</strong> · Erros: <strong>{result.errorCount}</strong>
          </p>
          {result.errors?.length ? (
            <ul className="max-h-56 overflow-auto rounded-xl border border-danger/30 bg-danger/5 p-3">
              {result.errors.map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Linha {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
