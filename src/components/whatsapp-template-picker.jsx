"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { Field, Input, Select } from "@/components/ui";
import { assertTemplateVariables, renderTemplatePreview } from "@/lib/whatsapp/templates";

function languageLabel(code) {
  const value = String(code || "");
  if (value.toLowerCase().startsWith("pt")) return "Português";
  if (value.toLowerCase().startsWith("en")) return "Inglês";
  if (value.toLowerCase().startsWith("es")) return "Espanhol";
  return value || "Idioma";
}

function categoryLabel(category) {
  const value = String(category || "").toUpperCase();
  if (value === "MARKETING") return "Marketing";
  if (value === "UTILITY") return "Utilidade";
  if (value === "AUTHENTICATION") return "Autenticação";
  return category || "Modelo";
}

export function WhatsappTemplatePicker({ channelId, disabled, onChange }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [variables, setVariables] = useState({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setSelectedId("");
    setVariables({});
    setTemplates([]);
    setError("");
    if (!channelId) return undefined;
    let cancelled = false;
    setLoading(true);
    api(`/api/inbox/channels/${channelId}/templates`)
      .then((data) => {
        if (!cancelled) setTemplates(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setTemplates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const selected = useMemo(
    () => templates.find((item) => item.id === selectedId) || null,
    [templates, selectedId],
  );

  const preview = useMemo(
    () => (selected ? renderTemplatePreview(selected, variables) : ""),
    [selected, variables],
  );
  const missing = selected ? assertTemplateVariables(selected, variables) : "Selecione um modelo.";
  const ready = Boolean(selected && !missing);

  useEffect(() => {
    onChangeRef.current?.(
      selected
        ? {
            name: selected.name,
            language: selected.language,
            variables,
            preview,
            ready,
            unsupported: selected.unsupported,
          }
        : null,
    );
  }, [selected, variables, preview, ready]);

  return (
    <div className="space-y-3">
      <Field label="Modelo" required hint="Apenas modelos aprovados na 360dialog aparecem aqui.">
        <Select
          value={selectedId}
          disabled={disabled || loading || !channelId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setVariables({});
          }}
        >
          <option value="">{loading ? "Carregando modelos..." : "Selecione um modelo"}</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {languageLabel(item.language)} · {categoryLabel(item.category)}
            </option>
          ))}
        </Select>
      </Field>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {!loading && channelId && !error && !templates.length ? (
        <p className="text-xs text-muted">Nenhum modelo aprovado neste canal. Cadastre na 360dialog ou no WhatsApp Manager.</p>
      ) : null}
      {selected?.unsupported ? <p className="text-xs text-amber-300">{selected.unsupported}</p> : null}
      {selected && !selected.unsupported ? (
        <>
          {selected.fields.map((field) => (
            <Field key={field.key} label={field.label} required hint={field.example ? `Exemplo: ${field.example}` : undefined}>
              <Input
                value={variables[field.key] || ""}
                disabled={disabled}
                onChange={(event) => setVariables((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.example || "Preencha a variável"}
              />
            </Field>
          ))}
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pré-visualização</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{preview || "O conteúdo do modelo aparece aqui."}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
