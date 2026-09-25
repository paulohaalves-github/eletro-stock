"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { CustomerPhonesFields, emptyPhoneRow } from "@/components/customer-phones";

function emptyCustomerForm() {
  return { name: "", phones: [emptyPhoneRow()], document: "", email: "", address: "", notes: "" };
}

export function CustomerPicker({ value, onChange, allowCreate = true }) {
  const list = usePagedList();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyCustomerForm());
  const [ov, setOv] = useState("");
  const [careLoading, setCareLoading] = useState(false);
  const [careSteps, setCareSteps] = useState([]);
  const [error, setError] = useState("");

  function loader(page, pageSize) {
    return api(`/api/customers?${listQuery({ q: query }, page, pageSize)}`);
  }

  async function searchCustomers() {
    if (!query.trim()) {
      list.setItems([]);
      return;
    }
    await list.search(loader);
  }

  async function searchCare() {
    setError("");
    if (!ov.trim() || careLoading) {
      if (!ov.trim()) setError("Informe a OV do Care.");
      return;
    }
    setCareLoading(true);
    setCareSteps([]);
    try {
      const response = await fetch("/api/integrations/care/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ov: ov.trim() }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível buscar no Care.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let customer = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "step") setCareSteps((current) => [...current, event.message]);
          if (event.type === "customer") customer = event.customer;
          if (event.type === "error") throw new Error(event.message);
        }
      }

      if (!customer) throw new Error("A busca no Care não retornou os dados do cliente.");
      setForm({
        name: customer.name || "",
        phones: customer.phones?.length ? customer.phones : [emptyPhoneRow()],
        document: customer.document || "",
        email: customer.email || "",
        address: customer.address || "",
        notes: customer.notes || "",
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCareLoading(false);
    }
  }

  async function create() {
    setError("");
    try {
      const data = await api("/api/customers", { method: "POST", json: form });
      onChange(data.customer);
      setCreating(false);
      setForm(emptyCustomerForm());
      setOv("");
      setQuery("");
      list.setItems([]);
    } catch (err) {
      setError(err.message);
    }
  }

  if (value) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 p-3">
        <p className="font-medium">{value.name}</p>
        <p className="text-sm text-muted">{value.phoneLabel || value.phone}{value.document ? ` · ${value.document}` : ""}</p>
        {value.address ? <p className="text-sm text-muted">{value.address}</p> : null}
        <Button type="button" variant="ghost" className="mt-2 px-0" onClick={() => onChange(null)}>
          Trocar cliente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Buscar cliente">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              void searchCustomers();
            }
          }}
          placeholder="Nome, telefone ou documento"
        />
      </Field>
      <SearchActions
        loading={list.loading}
        onSearch={() => void searchCustomers()}
        onClear={() => {
          setQuery("");
          list.setItems([]);
        }}
      />
      {list.items.length ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {list.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col items-start p-3 text-left hover:bg-surface-2"
              onClick={() => {
                onChange(item);
                setQuery("");
                list.setItems([]);
              }}
            >
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{item.phoneLabel || item.phone}{item.document ? ` · ${item.document}` : ""}</span>
              {item.address ? <span className="text-xs text-muted">{item.address}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />
      {allowCreate ? (
        creating ? (
          <div
            className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2"
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.target.tagName === "TEXTAREA" || event.target.closest("button")) return;
              event.preventDefault();
              void create();
            }}
          >
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Field label="OV do Care">
                <Input
                  value={ov}
                  inputMode="numeric"
                  placeholder="Número da OV"
                  onChange={(e) => setOv(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      void searchCare();
                    }
                  }}
                />
              </Field>
              <Button type="button" variant="secondary" disabled={careLoading} onClick={() => void searchCare()}>
                {careLoading ? "Buscando..." : "Buscar no Care"}
              </Button>
            </div>
            {careSteps.length ? (
              <ol className="sm:col-span-2 space-y-1 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
                {careSteps.map((step, index) => (
                  <li key={`${index}-${step}`} className={careLoading && index === careSteps.length - 1 ? "text-text" : ""}>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
            <Field label="Nome" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <CustomerPhonesFields value={form.phones} onChange={(phones) => setForm({ ...form, phones })} />
            </div>
            <Field label="CPF/CNPJ"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Endereço" required><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /></Field>
            </div>
            {form.notes ? (
              <div className="sm:col-span-2">
                <Field label="Observações">
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
            ) : null}
            {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={() => void create()}>Salvar cliente</Button>
              <Button type="button" variant="ghost" onClick={() => { setCreating(false); setOv(""); setForm(emptyCustomerForm()); setCareSteps([]); setError(""); }}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setCreating(true)}>Cadastrar cliente</Button>
        )
      ) : null}
    </div>
  );
}
