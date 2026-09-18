"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Field, Input } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

export function CustomerPicker({ value, onChange, allowCreate = true }) {
  const list = usePagedList();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", document: "", email: "", address: "" });
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

  async function create(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api("/api/customers", { method: "POST", json: form });
      onChange(data.customer);
      setCreating(false);
      setForm({ name: "", phone: "", document: "", email: "", address: "" });
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
        <p className="text-sm text-muted">{value.phone}{value.document ? ` · ${value.document}` : ""}</p>
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
              <span className="text-xs text-muted">{item.phone}{item.document ? ` · ${item.document}` : ""}</span>
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
          <form onSubmit={create} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
            <Field label="Nome" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Telefone" required><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="CPF/CNPJ"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Endereço" required><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /></Field>
            </div>
            {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">Salvar cliente</Button>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setCreating(true)}>Cadastrar cliente</Button>
        )
      ) : null}
    </div>
  );
}
