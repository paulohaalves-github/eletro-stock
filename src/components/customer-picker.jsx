"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Field, Input } from "@/components/ui";

export function CustomerPicker({ value, onChange, allowCreate = true }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", document: "", email: "", address: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (!query.trim() || value) {
        setResults([]);
        return;
      }
      try {
        const data = await api(`/api/customers?q=${encodeURIComponent(query)}&pageSize=8`);
        setResults(data.items || []);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(timeout);
  }, [query, value]);

  async function create(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api("/api/customers", { method: "POST", json: form });
      onChange(data.customer);
      setCreating(false);
      setForm({ name: "", phone: "", document: "", email: "", address: "" });
      setQuery("");
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
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, telefone ou documento" />
      </Field>
      {results.length ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col items-start p-3 text-left hover:bg-surface-2"
              onClick={() => {
                onChange(item);
                setQuery("");
                setResults([]);
              }}
            >
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted">{item.phone}{item.document ? ` · ${item.document}` : ""}</span>
              {item.address ? <span className="text-xs text-muted">{item.address}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
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
