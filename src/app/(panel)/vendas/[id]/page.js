"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { ConfirmDialog, Modal } from "@/components/modal";
import { ScanField } from "@/components/scan-field";
import { SaleOrderItemBadge, SaleOrderStatusBadge, StatusBadge } from "@/components/badges";
import { SaleOrderTimeline } from "@/components/sale-order-timeline";
import { SALE_ORDER_ITEM_STATUSES, SALE_ORDER_STATUSES, WARRANTY_MONTHS } from "@/lib/constants";
import { formatCurrency, formatDate, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, PERMISSIONS } from "@/lib/permissions";

export default function VendaDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [me, setMe] = useState(null);
  const [query, setQuery] = useState("");
  const results = usePagedList();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [warranties, setWarranties] = useState({});
  const [reserveItem, setReserveItem] = useState(null);
  const [reservedUntil, setReservedUntil] = useState("");

  const load = useCallback(async () => {
    const [{ saleOrder }, { user }] = await Promise.all([
      api(`/api/sale-orders/${id}`),
      api("/api/auth/me"),
    ]);
    setOrder(saleOrder);
    setMe(user);
  }, [id]);

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, [load]);

  const items = useMemo(
    () => (order?.items || []).filter((item) => item.status !== SALE_ORDER_ITEM_STATUSES.REMOVED),
    [order],
  );
  const checkoutItems = items.filter((item) =>
    [SALE_ORDER_ITEM_STATUSES.ORDERED, SALE_ORDER_ITEM_STATUSES.RESERVED].includes(item.status),
  );
  const canCreate = me && can(me.role, PERMISSIONS.SALE_CREATE) && order && !order.closed && order.canOperate;
  const canCheckout = me && can(me.role, PERMISSIONS.SALE_CHECKOUT) && order && !order.closed;
  const canNote = me && can(me.role, PERMISSIONS.SALE_CREATE) && order?.canOperate;
  const readyForOrder = items.some((item) =>
    [SALE_ORDER_ITEM_STATUSES.RESERVED, SALE_ORDER_ITEM_STATUSES.ORDERED].includes(item.status),
  );
  const orderGenerated = Boolean(order?.orderedAt) || order?.status === SALE_ORDER_STATUSES.ORDER || order?.status === SALE_ORDER_STATUSES.PARTIAL;

  async function searchProducts(text) {
    const value = text !== undefined ? text : query;
    if (text !== undefined) setQuery(text);
    if (!String(value || "").trim()) {
      results.setItems([]);
      return;
    }
    await results.search((page, pageSize) => api(`/api/search?${listQuery({ q: value }, page, pageSize)}`));
  }

  async function run(path, json, success) {
    setSaving(true);
    try {
      const data = await api(path, { method: "POST", json });
      toast.success(success || data.message);
      setQuery("");
      results.setItems([]);
      setNote("");
      await load();
      return data;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(itemId, action, extra = {}) {
    setSaving(true);
    try {
      const data = await api(`/api/sale-orders/${order.id}/items`, {
        method: "PATCH",
        json: { itemId, action, ...extra },
      });
      toast.success(data.message);
      await load();
      return data;
    } catch (error) {
      toast.error(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function defaultReserveDate() {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function todayDate() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function openReserve(item) {
    setReserveItem(item);
    setReservedUntil(item.reservedUntil ? toInputDate(item.reservedUntil) : defaultReserveDate());
  }

  function toInputDate(value) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  async function confirmReserve() {
    if (!reserveItem) return;
    if (!reservedUntil) {
      toast.error("Informe até quando o produto ficará reservado.");
      return;
    }
    const data = await patchItem(reserveItem.id, "reserve", { reservedUntil });
    if (data) setReserveItem(null);
  }

  function openCheckout() {
    const next = {};
    checkoutItems.forEach((item) => {
      next[item.id] = String(item.warrantyMonths || 3);
    });
    setWarranties(next);
    setInvoiceNumber(checkoutItems.find((item) => item.invoiceNumber)?.invoiceNumber || "");
    setCheckoutOpen(true);
  }

  async function confirmCheckout() {
    if (!invoiceNumber.trim()) {
      toast.error("Informe o número da NF.");
      return;
    }
    const payload = {
      invoiceNumber,
      items: checkoutItems.map((item) => ({
        itemId: item.id,
        warrantyMonths: Number(warranties[item.id] || 3),
        invoiceNumber,
      })),
    };
    const data = await run(`/api/sale-orders/${order.id}/checkout`, payload);
    if (data) setCheckoutOpen(false);
  }

  if (!order || !me) return <p className="text-muted">Carregando venda...</p>;

  return (
    <div className="w-full">
      <PageHeader
        title={order.number}
        subtitle={`${order.customer?.name || "Cliente"} · ${order.unit?.name || ""}`}
        actions={
          <>
            <Link href="/vendas"><Button variant="secondary">Voltar</Button></Link>
            {canCreate && readyForOrder ? (
              <Button variant="secondary" disabled={saving} onClick={() => void run(`/api/sale-orders/${order.id}/order`, {})}>
                Gerar pedido
              </Button>
            ) : null}
            {canCheckout && orderGenerated && checkoutItems.length ? (
              <Button disabled={saving} onClick={openCheckout}>Dar baixa no caixa</Button>
            ) : null}
          </>
        }
      />

      <Card className="mb-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <SaleOrderStatusBadge status={order.status} />
        </div>
        {!order.canOperate && !order.closed ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Esta venda pertence a {order.seller?.name || "outro vendedor"}. Você pode consultar, mas não alterar o funil comercial.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info
            label="Cliente"
            value={
              order.customer?.id ? (
                <Link href={`/clientes/${order.customer.id}`} className="text-accent hover:underline">
                  {`${order.customer.name} · ${order.customer.phone}`}
                </Link>
              ) : "—"
            }
          />
          <Info label="Unidade" value={order.unit?.name} />
          <Info label="Vendedor" value={order.seller?.name} />
          <Info label="Aberto por" value={order.createdBy?.name} />
          {order.conversation?.id ? (
            <Info
              label="Conversa"
              value={
                <Link href={`/contact-center?conversationId=${order.conversation.id}`} className="text-accent hover:underline">
                  Contact Center #{order.conversation.id}
                </Link>
              }
            />
          ) : null}
          <Info label="Itens" value={`${order.itemCounts?.sold || 0} vendido(s) · ${order.itemCounts?.total || 0} no total`} />
        </div>
        {order.observation ? (
          <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface-2 p-3 text-sm">{order.observation}</p>
        ) : null}
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={saving} onClick={() => setCloseOpen("PERDIDA")}>Marcar como perdida</Button>
            <Button variant="ghost" disabled={saving} onClick={() => setCloseOpen("CANCELADA")}>Cancelar venda</Button>
          </div>
        ) : null}
      </Card>

      <Card className="mb-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Produtos</p>
          <p className="mt-1 text-sm text-muted">Inclua o interesse, reserve a unidade e só então gere o pedido para o caixa.</p>
        </div>
        {canCreate ? (
          <div>
            <Field label="Incluir produto de interesse">
              <ScanField
                value={query}
                onChange={setQuery}
                onScan={(parsed) => void searchProducts(parsed.query ?? parsed.raw ?? "")}
              />
            </Field>
            <div className="mt-3">
              <SearchActions
                loading={results.loading}
                onSearch={() => void searchProducts()}
                onClear={() => {
                  setQuery("");
                  results.setItems([]);
                }}
              />
            </div>
            {results.items.length ? (
              <div className="mt-3 divide-y divide-border rounded-xl border border-border">
                {results.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-2"
                    disabled={saving}
                    onClick={() => void run(`/api/sale-orders/${order.id}/items`, { productId: item.id }, "Produto incluído.")}
                  >
                    <img src={item.primaryImage?.fileUrl || "/logo.svg"} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{formatProductId(item.id)} · {item.commercialName || item.serialOnyx}</p>
                      <p className="text-xs text-muted">{item.category?.name} · {formatCurrency(item.cashPrice)}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </button>
                ))}
              </div>
            ) : null}
            <LoadMore
              shown={results.items.length}
              total={results.total}
              hasMore={results.hasMore}
              loading={results.loadingMore}
              onClick={() => void results.loadMore()}
            />
          </div>
        ) : null}

        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Produto</th>
                  <th className="px-3 py-3 font-semibold">Preço</th>
                  <th className="px-3 py-3 font-semibold">Estoque</th>
                  <th className="px-3 py-3 font-semibold">Na venda</th>
                  <th className="px-3 py-3 font-semibold">Prazo da reserva</th>
                  <th className="px-3 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-4">
                      <Link href={`/estoque/${item.productId}`} className="font-medium hover:text-accent">
                        {formatProductId(item.productId)} · {item.commercialName || item.product?.serialOnyx}
                      </Link>
                      <p className="text-xs text-muted">{item.product?.serialOnyx}</p>
                    </td>
                    <td className="px-3 py-4">{formatCurrency(item.cashPrice ?? item.product?.cashPrice)}</td>
                    <td className="px-3 py-4"><StatusBadge status={item.product?.status} /></td>
                    <td className="px-3 py-4"><SaleOrderItemBadge status={item.status} /></td>
                    <td className="px-3 py-4 text-muted">
                      {item.reservedUntil && (item.status === SALE_ORDER_ITEM_STATUSES.RESERVED || item.status === SALE_ORDER_ITEM_STATUSES.ORDERED)
                        ? formatDate(item.reservedUntil)
                        : "—"}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        {canCreate && item.status === SALE_ORDER_ITEM_STATUSES.INTEREST ? (
                          <Button variant="secondary" disabled={saving} onClick={() => openReserve(item)}>Reservar</Button>
                        ) : null}
                        {canCreate && (item.status === SALE_ORDER_ITEM_STATUSES.RESERVED || item.status === SALE_ORDER_ITEM_STATUSES.ORDERED) ? (
                          <>
                            <Button variant="secondary" disabled={saving} onClick={() => openReserve(item)}>Alterar prazo</Button>
                            <Button variant="secondary" disabled={saving} onClick={() => void patchItem(item.id, "unreserve")}>Liberar</Button>
                          </>
                        ) : null}
                        {canCreate && item.status !== SALE_ORDER_ITEM_STATUSES.SOLD ? (
                          <Button variant="ghost" disabled={saving} onClick={() => void patchItem(item.id, "remove")}>Remover</Button>
                        ) : null}
                        {item.status === SALE_ORDER_ITEM_STATUSES.SOLD && item.invoiceNumber ? (
                          <span className="text-xs text-muted">NF {item.invoiceNumber}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum produto nesta venda ainda.</p>
        )}
      </Card>

      <Card className="mb-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Histórico</p>
        {canNote ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!note.trim()) return;
              void run(`/api/sale-orders/${order.id}/events`, { message: note });
            }}
          >
            <Field label="Novo comentário">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Registre contato, visita, proposta..." />
            </Field>
            <Button type="submit" disabled={saving || !note.trim()}>Salvar comentário</Button>
          </form>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <SaleOrderTimeline events={order.events || []} />
      </Card>

      <Modal
        open={checkoutOpen}
        title="Baixa no caixa"
        onClose={() => !saving && setCheckoutOpen(false)}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCheckoutOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmCheckout()} disabled={saving}>
              {saving ? "Confirmando..." : "Confirmar baixa"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Confirme a NF e a garantia de cada aparelho. O status do produto só muda para Vendido nesta etapa.
          </p>
          <Field label="Número da NF" required>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          {checkoutItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">{formatProductId(item.productId)} · {item.commercialName || item.product?.serialOnyx}</p>
              <Field label="Garantia (meses)" className="mt-2">
                <Select
                  value={warranties[item.id] || "3"}
                  onChange={(e) => setWarranties((current) => ({ ...current, [item.id]: e.target.value }))}
                >
                  {WARRANTY_MONTHS.map((months) => (
                    <option key={months} value={String(months)}>{months} {months === 1 ? "mês" : "meses"}</option>
                  ))}
                </Select>
              </Field>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(reserveItem)}
        title={reserveItem && (reserveItem.status === SALE_ORDER_ITEM_STATUSES.RESERVED || reserveItem.status === SALE_ORDER_ITEM_STATUSES.ORDERED) ? "Alterar prazo da reserva" : "Reservar produto"}
        onClose={() => !saving && setReserveItem(null)}
        className="max-w-md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setReserveItem(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmReserve()} disabled={saving || !reservedUntil}>
              {saving ? "Salvando..." : "Confirmar reserva"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {reserveItem ? `${formatProductId(reserveItem.productId)} · ${reserveItem.commercialName || reserveItem.product?.serialOnyx}` : ""}
          </p>
          <p className="text-sm text-muted">
            Se o produto não for vendido até esta data, a reserva é liberada automaticamente e ele volta a ficar disponível.
          </p>
          <Field label="Reservado até" required>
            <Input type="date" min={todayDate()} value={reservedUntil} onChange={(e) => setReservedUntil(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(closeOpen)}
        title={closeOpen === "PERDIDA" ? "Marcar venda como perdida?" : "Cancelar esta venda?"}
        message="Produtos reservados voltam a ficar disponíveis. O histórico da venda é mantido."
        confirmLabel={closeOpen === "PERDIDA" ? "Marcar perdida" : "Cancelar venda"}
        danger
        loading={saving}
        onClose={() => setCloseOpen(null)}
        onConfirm={async () => {
          const data = await run(`/api/sale-orders/${order.id}/close`, { reason: closeOpen });
          if (data) setCloseOpen(null);
        }}
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
