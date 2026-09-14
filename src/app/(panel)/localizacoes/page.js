"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { Modal } from "@/components/modal";
import { cn } from "@/lib/format";

export default function LocalizacoesPage() {
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeName, setTypeName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [editingType, setEditingType] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [typeData, locationData] = await Promise.all([
      api("/api/location-types?includeCounts=true"),
      api("/api/locations?includeCounts=true"),
    ]);
    setTypes(typeData.items || []);
    setLocations(locationData.items || []);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, []);

  const selectedType = types.find((item) => String(item.id) === String(selectedTypeId)) || null;
  const typeLocations = useMemo(
    () => locations.filter((item) => String(item.locationTypeId) === String(selectedTypeId)),
    [locations, selectedTypeId],
  );

  function openTypeModal(item = null) {
    setEditingType(item);
    setTypeName(item?.name || "");
    setTypeOpen(true);
  }

  function closeTypeModal() {
    if (saving) return;
    setTypeOpen(false);
    setEditingType(null);
    setTypeName("");
  }

  function openLocationModal(item = null) {
    if (!selectedTypeId && !item) {
      toast.error("Selecione um tipo de localização.");
      return;
    }
    setEditingLocation(item);
    setLocationName(item?.name || "");
    setLocationOpen(true);
  }

  function closeLocationModal() {
    if (saving) return;
    setLocationOpen(false);
    setEditingLocation(null);
    setLocationName("");
  }

  async function saveType(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingType) {
        await api(`/api/location-types/${editingType.id}`, { method: "PATCH", json: { name: typeName, active: editingType.active } });
        toast.success("Tipo atualizado.");
      } else {
        await api("/api/location-types", { method: "POST", json: { name: typeName } });
        toast.success("Tipo cadastrado.");
      }
      closeTypeModal();
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleType(item) {
    try {
      await api(`/api/location-types/${item.id}`, { method: "PATCH", json: { name: item.name, active: !item.active } });
      toast.success(item.active ? "Tipo inativado." : "Tipo ativado.");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function removeType(item) {
    try {
      await api(`/api/location-types/${item.id}`, { method: "DELETE" });
      toast.success("Tipo excluído.");
      if (String(selectedTypeId) === String(item.id)) setSelectedTypeId("");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function saveLocation(event) {
    event.preventDefault();
    const typeId = editingLocation?.locationTypeId || selectedTypeId;
    if (!typeId) {
      toast.error("Selecione um tipo de localização.");
      return;
    }
    setSaving(true);
    try {
      if (editingLocation) {
        await api(`/api/locations/${editingLocation.id}`, {
          method: "PATCH",
          json: { name: locationName, locationTypeId: typeId, active: editingLocation.active },
        });
        toast.success("Localização atualizada.");
      } else {
        await api("/api/locations", { method: "POST", json: { name: locationName, locationTypeId: typeId } });
        toast.success("Localização cadastrada.");
      }
      closeLocationModal();
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleLocation(item) {
    try {
      await api(`/api/locations/${item.id}`, {
        method: "PATCH",
        json: { name: item.name, locationTypeId: item.locationTypeId, active: !item.active },
      });
      toast.success(item.active ? "Localização inativada." : "Localização ativada.");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function removeLocation(item) {
    try {
      await api(`/api/locations/${item.id}`, { method: "DELETE" });
      toast.success("Localização excluída.");
      load();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Localizações"
        subtitle="Tipo de localização é compartilhado. As prateleiras pertencem à unidade selecionada no menu."
        actions={
          <>
            <Button variant="secondary" onClick={() => openTypeModal()}>Novo tipo</Button>
            <Button onClick={() => openLocationModal()} disabled={!selectedTypeId}>Nova localização</Button>
          </>
        }
      />

      <Card className="w-full overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tipos de localização</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Tipo</th>
                <th className="px-5 py-3 font-semibold">Localizações</th>
                <th className="px-5 py-3 font-semibold">Produtos</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {types.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer border-t border-border hover:bg-surface-2/80",
                    String(selectedTypeId) === String(item.id) ? "bg-accent/10" : "",
                  )}
                  onClick={() => setSelectedTypeId(item.id)}
                >
                  <td className="px-5 py-4 font-medium">{item.name}</td>
                  <td className="px-5 py-4 text-muted">{item.locationCount || 0}</td>
                  <td className="px-5 py-4 text-muted">{item.productCount || 0}</td>
                  <td className="px-5 py-4 text-muted">{item.active ? "Ativo" : "Inativo"}</td>
                  <td className="px-5 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" onClick={() => openTypeModal(item)}>Editar</Button>
                      <Button variant="ghost" onClick={() => toggleType(item)}>{item.active ? "Inativar" : "Ativar"}</Button>
                      <Button variant="ghost" onClick={() => removeType(item)}>Excluir</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!types.length ? <p className="px-5 py-6 text-sm text-muted">Nenhum tipo cadastrado.</p> : null}
      </Card>

      <Card className="w-full overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {selectedType ? `Localizações · ${selectedType.name}` : "Localizações"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {selectedType ? "Selecione um tipo acima para filtrar. Cadastre novas localizações pelo botão do topo." : "Selecione um tipo na tabela acima."}
          </p>
        </div>
        {selectedType ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Localização</th>
                    <th className="px-5 py-3 font-semibold">Produtos</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {typeLocations.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-surface-2/80">
                      <td className="px-5 py-4 font-medium">{item.name}</td>
                      <td className="px-5 py-4 text-muted">{item.productCount || 0}</td>
                      <td className="px-5 py-4 text-muted">{item.active ? "Ativa" : "Inativa"}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" onClick={() => openLocationModal(item)}>Editar</Button>
                          <Button variant="ghost" onClick={() => toggleLocation(item)}>{item.active ? "Inativar" : "Ativar"}</Button>
                          <Button variant="ghost" onClick={() => removeLocation(item)}>Excluir</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!typeLocations.length ? <p className="px-5 py-6 text-sm text-muted">Nenhuma localização neste tipo.</p> : null}
          </>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">Escolha um tipo para ver e cadastrar as localizações.</p>
        )}
      </Card>

      <Modal
        open={typeOpen}
        title={editingType ? "Editar tipo" : "Novo tipo de localização"}
        onClose={closeTypeModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeTypeModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="location-type-form" disabled={saving || !typeName.trim()}>
              {saving ? "Salvando..." : editingType ? "Salvar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="location-type-form" onSubmit={saveType}>
          <Field label="Nome" required>
            <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Armazém, Showroom, Expedição..." />
          </Field>
        </form>
      </Modal>

      <Modal
        open={locationOpen}
        title={editingLocation ? "Editar localização" : `Nova localização${selectedType ? ` · ${selectedType.name}` : ""}`}
        onClose={closeLocationModal}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeLocationModal} disabled={saving}>Cancelar</Button>
            <Button type="submit" form="location-form" disabled={saving || !locationName.trim()}>
              {saving ? "Salvando..." : editingLocation ? "Salvar" : "Cadastrar"}
            </Button>
          </>
        }
      >
        <form id="location-form" onSubmit={saveLocation}>
          <Field label="Nome" required>
            <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="A1, A2, Box 03..." />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
