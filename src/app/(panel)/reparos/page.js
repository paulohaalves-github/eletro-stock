"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { WorkOrderStatusBadge } from "@/components/badges";
import { SERVICE_PLACE_LABELS, WORK_ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatProductId } from "@/lib/format";
import { can, PERMISSIONS } from "@/lib/permissions";

export default function ReparosPage() {
  const router = useRouter();
  const [data, setData] = useState({ items: [], total: 0 });
  const [me, setMe] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [servicePlace, setServicePlace] = useState("");

  const query = useMemo(() => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status) search.set("status", status);
    if (servicePlace) search.set("servicePlace", servicePlace);
    return search.toString();
  }, [q, status, servicePlace]);

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      api(`/api/work-orders?${query}`).then(setData).catch((error) => toast.error(error.message));
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  const canCreate = me && can(me.role, PERMISSIONS.REPAIR_CREATE);

  return (
    <div className="w-full">
      <PageHeader
        title="Ordens de serviço"
        subtitle="Acompanhe o reparo na garantia, no laboratório do grupo ou na casa do cliente."
        actions={canCreate ? <Button onClick={() => router.push("/reparos/novo")}>Nova OS</Button> : null}
      />
      <Card className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="OS, serial, cliente ou defeito" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select value={servicePlace} onChange={(e) => setServicePlace(e.target.value)}>
          <option value="">Todos os locais</option>
          {Object.entries(SERVICE_PLACE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Card>

      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">OS</th>
                <th className="px-5 py-3 font-semibold">Produto</th>
                <th className="px-5 py-3 font-semibold">Cliente</th>
                <th className="px-5 py-3 font-semibold">Local</th>
                <th className="px-5 py-3 font-semibold">Abertura</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-border hover:bg-surface-2/80"
                  onClick={() => router.push(`/reparos/${item.id}`)}
                >
                  <td className="px-5 py-4 font-semibold text-accent">{item.number}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.commercialName || item.product?.serialOnyx}</p>
                    <p className="text-xs text-muted">{formatProductId(item.productId)}</p>
                  </td>
                  <td className="px-5 py-4">{item.customer?.name}</td>
                  <td className="px-5 py-4 text-muted">{SERVICE_PLACE_LABELS[item.servicePlace]}</td>
                  <td className="px-5 py-4 text-muted">{formatDateTime(item.openedAt)}</td>
                  <td className="px-5 py-4"><WorkOrderStatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma ordem de serviço encontrada.</p> : null}
      </Card>
    </div>
  );
}
