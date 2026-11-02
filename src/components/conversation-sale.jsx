"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Field, Input } from "@/components/ui";
import { SaleOrderItemBadge, SaleOrderStatusBadge } from "@/components/badges";
import { SALE_ORDER_ITEM_STATUSES, STATUSES } from "@/lib/constants";
import { formatCurrency, formatProductId } from "@/lib/format";
import { listQuery } from "@/lib/pagination";

function defaultReserveDate() {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function ConversationSale({ saleId, canEdit, onChanged }) {
  const [order, setOrder] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reserveUntil, setReserveUntil] = useState(defaultReserveDate);

  const load = useCallback(async () => {
    const data = await api(`/api/sale-orders/${saleId}`);
    setOrder(data.saleOrder);
  }, [saleId]);

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, [load]);

  async function search(event) {
    event?.preventDefault();
    const value = query.trim();
    if (!value) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api(`/api/search?${listQuery({ q: value }, 1, 8)}`);
      setResults((data.items || []).filter((item) => item.status === STATUSES.AVAILABLE));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSearching(false);
    }
  }

  async function mutate(path, body, success) {
    setSaving(true);
    try {
      const { method = "POST", ...json } = body;
      const data = await api(path, { method, json });
      toast.success(success || data.message);
      setQuery("");
      setResults([]);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!order) return <p className="mt-2 text-xs text-muted">Carregando venda...</p>;
  const editable = canEdit && order.canOperate && !order.closed;
  const items = (order.items || []).filter((item) => item.status !== SALE_ORDER_ITEM_STATUSES.REMOVED);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/vendas/${order.id}`} className="font-medium text-accent hover:underline">{order.number}</Link>
        <SaleOrderStatusBadge status={order.status} />
      </div>
      {editable ? (
        <form onSubmit={search} className="space-y-2">
          <Field label="Incluir produto">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Serial, nome ou código" />
          </Field>
          <Button type="submit" variant="secondary" disabled={searching || saving}>{searching ? "Buscando..." : "Buscar"}</Button>
          {results.length ? (
            <ul className="space-y-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={saving}
                    className="w-full rounded-lg border border-border px-2 py-2 text-left text-xs hover:bg-surface-2"
                    onClick={() => void mutate(`/api/sale-orders/${order.id}/items`, { productId: item.id }, "Produto incluído na negociação.")}
                  >
                    <span className="font-medium">{formatProductId(item.id)} · {item.commercialName || item.serialOnyx}</span>
                    <span className="mt-0.5 block text-muted">{formatCurrency(item.cashPrice)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}
      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-2 text-xs">
              <p className="font-medium">{formatProductId(item.productId)} · {item.commercialName || item.product?.serialOnyx}</p>
              <div className="mt-1"><SaleOrderItemBadge status={item.status} /></div>
              {editable && item.status === SALE_ORDER_ITEM_STATUSES.INTEREST ? (
                <div className="mt-2 flex items-center gap-2">
                  <Input type="date" value={reserveUntil} onChange={(e) => setReserveUntil(e.target.value)} className="h-8" />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 px-2 text-xs"
                    disabled={saving || !reserveUntil}
                    onClick={() => void mutate(
                      `/api/sale-orders/${order.id}/items`,
                      { method: "PATCH", itemId: item.id, action: "reserve", reservedUntil: reserveUntil },
                      "Produto reservado.",
                    )}
                  >
                    Reservar
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">Nenhum produto nesta venda.</p>}
    </div>
  );
}
