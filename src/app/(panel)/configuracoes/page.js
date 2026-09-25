"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";

const emptyForm = {
  user: "",
  password: "",
  clienteId: "116",
  clienteConfigId: "249",
  passwordSet: false,
};

export default function ConfiguracoesPage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/api/settings/care")
      .then((data) => setForm({ ...emptyForm, ...data.settings, password: "" }))
      .catch((error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/settings/care", {
        method: "PUT",
        json: {
          user: form.user,
          password: form.password,
          clienteId: form.clienteId,
          clienteConfigId: form.clienteConfigId,
        },
      });
      setForm({ ...emptyForm, ...data.settings, password: "" });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-3xl">
      <PageHeader
        title="Configurações"
        subtitle="Dados usados pelo sistema para entrar no Care e buscar o cliente pela OV."
      />
      <Card>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="E-mail do Care" required>
              <Input
                type="email"
                value={form.user}
                disabled={loading}
                autoComplete="off"
                onChange={(event) => setForm({ ...form, user: event.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Senha do Care"
              required={!form.passwordSet}
              hint={form.passwordSet ? "Deixe em branco para manter a senha já salva." : "A senha fica só no servidor."}
            >
              <Input
                type="password"
                value={form.password}
                disabled={loading}
                autoComplete="new-password"
                placeholder={form.passwordSet ? "••••••••" : ""}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Cliente ID" required>
            <Input
              inputMode="numeric"
              value={form.clienteId}
              disabled={loading}
              onChange={(event) => setForm({ ...form, clienteId: event.target.value })}
            />
          </Field>
          <Field label="Cliente config ID" required>
            <Input
              inputMode="numeric"
              value={form.clienteConfigId}
              disabled={loading}
              onChange={(event) => setForm({ ...form, clienteConfigId: event.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading || saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
