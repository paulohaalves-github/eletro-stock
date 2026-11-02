"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Textarea } from "@/components/ui";
import { CustomerPicker } from "@/components/customer-picker";

function NovaVendaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [customer, setCustomer] = useState(null);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const presetId = params.get("customerId");
  const conversationId = params.get("conversationId");

  useEffect(() => {
    if (!presetId) return;
    api(`/api/customers/${presetId}`)
      .then((data) => setCustomer(data.customer))
      .catch((error) => toast.error(error.message));
  }, [presetId]);

  async function create(event) {
    event.preventDefault();
    if (!customer) {
      toast.error("Selecione o cliente desta venda.");
      return;
    }
    setSaving(true);
    try {
      const data = await api("/api/sale-orders", {
        method: "POST",
        json: { customerId: customer.id, observation, conversationId: conversationId || undefined },
      });
      toast.success(data.message);
      router.push(`/vendas/${data.saleOrder.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Nova venda"
        subtitle={conversationId
          ? "Venda originada de uma conversa do Contact Center. O vendedor entra ao gerar o pedido."
          : "Comece pela negociação com o cliente. O vendedor entra ao gerar o pedido."}
      />
      <Card>
        <form onSubmit={create} className="space-y-4">
          <Field label="Cliente" required>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </Field>
          <Field label="Observação inicial">
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="O que o cliente procura, faixa de preço, prazo..."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/vendas")}>Cancelar</Button>
            <Button type="submit" disabled={saving || !customer}>{saving ? "Abrindo..." : "Abrir venda"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NovaVendaPage() {
  return (
    <Suspense fallback={<p className="text-muted">Carregando...</p>}>
      <NovaVendaContent />
    </Suspense>
  );
}
