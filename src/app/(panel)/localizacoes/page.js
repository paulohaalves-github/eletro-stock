"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";

export default function LocalizacoesPage() {
  const [types, setTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeName, setTypeName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [editingType, setEditingType] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);

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

  async function saveType(event) {
    event.preventDefault();
    try {
      if (editingType) {
        await api(`/api/location-types/${editingType.id}`, { method: "PATCH", json: { name: typeName, active: editingType.active } });
        toast.success("Tipo atualizado.");
        setEditingType(null);
      } else {
        await api("/api/location-types", { method: "POST", json: { name: typeName } });
        toast.success("Tipo cadastrado.");
      }
      setTypeName("");
      load();
    } catch (error) {
      toast.error(error.message);
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
    if (!selectedTypeId) {
      toast.error("Selecione um tipo de localização.");
      return;
    }
    try {
      if (editingLocation) {
        await api(`/api/locations/${editingLocation.id}`, {
          method: "PATCH",
          json: { name: locationName, locationTypeId: selectedTypeId, active: editingLocation.active },
        });
        toast.success("Localização atualizada.");
        setEditingLocation(null);
      } else {
        await api("/api/locations", { method: "POST", json: { name: locationName, locationTypeId: selectedTypeId } });
        toast.success("Localização cadastrada.");
      }
      setLocationName("");
      load();
    } catch (error) {
      toast.error(error.message);
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
    <div>
      <PageHeader
        title="Localizações"
        subtitle="Tipo de localização → Localização → Produto. O mesmo código pode existir em tipos diferentes."
      />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card>
            <form onSubmit={saveType} className="space-y-3">
              <Field label={editingType ? "Editar tipo" : "Novo tipo de localização"}>
                <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Armazém, Showroom, Expedição..." />
              </Field>
              <div className="flex gap-2">
                <Button>{editingType ? "Salvar tipo" : "Cadastrar tipo"}</Button>
                {editingType ? (
                  <Button type="button" variant="secondary" onClick={() => { setEditingType(null); setTypeName(""); }}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          <div className="space-y-2">
            {types.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer p-4 ${String(selectedTypeId) === String(item.id) ? "border-accent/60" : ""}`}
                onClick={() => setSelectedTypeId(item.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.locationCount || 0} {item.locationCount === 1 ? "localização" : "localizações"} · {item.productCount || 0} {item.productCount === 1 ? "produto" : "produtos"} · {item.active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button variant="ghost" onClick={() => { setEditingType(item); setTypeName(item.name); }}>Editar</Button>
                    <Button variant="ghost" onClick={() => toggleType(item)}>{item.active ? "Inativar" : "Ativar"}</Button>
                    <Button variant="ghost" onClick={() => removeType(item)}>Excluir</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-semibold">{selectedType ? selectedType.name : "Selecione um tipo"}</h2>
            {selectedType ? (
              <form onSubmit={saveLocation} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label={editingLocation ? "Editar localização" : "Nova localização"}>
                  <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="A1, A2, Box 03..." />
                </Field>
                <div className="flex items-end gap-2">
                  <Button>{editingLocation ? "Salvar" : "Cadastrar"}</Button>
                  {editingLocation ? (
                    <Button type="button" variant="secondary" onClick={() => { setEditingLocation(null); setLocationName(""); }}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="text-sm text-muted">Escolha um tipo à esquerda para ver e cadastrar as localizações.</p>
            )}
          </Card>
          {selectedType ? (
            <div className="space-y-2">
              {typeLocations.map((item) => (
                <Card key={item.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.productCount || 0} {item.productCount === 1 ? "produto" : "produtos"} · {item.active ? "Ativa" : "Inativa"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setEditingLocation(item); setLocationName(item.name); }}>Editar</Button>
                    <Button variant="ghost" onClick={() => toggleLocation(item)}>{item.active ? "Inativar" : "Ativar"}</Button>
                    <Button variant="ghost" onClick={() => removeLocation(item)}>Excluir</Button>
                  </div>
                </Card>
              ))}
              {!typeLocations.length ? (
                <p className="text-sm text-muted">Nenhuma localização neste tipo.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
