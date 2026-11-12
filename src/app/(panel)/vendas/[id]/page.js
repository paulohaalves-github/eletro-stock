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
import {
  SALE_INSTALLMENT_COUNTS,
  SALE_ORDER_ITEM_STATUSES,
  SALE_ORDER_STATUSES,
  SALE_PAYMENT_METHODS,
  WARRANTY_MONTHS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, canManageAllSaleOrders, PERMISSIONS } from "@/lib/permissions";

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
  const [soldAt, setSoldAt] = useState("");
  const [ov, setOv] = useState("");
  const [warranties, setWarranties] = useState({});
  const [prices, setPrices] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installmentCount, setInstallmentCount] = useState("1");
  const [reserveItem, setReserveItem] = useState(null);
  const [reservedUntil, setReservedUntil] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState("");

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
  const canCreate = me && can(me, PERMISSIONS.SALE_CREATE) && order && !order.closed && order.canOperate;
  const canCheckout = me && can(me, PERMISSIONS.SALE_CHECKOUT) && order && !order.closed;
  const canNote = me && can(me, PERMISSIONS.SALE_CREATE) && order?.canOperate;
  const canManageSales = me && canManageAllSaleOrders(me);
  const canCancelClosed = canManageSales && order && (
    order.status === SALE_ORDER_STATUSES.COMPLETED || order.status === SALE_ORDER_STATUSES.PARTIAL
  );
  const canRevert = canManageSales && order && (
    order.status === SALE_ORDER_STATUSES.COMPLETED || order.status === SALE_ORDER_STATUSES.PARTIAL
  ) && (order.itemCounts?.sold || 0) > 0;
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
    const nextWarranties = {};
    const nextPrices = {};
    checkoutItems.forEach((item) => {
      nextWarranties[item.id] = String(item.warrantyMonths || 3);
      const amount = item.cashPrice ?? item.product?.cashPrice;
      nextPrices[item.id] = amount == null || amount === "" ? "" : String(amount);
    });
    setWarranties(nextWarranties);
    setPrices(nextPrices);
    setInvoiceNumber(checkoutItems.find((item) => item.invoiceNumber)?.invoiceNumber || "");
    setSoldAt(todayDate());
    setOv(order?.ov || "");
    setPaymentMethod(order?.paymentMethod || "");
    setInstallmentCount(order?.installmentCount ? String(order.installmentCount) : "1");
    setCheckoutOpen(true);
  }

  async function confirmCheckout() {
    if (!soldAt) {
      toast.error("Informe a data da venda.");
      return;
    }
    const method = String(paymentMethod || "").trim();
    if (!method) {
      toast.error("Informe a forma de pagamento.");
      return;
    }
    const parcels = Number(installmentCount);
    if (!Number.isInteger(parcels) || parcels < 1) {
      toast.error("Informe a quantidade de parcelas.");
      return;
    }
    for (const item of checkoutItems) {
      const raw = String(prices[item.id] ?? "").trim().replace(",", ".");
      const amount = Number(raw);
      if (!raw || !Number.isFinite(amount) || amount < 0) {
        toast.error(`Informe o valor vendido de ${formatProductId(item.productId)}.`);
        return;
      }
    }
    const payload = {
      invoiceNumber,
      soldAt,
      ov,
      paymentMethod: method,
      installmentCount: parcels,
      items: checkoutItems.map((item) => ({
        itemId: item.id,
        warrantyMonths: Number(warranties[item.id] || 3),
        invoiceNumber,
        cashPrice: Number(String(prices[item.id]).trim().replace(",", ".")),
        paymentMethod: method,
        installmentCount: parcels,
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
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setSellerId(order.seller?.id ? String(order.seller.id) : "");
                  setOrderOpen(true);
                  api("/api/sale-orders/sellers")
                    .then((data) => setSellers(data.items || []))
                    .catch((error) => toast.error(error.message));
                }}
              >
                Gerar pedido
              </Button>
            ) : null}
            {canCheckout && orderGenerated && checkoutItems.length ? (
              <Button disabled={saving} onClick={openCheckout}>Dar baixa no caixa</Button>
            ) : null}
            {canRevert ? (
              <Button variant="secondary" disabled={saving} onClick={() => setRevertOpen(true)}>
                Retroagir para reservada
              </Button>
            ) : null}
            {canCancelClosed ? (
              <Button variant="danger" disabled={saving} onClick={() => setCancelOpen(true)}>
                Cancelar venda
              </Button>
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
            Esta venda pertence a {order.seller?.name || order.createdBy?.name || "outro usuário"}. Você pode consultar, mas não alterar o funil comercial.
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
          <Info label="Vendedor" value={order.seller?.name || "A definir"} />
          {!order.seller ? (
            <p className="text-xs text-muted">O vendedor será definido ao gerar o pedido.</p>
          ) : null}
          <Info label="OV" value={order.ov || "—"} />
          {order.paymentMethod || order.installmentCount ? (
            <Info
              label="Pagamento"
              value={`${order.paymentMethod || "—"}${order.installmentCount ? ` · ${order.installmentCount}x` : ""}`}
            />
          ) : null}
          <Info label="Aberto por" value={order.createdBy?.name} />
          <Info
            label="Vendida em"
            value={order.soldAt ? formatDateTime(order.soldAt) : "—"}
          />
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
        {canCancelClosed && !canCreate ? (
          <p className="text-sm text-muted">
            Cancelar devolve os produtos ao estoque e mantém esta venda como cancelada na lista.
          </p>
        ) : null}
      </Card>

      <Card className="mb-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Produtos</p>
          <p className="mt-1 text-sm text-muted">Inclua o produto na negociação, reserve a unidade e só então gere o pedido para o caixa.</p>
        </div>
        {canCreate ? (
          <div>
            <Field label="Incluir produto na negociação">
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
            Informe a data da venda, forma de pagamento, valor vendido de cada produto e, se houver, a OV do Care e a NF. O status do produto só muda para Vendido nesta etapa.
          </p>
          <Field label="Data da venda" required>
            <Input type="date" max={todayDate()} value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Forma de pagamento" required>
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="">Selecione</option>
                {SALE_PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </Select>
            </Field>
            <Field label="Parcelas" required hint="1x = à vista; 2x ou mais = a prazo.">
              <Select value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)}>
                {SALE_INSTALLMENT_COUNTS.map((count) => (
                  <option key={count} value={String(count)}>{count}x</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="OV do Care">
            <Input value={ov} maxLength={40} onChange={(e) => setOv(e.target.value)} placeholder="Ex.: 667501" />
          </Field>
          <Field label="Número da NF">
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          {checkoutItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">{formatProductId(item.productId)} · {item.commercialName || item.product?.serialOnyx}</p>
              <Field label="Valor vendido" required className="mt-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={prices[item.id] ?? ""}
                  onChange={(e) => setPrices((current) => ({ ...current, [item.id]: e.target.value }))}
                />
              </Field>
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
        open={orderOpen}
        title="Gerar pedido"
        onClose={() => !saving && setOrderOpen(false)}
        className="max-w-md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOrderOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              type="button"
              disabled={saving || !sellerId}
              onClick={() => {
                void run(`/api/sale-orders/${order.id}/order`, { sellerId }, "Pedido de venda gerado.").then((data) => {
                  if (data) setOrderOpen(false);
                });
              }}
            >
              {saving ? "Gerando..." : "Gerar pedido"}
            </Button>
          </>
        }
      >
        <Field label="Vendedor" required hint="O vendedor da venda é definido neste momento.">
          <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
            <option value="">Selecione o vendedor</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>{seller.name}</option>
            ))}
          </Select>
        </Field>
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
        open={cancelOpen}
        title="Cancelar esta venda?"
        message="A venda permanece na lista como Cancelada. Produtos reservados ou já baixados voltam a ficar disponíveis, e a baixa sai do histórico. Se houver ordem de serviço aberta no produto, o cancelamento é bloqueado."
        confirmLabel="Cancelar venda"
        danger
        loading={saving}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => {
          setSaving(true);
          try {
            const data = await api(`/api/sale-orders/${order.id}`, { method: "DELETE" });
            toast.success(data.message || "Venda cancelada.");
            setCancelOpen(false);
            await load();
          } catch (error) {
            toast.error(error.message);
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={revertOpen}
        title="Retroagir para reservada?"
        message="Os produtos baixados voltam para Reservado nesta mesma venda. A baixa sai do histórico e a venda deixa de ficar concretizada."
        confirmLabel="Retroagir venda"
        danger
        loading={saving}
        onClose={() => setRevertOpen(false)}
        onConfirm={async () => {
          const data = await run(`/api/sale-orders/${order.id}/revert`, {}, "Venda retroagida para reservada.");
          if (data) setRevertOpen(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(closeOpen)}
        title={closeOpen === "PERDIDA" ? "Marcar venda como perdida?" : "Cancelar esta venda?"}
        message={
          closeOpen === "PERDIDA"
            ? "Produtos reservados voltam a ficar disponíveis. O histórico da venda é mantido."
            : "A venda permanece na lista como Cancelada. Produtos reservados ou já baixados voltam a ficar disponíveis."
        }
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
