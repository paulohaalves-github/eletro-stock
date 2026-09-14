"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { Modal } from "@/components/modal";

export default function LinhasPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api("/api/lines");
    setItems(data.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setName("");
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/lines", { method: "POST", json: { name } });
      toast.success(data.message);
      setName("");
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item) {
    try {
      await api(`/api/lines/${item.id}`, { method: "PATCH", json: { name: item.name, active: !item.active } });
      toast.success("Linha atualizada.");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Linhas"
        subtitle="Samsung, Linha Branca, Mobile, Wearables e novas linhas."
        actions={<Button onClick={() => { setName(""); setOpen(true); }}>Nova linha</Button>}
      />

      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-surface-2/80">
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4 text-muted">{item.active ? "Ativa" : "Inativa"}</td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="ghost" onClick={() => toggle(item)}>{item.active ? "Desativar" : "Ativar"}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma linha cadastrada.</p> : null}
      </Card>

      <Modal
        open={open}
        title="Nova linha"
        onClose={closeModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="line-form" disabled={saving || !name.trim()}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </>
        }
      >
        <form id="line-form" onSubmit={create}>
          <Field label="Nome" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova linha" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
