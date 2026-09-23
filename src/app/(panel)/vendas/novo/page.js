"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { CustomerPicker } from "@/components/customer-picker";
import { canManageAllSaleOrders } from "@/lib/permissions";

function NovaVendaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [customer, setCustomer] = useState(null);
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState(null);
  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState("");
  const presetId = params.get("customerId");
  const conversationId = params.get("conversationId");

  useEffect(() => {
    api("/api/auth/me")
      .then((auth) => {
        setMe(auth.user);
        setSellerId(String(auth.user?.id || ""));
      })
      .catch((error) => toast.error(error.message));
    api("/api/sale-orders/sellers")
      .then((data) => setSellers(data.items || []))
      .catch((error) => toast.error(error.message));
  }, []);

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
    if (me && canManageAllSaleOrders(me.role) && !sellerId) {
      toast.error("Selecione o vendedor desta venda.");
      return;
    }
    setSaving(true);
    try {
      const data = await api("/api/sale-orders", {
        method: "POST",
        json: { customerId: customer.id, observation, sellerId: sellerId || undefined, conversationId: conversationId || undefined },
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
          ? "Venda originada de uma conversa do Contact Center. Confirme o cliente e o vendedor."
          : "Comece pelo interesse do cliente. Depois reserve os produtos e gere o pedido para o caixa."}
      />
      <Card>
        <form onSubmit={create} className="space-y-4">
          <Field label="Cliente" required>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </Field>
          {me && canManageAllSaleOrders(me.role) ? (
            <Field label="Vendedor" required>
              <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                <option value="">Selecione o vendedor</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Observação inicial">
            <Textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="O que o cliente procura, faixa de preço, prazo..."
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => router.push("/vendas")}>Cancelar</Button>
            <Button type="submit" disabled={saving || !customer || (me && canManageAllSaleOrders(me.role) && !sellerId)}>{saving ? "Abrindo..." : "Abrir venda"}</Button>
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
