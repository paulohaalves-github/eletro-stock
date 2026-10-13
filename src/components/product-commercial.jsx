"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, uploadWithProgress } from "@/lib/api-client";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";

const NEW_MANUFACTURER = "__new__";

export function ProductCommercial({ product, canEdit, canPhoto, canDelete, onChanged }) {
  const model = product.catalogModel;
  const [manufacturers, setManufacturers] = useState([]);
  const [manufacturerId, setManufacturerId] = useState(model?.manufacturer?.id ? String(model.manufacturer.id) : "");
  const [newName, setNewName] = useState("");
  const [specifications, setSpecifications] = useState(model?.specifications || "");
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [progress, setProgress] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api("/api/manufacturers")
      .then((data) => setManufacturers(data.items || []))
      .catch(() => {});
  }, [model?.manufacturer?.id]);

  useEffect(() => {
    setManufacturerId(model?.manufacturer?.id ? String(model.manufacturer.id) : "");
    setNewName("");
    setSpecifications(model?.specifications || "");
  }, [model?.id, model?.manufacturer?.id, model?.specifications]);

  function brandName() {
    if (manufacturerId === NEW_MANUFACTURER) return newName.trim();
    return manufacturers.find((item) => String(item.id) === manufacturerId)?.name || model?.manufacturer?.name || "";
  }

  async function save(event) {
    event.preventDefault();
    if (manufacturerId === NEW_MANUFACTURER && !newName.trim()) {
      toast.error("Informe o nome do novo fabricante.");
      return;
    }
    setSaving(true);
    try {
      const data = await api(`/api/products/${product.id}/commercial`, {
        method: "PUT",
        json: {
          manufacturerId: manufacturerId === NEW_MANUFACTURER ? "" : manufacturerId,
          manufacturerName: manufacturerId === NEW_MANUFACTURER ? newName.trim() : "",
          specifications,
        },
      });
      toast.success(data.message);
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function registerManufacturer() {
    const name = newName.trim();
    if (!name) {
      toast.error("Informe o nome do novo fabricante.");
      return;
    }
    setRegistering(true);
    try {
      const data = await api("/api/manufacturers", { method: "POST", json: { name } });
      setManufacturers((current) => {
        if (current.some((item) => item.id === data.manufacturer.id)) return current;
        return [...current, data.manufacturer].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      });
      setManufacturerId(String(data.manufacturer.id));
      setNewName("");
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRegistering(false);
    }
  }

  async function lookup() {
    setLooking(true);
    try {
      const data = await api(`/api/products/${product.id}/commercial`, {
        method: "POST",
        json: { manufacturer: brandName() },
      });
      toast.success(data.message);
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLooking(false);
    }
  }

  async function upload(list) {
    const form = new FormData();
    Array.from(list || []).forEach((file) => form.append("files", file));
    if (!form.has("files")) return;
    setProgress(0);
    try {
      await uploadWithProgress(`/api/products/${product.id}/commercial/images`, form, setProgress);
      toast.success("Foto comercial adicionada.");
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setProgress(null);
    }
  }

  async function remove(image) {
    try {
      const data = await api(`/api/products/${product.id}/commercial/images/${image.id}`, { method: "DELETE" });
      toast.success(data.message);
      onChanged?.();
    } catch (error) {
      toast.error(error.message);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="font-semibold">Ficha comercial</h2>
      <p className="mt-1 text-sm text-muted">
        Fabricante, especificações e fotos comerciais valem para todos os aparelhos deste modelo. A linha do produto não muda.
      </p>
      {!model ? (
        <p className="mt-3 text-sm text-muted">
          Informe o Model Code e o nome comercial para guardar esta ficha.
        </p>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          <Field label="Fabricante">
            <Select
              value={manufacturerId}
              disabled={!canEdit || saving || looking || registering}
              onChange={(event) => {
                setManufacturerId(event.target.value);
                if (event.target.value !== NEW_MANUFACTURER) setNewName("");
              }}
            >
              <option value="">Sem fabricante</option>
              {manufacturers.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              {canEdit ? <option value={NEW_MANUFACTURER}>Cadastrar novo fabricante</option> : null}
            </Select>
            {canEdit && manufacturerId === NEW_MANUFACTURER ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newName}
                  placeholder="Nome do fabricante"
                  disabled={saving || registering}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <Button type="button" variant="secondary" disabled={saving || registering || looking} onClick={registerManufacturer}>
                  {registering ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </div>
            ) : null}
          </Field>
          <Field label="Descrição / especificações">
            <Textarea
              value={specifications}
              disabled={!canEdit || saving}
              rows={8}
              onChange={(event) => setSpecifications(event.target.value)}
            />
          </Field>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || looking}>{saving ? "Salvando..." : "Salvar ficha"}</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || looking || (!product.ean && !product.supplierModelCode)}
                onClick={lookup}
              >
                {looking ? "Consultando..." : "Buscar no Icecat"}
              </Button>
            </div>
          ) : null}
          {canEdit ? (
            <p className="text-sm text-muted">
              A busca usa o EAN. Se ele não estiver no Icecat, continua pelo fabricante e pelo Model Code. A marca precisa ser a mesma do Icecat, por exemplo Samsung.
            </p>
          ) : null}
        </form>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Fotos comerciais</h3>
        <p className="mt-1 text-sm text-muted">Estas são as fotos da vitrine. As fotos do aparelho continuam na galeria abaixo.</p>
        {canPhoto && model ? (
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
              Adicionar foto comercial
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                upload(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        ) : null}
        {progress != null ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {model?.commercialImages?.map((image) => (
            <div key={image.id} className="overflow-hidden rounded-xl border border-border">
              <img src={image.fileUrl} alt="" className="h-32 w-full bg-white object-contain" />
              {canDelete ? (
                <div className="px-2 py-1.5 text-right">
                  <button type="button" className="text-[11px] text-danger" onClick={() => remove(image)}>
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {model && !model.commercialImages?.length ? (
          <p className="mt-3 text-sm text-muted">Nenhuma foto comercial ainda.</p>
        ) : null}
      </div>
    </Card>
  );
}
