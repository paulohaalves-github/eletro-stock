"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SaleOrderStatusBadge, WorkOrderStatusBadge, WorkOrderTypeBadge } from "@/components/badges";
import { Modal } from "@/components/modal";
import { SERVICE_PLACE_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatProductId, formatWarrantyRemaining } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";
import { CustomerPhonesFields, phonesFromCustomer } from "@/components/customer-phones";

export default function ClienteDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ customer: item }, { user }] = await Promise.all([
      api(`/api/customers/${id}`),
      api("/api/auth/me"),
    ]);
    setCustomer(item);
    setMe(user);
    setForm({
      name: item.name || "",
      phones: phonesFromCustomer(item),
      document: item.document || "",
      email: item.email || "",
      address: item.address || "",
      notes: item.notes || "",
    });
  }, [id]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err.message);
      toast.error(err.message);
    });
  }, [load]);

  if (error) return <p className="text-muted">{error}</p>;
  if (!customer || !me || !form) return <p className="text-muted">Carregando cliente...</p>;

  const canManage = can(me.role, PERMISSIONS.CUSTOMER_MANAGE);
  const canViewProduct = can(me.role, PERMISSIONS.PRODUCT_VIEW);
  const canViewRepair = can(me.role, PERMISSIONS.REPAIR_VIEW);
  const canViewSales = can(me.role, PERMISSIONS.SALE_VIEW);
  const canCreateSale = can(me.role, PERMISSIONS.SALE_CREATE);
  const sales = customer.sales || [];
  const saleOrders = customer.saleOrders || [];
  const workOrders = customer.workOrders || [];

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setForm({
      name: customer.name || "",
      phones: phonesFromCustomer(customer),
      document: customer.document || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api(`/api/customers/${customer.id}`, { method: "PATCH", json: form });
      toast.success(data.message);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title={customer.name}
        subtitle={`${customer.phoneLabel || customer.phone}${customer.document ? ` · ${customer.document}` : ""}`}
        actions={
          <>
            <Link href="/clientes"><Button variant="secondary">Voltar</Button></Link>
            {canCreateSale ? (
              <Link href={`/vendas/novo?customerId=${customer.id}`}><Button variant="secondary">Nova venda</Button></Link>
            ) : null}
            {canManage ? <Button onClick={() => setOpen(true)}>Editar</Button> : null}
          </>
        }
      />

      <Card className="mb-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Dados de contato</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Info
            label="Telefones"
            value={
              customer.phones?.length ? (
                <span className="flex flex-col gap-1">
                  {customer.phones.map((item) => (
                    <a key={item.id || item.phone} href={`tel:${item.phone}`} className="hover:text-accent">
                      {item.display || item.phone}
                      {item.label ? <span className="ml-1 font-normal text-muted">· {item.label}</span> : null}
                      {item.primary ? <span className="ml-1 font-normal text-muted">· principal</span> : null}
                    </a>
                  ))}
                </span>
              ) : customer.phone ? (
                <a href={`tel:${customer.phone}`} className="hover:text-accent">{customer.phone}</a>
              ) : null
            }
          />
          <Info
            label="E-mail"
            value={customer.email ? <a href={`mailto:${customer.email}`} className="hover:text-accent">{customer.email}</a> : null}
          />
          <Info label="CPF/CNPJ" value={customer.document} />
          <Info label="Endereço" value={customer.address} className="sm:col-span-2" />
          <Info label="Cadastrado por" value={customer.createdBy?.name} />
          <Info label="Cadastro" value={formatDateTime(customer.createdAt)} />
        </div>
        {customer.notes ? (
          <div className="border-t border-border pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted">Observação</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{customer.notes}</p>
          </div>
        ) : null}
      </Card>

      {canViewSales ? (
        <HistoryCard
          title="Pedidos de venda"
          description="Interesse, reserva e concretização vinculados a este cliente."
          truncated={saleOrders.length >= 50}
        >
          {saleOrders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Venda</th>
                    <th className="px-5 py-3 font-semibold">Vendedor</th>
                    <th className="px-5 py-3 font-semibold">Itens</th>
                    <th className="px-5 py-3 font-semibold">Unidade</th>
                    <th className="px-5 py-3 font-semibold">Abertura</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {saleOrders.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-5 py-4 font-medium">
                        <Link href={`/vendas/${item.id}`} className="text-accent hover:underline">{item.number}</Link>
                      </td>
                      <td className="px-5 py-4 text-muted">{item.seller?.name || "—"}</td>
                      <td className="px-5 py-4 text-muted">{item.itemCount || 0}</td>
                      <td className="px-5 py-4 text-muted">{item.unit?.name || "—"}</td>
                      <td className="px-5 py-4 text-muted">{formatDateTime(item.createdAt)}</td>
                      <td className="px-5 py-4"><SaleOrderStatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">Nenhum pedido de venda encontrado.</p>
          )}
        </HistoryCard>
      ) : null}

      <HistoryCard
        title="Histórico de vendas"
        description="Vendas com garantia vinculadas a este cliente."
        truncated={sales.length >= 50}
      >
        {sales.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">Produto</th>
                  <th className="px-5 py-3 font-semibold">NF</th>
                  <th className="px-5 py-3 font-semibold">Unidade</th>
                  <th className="px-5 py-3 font-semibold">Garantia</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t border-border">
                    <td className="px-5 py-4">{formatDate(sale.soldAt)}</td>
                    <td className="px-5 py-4">
                      <ProductLink
                        enabled={canViewProduct}
                        productId={sale.productId}
                        label={`${formatProductId(sale.productId)} · ${sale.commercialName || sale.product?.serialOnyx || "—"}`}
                      />
                    </td>
                    <td className="px-5 py-4 text-muted">{sale.invoiceNumber || "—"}</td>
                    <td className="px-5 py-4 text-muted">{sale.unit?.name || "—"}</td>
                    <td className="px-5 py-4">
                      <p className={sale.warrantyValid ? "text-emerald-400" : "text-muted"}>
                        {formatWarrantyRemaining(sale.soldAt, sale.warrantyMonths) || `${sale.warrantyMonths || "—"} meses`}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma venda encontrada.</p>
        )}
      </HistoryCard>

      <HistoryCard
        title="Ordens de serviço"
        description="Reparos abertos para este cliente."
        truncated={workOrders.length >= 50}
      >
        {workOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">OS</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Produto</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Local</th>
                  <th className="px-5 py-3 font-semibold">Abertura</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-5 py-4 font-medium">
                      {canViewRepair ? (
                        <Link href={`/reparos/${order.id}`} className="text-accent hover:underline">{order.number}</Link>
                      ) : order.number}
                    </td>
                    <td className="px-5 py-4"><WorkOrderTypeBadge type={order.type} /></td>
                    <td className="px-5 py-4">
                      <ProductLink
                        enabled={canViewProduct}
                        productId={order.productId}
                        label={`${formatProductId(order.productId)} · ${order.commercialName || order.product?.serialOnyx || "—"}`}
                      />
                    </td>
                    <td className="px-5 py-4"><WorkOrderStatusBadge status={order.status} /></td>
                    <td className="px-5 py-4 text-muted">{SERVICE_PLACE_LABELS[order.servicePlace] || order.servicePlace}</td>
                    <td className="px-5 py-4 text-muted">{formatDateTime(order.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">Nenhuma ordem de serviço encontrada.</p>
        )}
      </HistoryCard>

      <Modal
        open={open}
        title="Editar cliente"
        onClose={closeModal}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="customer-edit-form" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </>
        }
      >
        <form id="customer-edit-form" onSubmit={save} className="space-y-3">
          <Field label="Nome" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <CustomerPhonesFields value={form.phones} onChange={(phones) => setForm({ ...form, phones })} />
          <Field label="CPF/CNPJ"><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Endereço" required><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /></Field>
          <Field label="Observação"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  );
}

function HistoryCard({ title, description, truncated, children }) {
  return (
    <Card className="mb-4 w-full overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
        {truncated ? <p className="mt-1 text-xs text-muted">Mostrando as 50 mais recentes.</p> : null}
      </div>
      {children}
    </Card>
  );
}

function ProductLink({ enabled, productId, label }) {
  if (!enabled || !productId) return <span>{label}</span>;
  return <Link href={`/estoque/${productId}`} className="hover:text-accent">{label}</Link>;
}

function Info({ label, value, className }) {
  return (
    <div className={className}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
