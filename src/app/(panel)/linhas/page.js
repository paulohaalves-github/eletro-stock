"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader } from "@/components/ui";

export default function LinhasPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");

  async function load() {
    const data = await api("/api/lines");
    setItems(data.items || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      const data = await api("/api/lines", { method: "POST", json: { name } });
      toast.success(data.message);
      setName("");
      load();
    } catch (error) {
      toast.error(error.message);
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
    <div>
      <PageHeader title="Linhas" subtitle="Samsung, Linha Branca, Mobile, Wearables e novas linhas." />
      <Card className="mb-4">
        <form onSubmit={create} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova linha" />
          <Button>Adicionar</Button>
        </form>
      </Card>
      <div className="grid gap-2">
        {items.map((item) => (
          <Card key={item.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-muted">{item.active ? "Ativa" : "Inativa"}</p>
            </div>
            <Button variant="ghost" onClick={() => toggle(item)}>{item.active ? "Desativar" : "Ativar"}</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
