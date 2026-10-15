"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, PageHeader, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/modal";
import { InventoryStatusBadge } from "@/components/badges";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime, formatLocationPath } from "@/lib/format";

export default function InventariosPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ assignedToId: "", locationId: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api("/api/inventories");
      setItems(data.items || []);
      setCanManage(Boolean(data.canManage));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openCreate() {
    setForm({ assignedToId: "", locationId: "", notes: "" });
    setOpen(true);
    try {
      const [people, places] = await Promise.all([
        api("/api/inventories/assignees"),
        api("/api/locations?active=true"),
      ]);
      setAssignees(people.items || []);
      setLocations(places.items || []);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function createInventory() {
    if (!form.assignedToId) {
      toast.error("Designe quem vai bipar o inventário.");
      return;
    }
    setSaving(true);
    try {
      const data = await api("/api/inventories", {
        method: "POST",
        json: {
          assignedToId: Number(form.assignedToId),
          locationId: form.locationId ? Number(form.locationId) : null,
          notes: form.notes,
        },
      });
      toast.success(data.message);
      setOpen(false);
      router.push(`/inventarios/${data.inventory.id}`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventários"
        subtitle="Conferência física do estoque. O gestor abre e designa quem bipa. A conclusão mostra faltantes e sobrantes, sem alterar o saldo."
        actions={canManage ? <Button onClick={openCreate}>Novo inventário</Button> : null}
      />

      {loading ? <p className="text-sm text-muted">Carregando...</p> : null}

      {!loading && items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {canManage
              ? "Nenhum inventário nesta unidade. Abra um para congelar o estoque esperado e designar a bipagem."
              : "Nenhum inventário designado para você."}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.id} href={`/inventarios/${item.id}`} className="block">
            <Card className="transition hover:border-accent/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.number}</p>
                    <InventoryStatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {item.unit?.name} · {item.scopeLabel}
                  </p>
                  <p className="mt-1 text-sm">
                    Designado para {item.assignedTo?.name} · aberto em {formatDateTime(item.createdAt)} por {item.createdBy?.name}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  <Count label="Esperados" value={item.counts.expected} />
                  <Count label="Conferidos" value={item.counts.matched} />
                  <Count label="Faltantes" value={item.counts.missing} />
                  <Count label="Sobrantes" value={item.counts.surplus} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Modal
        open={open}
        title="Abrir inventário"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Fechar</Button>
            <Button type="button" onClick={createInventory} disabled={saving}>
              {saving ? "Abrindo..." : "Abrir inventário"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <p className="text-sm text-muted">
            A foto do estoque é tirada agora. Enquanto o inventário estiver aberto, entrada, saída, transferência e reparo desta unidade ficam bloqueados.
          </p>
          <Field label="Quem vai bipar" required>
            <Select value={form.assignedToId} onChange={(event) => setForm((current) => ({ ...current, assignedToId: event.target.value }))}>
              <option value="">Selecione</option>
              {assignees.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({ROLE_LABELS[user.role] || user.role})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Localização" hint="Em branco, a unidade inteira entra na conferência.">
            <Select value={form.locationId} onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}>
              <option value="">Unidade inteira</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {formatLocationPath(location) || location.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observação">
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Opcional"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Count({ label, value }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}
