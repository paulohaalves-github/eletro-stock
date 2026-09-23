"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { LoadMore, SearchActions } from "@/components/paged-list";
import { Modal } from "@/components/modal";
import { listQuery } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import { can, PERMISSIONS } from "@/lib/permissions";
import { CustomerPhonesFields, emptyPhoneRow } from "@/components/customer-phones";

const empty = { name: "", phones: [emptyPhoneRow()], document: "", email: "", address: "", notes: "" };

export default function ClientesPage() {
  const router = useRouter();
  const list = usePagedList();
  const [q, setQ] = useState("");
  const [form, setForm] = useState(empty);
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function loader(page, pageSize) {
    return api(`/api/customers?${listQuery({ q }, page, pageSize)}`);
  }

  useEffect(() => {
    api("/api/auth/me").then((auth) => setMe(auth.user)).catch((error) => toast.error(error.message));
    void list.search(loader);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canManage = me && can(me.role, PERMISSIONS.CUSTOMER_MANAGE);

  function closeModal() {
    if (saving) return;
    setOpen(false);
    setForm(empty);
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api("/api/customers", { method: "POST", json: form });
      toast.success(data.message);
      setForm(empty);
      setOpen(false);
      void list.search(loader);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Clientes"
        subtitle="Cadastro, ficha e histórico de vendas e ordens de serviço."
        actions={canManage ? <Button onClick={() => { setForm(empty); setOpen(true); }}>Novo cliente</Button> : null}
      />

      <Card className="mb-4 space-y-3">
        <Field label="Buscar">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone ou documento" />
        </Field>
        <SearchActions
          loading={list.loading}
          onSearch={() => void list.search(loader)}
          onClear={() => {
            setQ("");
            void list.search((page, pageSize) => api(`/api/customers?${listQuery({ q: "" }, page, pageSize)}`));
          }}
        />
      </Card>

      <Card className="w-full overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Telefone</th>
                <th className="px-5 py-3 font-semibold">Documento</th>
                <th className="px-5 py-3 font-semibold">Endereço</th>
                <th className="px-5 py-3 font-semibold">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-t border-border hover:bg-surface-2/80"
                  onClick={() => router.push(`/clientes/${item.id}`)}
                >
                  <td className="px-5 py-4 font-medium">
                    <Link href={`/clientes/${item.id}`} className="hover:text-accent" onClick={(event) => event.stopPropagation()}>
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{item.phoneLabel || item.phone}</td>
                  <td className="px-5 py-4 text-muted">{item.document || "—"}</td>
                  <td className="px-5 py-4 text-muted">{item.address || "—"}</td>
                  <td className="px-5 py-4 text-muted">{item.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.items.length ? <p className="px-5 py-6 text-sm text-muted">Nenhum cliente encontrado.</p> : null}
      </Card>
      <LoadMore
        shown={list.items.length}
        total={list.total}
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onClick={() => void list.loadMore()}
      />

      <Modal
        open={open}
        title="Novo cliente"
        onClose={closeModal}
        className="max-w-xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="customer-form" disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={create} className="space-y-3">
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
