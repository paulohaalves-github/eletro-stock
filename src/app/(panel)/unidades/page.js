"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { Modal } from "@/components/modal";
import { BRAZIL_UFS, UNIT_TYPE_LABELS, UNIT_TYPES } from "@/lib/constants";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";

const EMPTY_FORM = {
  name: "",
  type: UNIT_TYPES.BRANCH,
  email: "",
  phone: "",
  phoneSecondary: "",
  whatsapp: "",
  street: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  zipCode: "",
  latitude: "",
  longitude: "",
  catalogVisible: false,
};

function formFromUnit(item) {
  if (!item) return { ...EMPTY_FORM };
  return {
    name: item.name || "",
    type: item.type || UNIT_TYPES.BRANCH,
    email: item.email || "",
    phone: item.phone || "",
    phoneSecondary: item.phoneSecondary || "",
    whatsapp: item.whatsapp || "",
    street: item.street || "",
    addressNumber: item.addressNumber || "",
    neighborhood: item.neighborhood || "",
    city: item.city || "",
    state: item.state || "",
    zipCode: item.zipCode || "",
    latitude: item.latitude == null ? "" : String(item.latitude),
    longitude: item.longitude == null ? "" : String(item.longitude),
    catalogVisible: item.type === UNIT_TYPES.LAB ? false : Boolean(item.catalogVisible),
  };
}

function placeLabel(item) {
  return [item.city, item.state].filter(Boolean).join(" - ") || "Sem endereço";
}

export default function UnidadesPage() {
  const router = useRouter();
  const list = usePagedList();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function loader(page, pageSize) {
    return api(`/api/units?all=1&${listQuery({ q }, page, pageSize)}`);
  }

  useEffect(() => {
    void list.search(loader).catch((error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm(formFromUnit(item));
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  }

  function updateForm(patch) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (next.type === UNIT_TYPES.LAB) next.catalogVisible = false;
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      catalogVisible: form.type === UNIT_TYPES.LAB ? false : form.catalogVisible,
    };
    try {
      const data = editing
        ? await api(`/api/units/${editing.id}`, { method: "PATCH", json: payload })
        : await api("/api/units", { method: "POST", json: payload });
      toast.success(data.message);
      setOpen(false);
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      await list.search(loader);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    try {
      const data = await api(`/api/units/${item.id}`, { method: "PATCH", json: { active: !item.active } });
      toast.success(data.message);
      await list.search(loader);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    }
  }

  const isLab = form.type === UNIT_TYPES.LAB;
  const mapHref = form.latitude.trim() && form.longitude.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude.trim()},${form.longitude.trim()}`)}`
    : "";

  return (
    <div className="w-full">
      <PageHeader
        title="Unidades"
        subtitle="Cadastre o contato e o endereço de cada loja. Matriz e filial podem aparecer no catálogo; o laboratório fica só no estoque."
        actions={<Button onClick={openCreate}>Nova unidade</Button>}
      />
      <Card className="mb-4 space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou cidade" />
        <SearchActions
          loading={list.loading}
          onSearch={() => void list.search(loader)}
          onClear={() => {
            setQ("");
            void list.search((page, pageSize) => api(`/api/units?all=1&${listQuery({ q: "" }, page, pageSize)}`));
          }}
        />
      </Card>
      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Cidade</th>
                <th className="px-5 py-3 font-semibold">Catálogo</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr key={item.id} className="border-t border-border align-top hover:bg-surface-2/80">
                  <td className="px-5 py-4">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">{item.email || item.phone || item.slug}</p>
                  </td>
                  <td className="px-5 py-4 text-muted">{UNIT_TYPE_LABELS[item.type] || item.type}</td>
                  <td className="px-5 py-4 text-muted">{placeLabel(item)}</td>
                  <td className="px-5 py-4 text-muted">
                    {item.type === UNIT_TYPES.LAB ? "Não se aplica" : item.catalogVisible ? "Visível" : "Oculta"}
                  </td>
                  <td className="px-5 py-4 text-muted">{item.active ? "Ativa" : "Inativa"}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(item)}>Editar</Button>
                      <Button variant="ghost" onClick={() => toggleActive(item)}>
                        {item.active ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <LoadMore shown={list.items.length} total={list.total} hasMore={list.hasMore} loading={list.loadingMore} onClick={() => void list.loadMore()} />

      <Modal
        open={open}
        title={editing ? "Editar unidade" : "Nova unidade"}
        onClose={closeModal}
        className="max-w-3xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="unit-form" disabled={saving || !form.name.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </>
        }
      >
        <form id="unit-form" onSubmit={submit} className="space-y-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Identificação</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome da unidade" required>
                <Input
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="Ex.: Onyx Outlet"
                />
              </Field>
              <Field label="Tipo">
                <Select value={form.type} onChange={(e) => updateForm({ type: e.target.value })}>
                  {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contato</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail">
                <Input type="email" value={form.email} onChange={(e) => updateForm({ email: e.target.value })} placeholder="gestao@onyxtech.com.br" />
              </Field>
              <Field label="WhatsApp do pedido">
                <Input value={form.whatsapp} onChange={(e) => updateForm({ whatsapp: e.target.value })} placeholder="(31) 99999-9999" />
              </Field>
              <Field label="Telefone">
                <Input value={form.phone} onChange={(e) => updateForm({ phone: e.target.value })} placeholder="(31) 2559-1649" />
              </Field>
              <Field label="Segundo telefone">
                <Input value={form.phoneSecondary} onChange={(e) => updateForm({ phoneSecondary: e.target.value })} placeholder="Opcional" />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Endereço</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CEP">
                <Input value={form.zipCode} onChange={(e) => updateForm({ zipCode: e.target.value })} placeholder="32210-110" />
              </Field>
              <Field label="UF">
                <Select value={form.state} onChange={(e) => updateForm({ state: e.target.value })}>
                  <option value="">Selecione</option>
                  {BRAZIL_UFS.map(([code, label]) => (
                    <option key={code} value={code}>{code} — {label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Logradouro" className="sm:col-span-2">
                <Input value={form.street} onChange={(e) => updateForm({ street: e.target.value })} placeholder="Avenida General David Sarnoff" />
              </Field>
              <Field label="Número">
                <Input value={form.addressNumber} onChange={(e) => updateForm({ addressNumber: e.target.value })} placeholder="5220" />
              </Field>
              <Field label="Bairro">
                <Input value={form.neighborhood} onChange={(e) => updateForm({ neighborhood: e.target.value })} placeholder="Cidade Industrial" />
              </Field>
              <Field label="Cidade" className="sm:col-span-2">
                <Input value={form.city} onChange={(e) => updateForm({ city: e.target.value })} placeholder="Contagem" />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mapa</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude" hint="No Google Maps, clique com o botão direito no ponto da loja e copie o primeiro número.">
                <Input value={form.latitude} onChange={(e) => updateForm({ latitude: e.target.value })} placeholder="-19.9550000" inputMode="decimal" />
              </Field>
              <Field label="Longitude" hint="O segundo número das coordenadas.">
                <Input value={form.longitude} onChange={(e) => updateForm({ longitude: e.target.value })} placeholder="-44.0550000" inputMode="decimal" />
              </Field>
            </div>
            {mapHref ? (
              <a href={mapHref} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent hover:underline">
                Abrir este ponto no Google Maps
              </a>
            ) : null}
          </section>

          <section>
            <label className={`flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 ${isLab ? "opacity-60" : ""}`}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                checked={form.catalogVisible}
                disabled={isLab}
                onChange={(e) => updateForm({ catalogVisible: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium">Aparecer no catálogo</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {isLab
                    ? "O laboratório não é ponto de retirada e fica fora do catálogo."
                    : "O cliente vê o contato e o endereço desta loja ao consultar os produtos disponíveis."}
                </span>
              </span>
            </label>
          </section>
        </form>
      </Modal>
    </div>
  );
}
