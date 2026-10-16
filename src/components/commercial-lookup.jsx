"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";
import { Modal } from "./modal";
import { Button } from "./ui";

function sameText(left, right) {
  return String(left || "").trim().toLocaleLowerCase("pt-BR") === String(right || "").trim().toLocaleLowerCase("pt-BR");
}

function initialSelection(data) {
  const current = data.current || {};
  const proposed = data.proposed || {};
  return {
    commercialName: Boolean(proposed.commercialName) && !sameText(current.commercialName, proposed.commercialName),
    manufacturer: Boolean(proposed.manufacturer) && !sameText(current.manufacturer, proposed.manufacturer),
    specifications: Boolean(proposed.specifications) && String(current.specifications || "").trim() !== String(proposed.specifications || "").trim(),
    marketPrice: proposed.marketPrice != null && Number(proposed.marketPrice) !== Number(current.marketPrice || 0),
    voltage: Boolean(proposed.voltage) && proposed.voltage !== (current.voltage || ""),
    replaceImages: false,
    imageUrls: [...(proposed.imageUrls || [])],
  };
}

function textOrEmpty(value) {
  const text = String(value || "").trim();
  return text || "Não informado";
}

function CompareRow({ label, hint, checked, disabled, onChange, current, proposed }) {
  return (
    <label className={`block rounded-xl border border-border p-3 ${disabled ? "opacity-70" : ""}`}>
      <span className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
          <span className="mt-2 grid gap-2 sm:grid-cols-2">
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Salvo</span>
              <span className="mt-1 block max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">{current}</span>
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Consulta</span>
              <span className="mt-1 block max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">{proposed}</span>
            </span>
          </span>
        </span>
      </span>
    </label>
  );
}

export function CommercialLookup({ product, brandName, disabled, onChanged }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("choose");
  const [looking, setLooking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);
  const [selection, setSelection] = useState(null);

  function close() {
    if (looking || applying) return;
    setOpen(false);
    setStep("choose");
    setResult(null);
    setSelection(null);
  }

  function patch(field, value) {
    setSelection((current) => ({ ...current, [field]: value }));
  }

  async function search(source) {
    setLooking(true);
    try {
      const data = await api(`/api/products/${product.id}/commercial/lookup`, {
        method: "POST",
        json: { source, manufacturer: brandName },
      });
      setResult(data);
      setSelection(initialSelection(data));
      setStep("review");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLooking(false);
    }
  }

  async function apply() {
    if (!result || !selection) return;
    const imageUrls = selection.imageUrls || [];
    const applyFlags = {
      commercialName: selection.commercialName,
      manufacturer: selection.manufacturer,
      specifications: selection.specifications,
      marketPrice: selection.marketPrice,
      voltage: selection.voltage,
      replaceImages: selection.replaceImages,
    };
    if (!Object.values(applyFlags).some(Boolean) && !imageUrls.length) {
      toast.error("Marque ao menos uma informação para alterar.");
      return;
    }
    setApplying(true);
    try {
      const data = await api(`/api/products/${product.id}/commercial/apply`, {
        method: "POST",
        json: {
          source: result.source,
          apply: applyFlags,
          values: {
            commercialName: result.proposed.commercialName,
            manufacturer: result.proposed.manufacturer,
            specifications: result.proposed.specifications,
            marketPrice: result.proposed.marketPrice,
            voltage: result.proposed.voltage,
            imageUrls,
          },
        },
      });
      toast.success(data.message);
      setOpen(false);
      setStep("choose");
      setResult(null);
      setSelection(null);
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setApplying(false);
    }
  }

  const proposed = result?.proposed || {};
  const current = result?.current || {};
  const priceNote = result?.priceLow != null || result?.priceHigh != null
    ? `Menor preço observado ${result.priceLow != null ? formatCurrency(result.priceLow) : "—"}. Maior ${result.priceHigh != null ? formatCurrency(result.priceHigh) : "—"}.`
    : "";

  return (
    <>
      <Button type="button" variant="secondary" disabled={disabled || looking} onClick={() => setOpen(true)}>
        {looking ? "Consultando..." : "Buscar ficha"}
      </Button>
      <Modal
        open={open}
        wide={step === "review"}
        title={step === "review" ? "O que pode mudar" : "Buscar ficha"}
        onClose={close}
        footer={step === "review" ? (
          <>
            <Button type="button" variant="secondary" disabled={applying} onClick={() => setStep("choose")}>Voltar</Button>
            <Button type="button" disabled={applying} onClick={apply}>{applying ? "Salvando..." : "Aplicar selecionados"}</Button>
          </>
        ) : null}
      >
        {step === "choose" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">A consulta não grava nada. No passo seguinte você escolhe o que pode substituir o que já está salvo.</p>
            <button
              type="button"
              className="block w-full rounded-xl border border-border px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-50"
              disabled={looking}
              onClick={() => search("icecat")}
            >
              <span className="block text-sm font-semibold">{looking ? "Consultando..." : "Icecat"}</span>
              <span className="mt-1 block text-xs text-muted">Ficha e fotos do catálogo, pelo EAN ou pelo fabricante com o Model Code.</span>
            </button>
            <button
              type="button"
              className="block w-full rounded-xl border border-border px-4 py-3 text-left hover:bg-surface-2 disabled:opacity-50"
              disabled={looking}
              onClick={() => search("ai")}
            >
              <span className="block text-sm font-semibold">{looking ? "Consultando..." : "IA"}</span>
              <span className="mt-1 block text-xs text-muted">Pesquisa na web: descrição, fotos e preço médio de produto novo. A chave fica em Configurações.</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {result?.source === "ai" ? "Consulta por IA." : "Consulta no Icecat."} Marque só o que pode ser alterado.
            </p>
            {result?.notes ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{result.notes}</p> : null}
            <CompareRow
              label="Nome comercial"
              hint="Vale para todos os aparelhos deste Model Code."
              checked={Boolean(selection?.commercialName)}
              disabled={!proposed.commercialName || applying}
              onChange={(value) => patch("commercialName", value)}
              current={textOrEmpty(current.commercialName)}
              proposed={textOrEmpty(proposed.commercialName)}
            />
            <CompareRow
              label="Fabricante"
              hint="Vale para todos os aparelhos deste Model Code."
              checked={Boolean(selection?.manufacturer)}
              disabled={!proposed.manufacturer || applying}
              onChange={(value) => patch("manufacturer", value)}
              current={textOrEmpty(current.manufacturer)}
              proposed={textOrEmpty(proposed.manufacturer)}
            />
            <CompareRow
              label="Descrição / especificações"
              hint="Vale para todos os aparelhos deste Model Code."
              checked={Boolean(selection?.specifications)}
              disabled={!proposed.specifications || applying}
              onChange={(value) => patch("specifications", value)}
              current={textOrEmpty(current.specifications)}
              proposed={textOrEmpty(proposed.specifications)}
            />
            <CompareRow
              label="Tensão"
              hint="Muda só neste aparelho."
              checked={Boolean(selection?.voltage)}
              disabled={!proposed.voltage || applying}
              onChange={(value) => patch("voltage", value)}
              current={textOrEmpty(current.voltage)}
              proposed={textOrEmpty(proposed.voltage)}
            />
            <CompareRow
              label="Preço de mercado"
              hint={`Muda só neste aparelho. É uma referência de produto novo.${priceNote ? ` ${priceNote}` : ""}`}
              checked={Boolean(selection?.marketPrice)}
              disabled={proposed.marketPrice == null || applying}
              onChange={(value) => patch("marketPrice", value)}
              current={formatCurrency(current.marketPrice)}
              proposed={proposed.marketPrice == null ? "Não informado" : formatCurrency(proposed.marketPrice)}
            />
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">Fotos comerciais</p>
              <p className="mt-0.5 text-xs text-muted">Valem para todos os aparelhos deste Model Code. A prévia já é a foto baixada. Só as marcadas entram na ficha.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Salvas</p>
                  {current.images?.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {current.images.map((image) => (
                        <img key={image.id} src={image.fileUrl} alt="" className="h-20 w-full rounded-lg bg-white object-contain" />
                      ))}
                    </div>
                  ) : <p className="mt-2 text-sm text-muted">Nenhuma foto comercial.</p>}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Consulta</p>
                  {proposed.imageUrls?.length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {proposed.imageUrls.map((url) => {
                        const checked = selection?.imageUrls?.includes(url);
                        return (
                          <label key={url} className="block">
                            <img src={url} alt="" className="h-28 w-full rounded-lg bg-white object-contain" />
                            <span className="mt-1 flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-[var(--accent)]"
                                checked={Boolean(checked)}
                                disabled={applying}
                                onChange={(event) => {
                                  setSelection((state) => {
                                    const urls = state?.imageUrls || [];
                                    const imageUrls = event.target.checked ? [...urls, url] : urls.filter((item) => item !== url);
                                    return {
                                      ...state,
                                      imageUrls,
                                      replaceImages: imageUrls.length ? state.replaceImages : false,
                                    };
                                  });
                                }}
                              />
                              Usar
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : <p className="mt-2 text-sm text-muted">Nenhuma foto encontrada.</p>}
                </div>
              </div>
              {proposed.imageUrls?.length ? (
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    checked={Boolean(selection?.replaceImages)}
                    disabled={applying}
                    onChange={(event) => patch("replaceImages", event.target.checked)}
                  />
                  <span>Remover as fotos comerciais já salvas deste modelo antes de gravar as novas.</span>
                </label>
              ) : null}
            </div>
            {result?.sources?.length ? (
              <div className="text-sm">
                <p className="font-medium">Páginas consultadas</p>
                <ul className="mt-1 space-y-1">
                  {result.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer" className="text-accent underline">{source.title || source.url}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
